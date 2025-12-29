import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { MessageType, ScanStatus, PROTOCOL_VERSION, Severity, type ScanResultPayload, type ScanStatusPayload } from '../types/messages';

export class DevignWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devign.webview';
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];
    private _debouncedScanTimers: Map<string, NodeJS.Timeout> = new Map();
    private static readonly TYPING_DEBOUNCE_MS = 500;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        this._setupMessageHandlers(webviewView.webview);
        this._setupTypingListener();

        webviewView.onDidDispose(() => this.dispose());
    }

    private _setupMessageHandlers(webview: vscode.Webview) {
        webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case MessageType.START_SCAN: {
                    await this._handleStartScan(data.payload);
                    break;
                }
                case MessageType.STOP_SCAN: {
                    this._cancelPendingScans();
                    break;
                }
                case MessageType.OPEN_FILE: {
                    await this._handleOpenFile(data.payload);
                    break;
                }
                case 'hello': {
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
            }
        }, undefined, this._disposables);
    }

    private _setupTypingListener() {
        const typingListener = vscode.workspace.onDidChangeTextDocument((event) => {
            const document = event.document;
            if (!this._isCppFile(document)) {
                return;
            }

            const key = document.uri.toString();
            const existing = this._debouncedScanTimers.get(key);
            if (existing) {
                clearTimeout(existing);
            }

            this.postScanStatus({ status: ScanStatus.SCANNING, currentFile: document.fileName });

            const timer = setTimeout(() => {
                this._debouncedScanTimers.delete(key);
                this._triggerScanOnTyping(document);
            }, DevignWebviewProvider.TYPING_DEBOUNCE_MS);

            this._debouncedScanTimers.set(key, timer);
        });

        this._disposables.push(typingListener);
    }

    private async _triggerScanOnTyping(document: vscode.TextDocument) {
        try {
            await vscode.commands.executeCommand('devign.scanCurrentFile');
        } catch (error) {
            this.postScanStatus({
                status: ScanStatus.FAILED,
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async _handleStartScan(payload: { scope: string; target?: string }) {
        this.postScanStatus({ status: ScanStatus.SCANNING });

        try {
            switch (payload.scope) {
                case 'file':
                    await vscode.commands.executeCommand('devign.scanCurrentFile');
                    break;
                case 'workspace':
                    await vscode.commands.executeCommand('devign.scanWorkspace');
                    break;
                case 'selection':
                    await vscode.commands.executeCommand('devign.scanSelection');
                    break;
            }
        } catch (error) {
            this.postScanStatus({
                status: ScanStatus.FAILED,
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async _handleOpenFile(payload: { path: string; range?: { startLine: number; startColumn: number; endLine: number; endColumn: number } }) {
        await vscode.commands.executeCommand('devign.revealResult', {
            filePath: payload.path,
            line: payload.range?.startLine ?? 1,
            column: payload.range?.startColumn ?? 0
        });
    }

    private _cancelPendingScans() {
        for (const timer of this._debouncedScanTimers.values()) {
            clearTimeout(timer);
        }
        this._debouncedScanTimers.clear();
        this.postScanStatus({ status: ScanStatus.IDLE });
    }

    private _isCppFile(document: vscode.TextDocument): boolean {
        const extensions = ['.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.hxx'];
        return extensions.some(ext => document.fileName.toLowerCase().endsWith(ext));
    }

    public postScanResult(result: ScanResultPayload) {
        this._view?.webview.postMessage({
            type: MessageType.SCAN_RESULT,
            version: PROTOCOL_VERSION,
            payload: result
        });
    }

    public postScanStatus(status: ScanStatusPayload) {
        this._view?.webview.postMessage({
            type: MessageType.SCAN_STATUS,
            version: PROTOCOL_VERSION,
            payload: status
        });
    }

    public dispose() {
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
        this._disposables = [];
        this._cancelPendingScans();
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // The CSS file from the React build output
        const stylesUri = getUri(webview, this._extensionUri, ["webview-ui", "dist", "assets", "index.css"]);
        // The JS file from the React build output
        const scriptUri = getUri(webview, this._extensionUri, ["webview-ui", "dist", "assets", "index.js"]);

        const nonce = getNonce();

        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Devign</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
    }
}
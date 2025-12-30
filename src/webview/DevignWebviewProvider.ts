import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { MessageType, ScanStatus, PROTOCOL_VERSION, Severity, type ScanResultPayload, type ScanStatusPayload, type GitStatusPayload, type GateStatusPayload } from '../types/messages';
import { getSarifExportService, type SarifLog } from '../services/sarifExportService';
import { getHtmlReportService, type HtmlReportData } from '../services/htmlReportService';
import { GitService } from '../services/gitService';
import { CommitCommand } from '../commands/commitCommand';
import { PushCommand } from '../commands/pushCommand';
import { PullCommand } from '../commands/pullCommand';
import { SecurityGateService } from '../services/securityGateService';

const VALID_MESSAGE_TYPES = new Set(Object.values(MessageType));

export class DevignWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devign.webview';
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];
    private _debouncedScanTimers: Map<string, NodeJS.Timeout> = new Map();
    private static readonly TYPING_DEBOUNCE_MS = 500;
    private _currentSarifLog?: SarifLog;
    private _gitService: GitService;
    private _commitCommand: CommitCommand;
    private _pushCommand: PushCommand;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {
        this._gitService = new GitService();
        // Initialize Security Gate Service (needed for Commit Command)
        const securityGateService = new SecurityGateService(this._gitService);
        this._commitCommand = new CommitCommand(this._gitService, securityGateService);
        this._pushCommand = new PushCommand(this._gitService, securityGateService);
    }

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

        // Send initial git status
        this._sendInitialGitStatus();

        webviewView.onDidDispose(() => this.dispose());
    }

    private _isValidMessage(data: unknown): data is { type: MessageType; payload?: any } {
        if (!data || typeof data !== 'object') {
            return false;
        }
        const msg = data as Record<string, unknown>;
        if (typeof msg.type !== 'string' || !VALID_MESSAGE_TYPES.has(msg.type as MessageType)) {
            return false;
        }
        return true;
    }

    private _setupMessageHandlers(webview: vscode.Webview) {
        webview.onDidReceiveMessage(async (data) => {
            if (!this._isValidMessage(data)) {
                console.warn('[Devign] Received invalid webview message:', data);
                return;
            }

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
                case MessageType.EXPORT_REPORT: {
                    await this._handleExportReport();
                    break;
                }
                case MessageType.GIT_ACTION: {
                    await this._handleGitAction(data.payload);
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

    public postReportData(data: HtmlReportData) {
        this._view?.webview.postMessage({
            type: MessageType.REPORT_DATA,
            version: PROTOCOL_VERSION,
            payload: data
        });
    }

    public postGitStatus(status: GitStatusPayload): void {
        this._view?.webview.postMessage({
            type: MessageType.GIT_STATUS,
            version: PROTOCOL_VERSION,
            payload: status
        });
    }

    public postGateStatus(status: GateStatusPayload): void {
        this._view?.webview.postMessage({
            type: MessageType.GATE_STATUS,
            version: PROTOCOL_VERSION,
            payload: status
        });
    }

    private async _sendInitialGitStatus(): Promise<void> {
        try {
            const currentBranch = await this._gitService.getCurrentBranch();
            const branches = await this._gitService.getBranches();
            const snapshot = await this._gitService.getRepositorySnapshot();
            
            const gitStatus: GitStatusPayload = {
                branch: currentBranch || 'main',
                branches: branches.map(b => b.name),
                staged: snapshot?.staged.map(f => f.filePath) || [],
                unstaged: snapshot?.unstaged.map(f => f.filePath) || [],
                remotes: ['origin'],
                isPushing: false,
                isPulling: false
            };
            
            this.postGitStatus(gitStatus);
        } catch (error) {
            console.error('[Devign] Failed to get initial git status:', error);
            // Send empty status to clear connecting state
            this.postGitStatus({
                branch: 'unknown',
                branches: [],
                staged: [],
                unstaged: [],
                remotes: [],
                isPushing: false,
                isPulling: false
            });
        }
    }

    public setSarifLog(sarifLog: SarifLog) {
        this._currentSarifLog = sarifLog;
        const htmlReportService = getHtmlReportService();
        const reportData = htmlReportService.sarifToReportData(sarifLog);
        this.postReportData(reportData);
    }

    private async _handleExportReport() {
        if (!this._currentSarifLog) {
            vscode.window.showWarningMessage('No scan results to export. Run a scan first.');
            return;
        }

        const htmlReportService = getHtmlReportService();
        await htmlReportService.exportWithDialog(this._currentSarifLog, {
            title: 'Devign Security Report'
        });
    }

    private async _handleGitAction(payload: { action: string; data: any }) {
        try {
            switch (payload.action) {
                case 'createBranch':
                    await this._gitService.createBranch(payload.data);
                    break;
                case 'checkout':
                    await this._gitService.checkout(payload.data);
                    break;
                case 'deleteBranch':
                    await this._gitService.deleteBranch(payload.data);
                    break;
                case 'stage':
                    await this._gitService.stage([vscode.Uri.file(payload.data)]);
                    break;
                case 'unstage':
                    await this._gitService.unstage([vscode.Uri.file(payload.data)]);
                    break;
                case 'commit':
                    if (payload.data && payload.data.message) {
                        // Use CommitCommand to handle commit with security gate check
                        // We need to temporarily override the promptForCommitMessage method
                        // since we already have the message from the webview
                        const originalPrompt = this._commitCommand['promptForCommitMessage'];
                        this._commitCommand['promptForCommitMessage'] = async () => payload.data.message;

                        try {
                            await this._commitCommand.execute();
                        } finally {
                            // Restore original method
                            this._commitCommand['promptForCommitMessage'] = originalPrompt;
                        }
                    }
                    break;
                case 'push':
                    await this._pushCommand.execute();
                    break;
                case 'pull':
                    await this._gitService.pull();
                    break;
            }
            // Refresh git status after action
            // This would ideally be handled by an event listener on the git service
        } catch (error) {
            vscode.window.showErrorMessage(`Git action failed: ${error instanceof Error ? error.message : String(error)}`);
        }
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
        // VS Code Codicons CSS
        const codiconsUri = getUri(webview, this._extensionUri, ["node_modules", "@vscode/codicons", "dist", "codicon.css"]);

        const nonce = getNonce();

        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="
            default-src 'none';
            style-src ${webview.cspSource};
            font-src ${webview.cspSource};
            img-src ${webview.cspSource} data:;
            script-src 'nonce-${nonce}';
            connect-src 'none';
            frame-src 'none';
            object-src 'none';
            base-uri 'none';
            form-action 'none';
          ">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <link rel="stylesheet" type="text/css" href="${codiconsUri}">
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
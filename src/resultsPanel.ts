import * as vscode from 'vscode';
import { ScanResult } from './scanner';

export class ResultsPanel {
    public static currentPanel: ResultsPanel | undefined;
    private static readonly MAX_RESULTS = 100;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _results: ScanResult[] = [];

    private readonly _extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
        this._panel = vscode.window.createWebviewPanel(
            'devignResults',
            'Devign Scan Results',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        this._panel.webview.html = this._getWebviewContent();

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.command === 'openFile') {
                    const uri = vscode.Uri.file(message.filePath);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
                    if (message.line && message.line > 0) {
                        const line = message.line - 1;
                        const range = new vscode.Range(line, 0, line, 0);
                        editor.selection = new vscode.Selection(range.start, range.end);
                        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                    }
                }
            },
            null,
            this._disposables
        );

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        ResultsPanel.currentPanel = this;
    }

    public reveal() {
        this._panel.reveal(vscode.ViewColumn.Two);
    }

    public updateResults(results: ScanResult[]) {
        this._results = [...this._results, ...results];
        // Trim to max size, keeping most recent
        if (this._results.length > ResultsPanel.MAX_RESULTS) {
            this._results = this._results.slice(-ResultsPanel.MAX_RESULTS);
        }
        this._panel.webview.postMessage({
            type: 'updateResults',
            results: this._results
        });
    }

    public clearResults() {
        this._results = [];
        this._panel.webview.postMessage({
            type: 'updateResults',
            results: []
        });
    }

    public dispose() {
        ResultsPanel.currentPanel = undefined;
        this._results = [];
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    private _getWebviewContent(): string {
        const nonce = this._getNonce();
        const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Devign Scan Results</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        h1 {
            color: var(--vscode-titleBar-activeForeground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .summary {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .stat {
            display: inline-block;
            margin-right: 30px;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
        }
        .stat-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .results-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        .results-table th, .results-table td {
            text-align: left;
            padding: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .results-table th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: 600;
        }
        .results-table tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .file-link {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            text-decoration: none;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
        }
        .file-link:hover {
            text-decoration: underline;
        }
        .function-name {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .risk-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .risk-CRITICAL { background-color: #d32f2f; color: white; }
        .risk-HIGH { background-color: #f44336; color: white; }
        .risk-MEDIUM { background-color: #ff9800; color: black; }
        .risk-LOW { background-color: #2196f3; color: white; }
        .risk-SAFE { background-color: #4caf50; color: white; }
        .probability {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .api-tag {
            display: inline-block;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            margin: 2px;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
        }
        .no-results {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        .info-box {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding: 15px;
            margin: 20px 0;
        }
        .clear-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        .clear-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
    </style>
</head>
<body>
    <div class="header-row">
        <h1>🛡️ Devign Vulnerability Scanner</h1>
        <button class="clear-btn" id="clearBtn">Clear Results</button>
    </div>
    
    <div class="info-box">
        <strong>How to use:</strong>
        <ul>
            <li>Press <kbd>Ctrl+Shift+D</kbd> to scan the current file</li>
            <li>Right-click a C/C++ file and select "Devign: Scan Current File"</li>
            <li>Use Command Palette: "Devign: Scan Workspace"</li>
        </ul>
    </div>

    <div class="summary">
        <div class="stat">
            <div class="stat-value" id="filesScanned">0</div>
            <div class="stat-label">Files Scanned</div>
        </div>
        <div class="stat">
            <div class="stat-value" id="vulnFound" style="color: var(--vscode-errorForeground);">0</div>
            <div class="stat-label">Vulnerabilities</div>
        </div>
        <div class="stat">
            <div class="stat-value" id="safeFiles" style="color: var(--vscode-testing-iconPassed);">0</div>
            <div class="stat-label">Safe Files</div>
        </div>
    </div>

    <div id="results" class="no-results">
        <p>No scan results yet.</p>
        <p>Scan a C/C++ file to see results here.</p>
    </div>

    <script nonce="\${nonce}">
        const vscode = acquireVsCodeApi();
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'updateResults') {
                updateResults(message.results);
            }
        });

        function openFile(filePath, line) {
            vscode.postMessage({
                command: 'openFile',
                filePath: filePath,
                line: line || 1
            });
        }

        function clearResults() {
            vscode.postMessage({ command: 'clearResults' });
            updateResults([]);
        }

        // Set up event listener for clear button (avoids inline onclick)
        document.getElementById('clearBtn').addEventListener('click', clearResults);

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;')
                      .replace(/'/g, '&#39;');
        }

        function getFileName(filePath) {
            return filePath.split(/[\\\\/]/).pop() || filePath;
        }

        function updateResults(results) {
            const container = document.getElementById('results');
            const filesScanned = document.getElementById('filesScanned');
            const vulnFound = document.getElementById('vulnFound');
            const safeFiles = document.getElementById('safeFiles');

            if (!results || results.length === 0) {
                container.innerHTML = '<div class="no-results"><p>No scan results yet.</p><p>Scan a C/C++ file to see results here.</p></div>';
                filesScanned.textContent = '0';
                vulnFound.textContent = '0';
                safeFiles.textContent = '0';
                return;
            }

            const vulnCount = results.filter(r => r.vulnerable).length;
            filesScanned.textContent = results.length;
            vulnFound.textContent = vulnCount;
            safeFiles.textContent = results.length - vulnCount;

            let html = \`
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>File</th>
                            <th>Function</th>
                            <th>Risk Level</th>
                            <th>Probability</th>
                            <th>Dangerous APIs</th>
                        </tr>
                    </thead>
                    <tbody>
            \`;

            for (const r of results) {
                const fileName = getFileName(r.file_path);
                const firstLine = r.dangerous_lines && r.dangerous_lines.length > 0 
                    ? r.dangerous_lines[0].line 
                    : 1;
                const functionName = r.dangerous_lines && r.dangerous_lines.length > 0 && r.dangerous_lines[0].function
                    ? r.dangerous_lines[0].function
                    : '-';
                const riskLevel = r.vulnerable ? r.risk_level : 'SAFE';
                const probability = (r.probability * 100).toFixed(1) + '%';
                const apis = r.dangerous_apis && r.dangerous_apis.length > 0
                    ? r.dangerous_apis.map(api => \`<span class="api-tag">\${escapeHtml(api)}</span>\`).join(' ')
                    : '-';

                html += \`
                    <tr>
                        <td>
                            <a class="file-link" data-filepath="\${escapeHtml(r.file_path)}" data-line="\${firstLine}" title="\${escapeHtml(r.file_path)}">
                                \${escapeHtml(fileName)}
                            </a>
                        </td>
                        <td class="function-name">\${escapeHtml(functionName)}</td>
                        <td><span class="risk-badge risk-\${escapeHtml(riskLevel)}">\${escapeHtml(riskLevel)}</span></td>
                        <td class="probability">\${probability}</td>
                        <td>\${apis}</td>
                    </tr>
                \`;
            }

            html += '</tbody></table>';
            container.innerHTML = html;

            // Set up event delegation for file links (avoids inline onclick handlers)
            container.querySelectorAll('.file-link').forEach(link => {
                link.addEventListener('click', function() {
                    const filePath = this.getAttribute('data-filepath');
                    const line = parseInt(this.getAttribute('data-line'), 10) || 1;
                    openFile(filePath, line);
                });
            });
        }
    </script>
</body>
</html>`;
    }
}

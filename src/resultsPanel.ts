import * as vscode from 'vscode';
import { ScanResult } from './scanner';
import { AggregatedGateResult } from './services/securityGateService';

export type ResultsPanelMode = 'workspace' | 'gate';

export class ResultsPanel {
    public static currentPanel: ResultsPanel | undefined;
    private static readonly MAX_RESULTS = 100;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _results: ScanResult[] = [];
    private _gateResult: AggregatedGateResult | null = null;
    private _mode: ResultsPanelMode = 'workspace';

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
                } else if (message.command === 'switchMode') {
                    this._mode = message.mode;
                    this._updateWebview();
                } else if (message.command === 'clearResults') {
                    this.clearResults();
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

    public setMode(mode: ResultsPanelMode) {
        this._mode = mode;
        this._updateWebview();
    }

    public getMode(): ResultsPanelMode {
        return this._mode;
    }

    public updateResults(results: ScanResult[]) {
        this._results = [...this._results, ...results];
        if (this._results.length > ResultsPanel.MAX_RESULTS) {
            this._results = this._results.slice(-ResultsPanel.MAX_RESULTS);
        }
        this._mode = 'workspace';
        this._updateWebview();
    }

    public updateGateResults(result: AggregatedGateResult) {
        this._gateResult = result;
        this._mode = 'gate';
        this._updateWebview();
    }

    private _updateWebview() {
        this._panel.webview.postMessage({
            type: 'updateState',
            mode: this._mode,
            workspaceResults: this._results,
            gateResult: this._gateResult
        });
    }

    public clearResults() {
        this._results = [];
        this._gateResult = null;
        this._updateWebview();
    }

    public dispose() {
        ResultsPanel.currentPanel = undefined;
        this._results = [];
        this._gateResult = null;
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
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); background-color: var(--vscode-editor-background); }
        h1 { color: var(--vscode-titleBar-activeForeground); border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
        .tab-bar { display: flex; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 20px; }
        .tab { padding: 10px 20px; cursor: pointer; border: none; background: none; color: var(--vscode-foreground); font-size: 14px; border-bottom: 2px solid transparent; opacity: 0.7; }
        .tab:hover { opacity: 1; background-color: var(--vscode-list-hoverBackground); }
        .tab.active { opacity: 1; border-bottom-color: var(--vscode-focusBorder); font-weight: 600; }
        .summary { background-color: var(--vscode-editor-inactiveSelectionBackground); padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .stat { display: inline-block; margin-right: 30px; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 12px; color: var(--vscode-descriptionForeground); }
        .decision-banner { padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; }
        .decision-banner.pass { background-color: rgba(76, 175, 80, 0.15); border: 2px solid #4caf50; }
        .decision-banner.warn { background-color: rgba(255, 152, 0, 0.15); border: 2px solid #ff9800; }
        .decision-banner.block { background-color: rgba(244, 67, 54, 0.15); border: 2px solid #f44336; }
        .decision-icon { font-size: 48px; }
        .decision-text { flex: 1; }
        .decision-title { font-size: 24px; font-weight: bold; margin: 0; }
        .decision-subtitle { font-size: 14px; opacity: 0.8; margin-top: 5px; }
        .results-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .results-table th, .results-table td { text-align: left; padding: 10px; border-bottom: 1px solid var(--vscode-panel-border); }
        .results-table th { background-color: var(--vscode-editor-inactiveSelectionBackground); font-weight: 600; }
        .results-table tr:hover { background-color: var(--vscode-list-hoverBackground); }
        .file-link { color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: none; font-family: var(--vscode-editor-font-family); font-size: 13px; }
        .file-link:hover { text-decoration: underline; }
        .function-name { font-family: var(--vscode-editor-font-family); font-size: 12px; color: var(--vscode-descriptionForeground); }
        .function-group { margin-bottom: 20px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; overflow: hidden; }
        .function-group-header { background-color: var(--vscode-editor-inactiveSelectionBackground); padding: 12px 15px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
        .function-group-content { padding: 10px 15px; }
        .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
        .risk-CRITICAL { background-color: #d32f2f; color: white; }
        .risk-HIGH { background-color: #f44336; color: white; }
        .risk-MEDIUM { background-color: #ff9800; color: black; }
        .risk-LOW { background-color: #2196f3; color: white; }
        .risk-SAFE { background-color: #4caf50; color: white; }
        .probability { font-size: 12px; color: var(--vscode-descriptionForeground); }
        .api-tag { display: inline-block; background-color: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 6px; border-radius: 3px; margin: 2px; font-family: var(--vscode-editor-font-family); font-size: 11px; }
        .no-results { text-align: center; padding: 40px; color: var(--vscode-descriptionForeground); }
        .info-box { background-color: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textLink-foreground); padding: 15px; margin: 20px 0; }
        .disclaimer-box { background-color: var(--vscode-inputValidation-warningBackground); border-left: 4px solid var(--vscode-inputValidation-warningBorder); padding: 12px 15px; margin: 15px 0; border-radius: 3px; }
        .disclaimer-box p { margin: 8px 0 0 0; font-size: 12px; color: var(--vscode-foreground); opacity: 0.9; }
        .clear-btn { background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; }
        .clear-btn:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
        .header-row { display: flex; justify-content: space-between; align-items: center; }
        .filter-row { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 5px; }
        .filter-checkbox { cursor: pointer; }
        .filter-label { font-size: 13px; cursor: pointer; }
        .reasons-list { background-color: var(--vscode-textBlockQuote-background); border-radius: 5px; padding: 15px; margin: 15px 0; }
        .reasons-list h3 { margin: 0 0 10px 0; font-size: 14px; }
        .reasons-list ul { margin: 0; padding-left: 20px; }
        .reasons-list li { margin: 5px 0; font-size: 13px; }
        .view-content { display: none; }
        .view-content.active { display: block; }
        .finding-row { display: flex; align-items: center; gap: 15px; padding: 8px 0; border-bottom: 1px solid var(--vscode-panel-border); }
    </style>
</head>
<body>
    <div class="header-row">
        <h1>🛡️ Devign Vulnerability Scanner</h1>
        <button class="clear-btn" id="clearBtn">Clear Results</button>
    </div>

    <div class="tab-bar">
        <button class="tab active" data-mode="workspace" id="tabWorkspace">📁 Workspace Scan</button>
        <button class="tab" data-mode="gate" id="tabGate">🚦 Gate Scan</button>
    </div>

    <div id="workspaceView" class="view-content active">
        <div class="info-box">
            <strong>How to use:</strong>
            <ul>
                <li>Press <kbd>Ctrl+Shift+D</kbd> to scan the current file</li>
                <li>Right-click a C/C++ file and select "Devign: Scan Current File"</li>
                <li>Use Command Palette: "Devign: Scan Workspace"</li>
            </ul>
        </div>
        <div class="disclaimer-box">
            <strong>⚠️ Limitation Notice:</strong>
            <p>Devign checks vulnerabilities WITHIN individual functions only. It does NOT track data flow across functions, call chains, or complex logic flows. Treat results as best-effort signals, not proof of security.</p>
        </div>
        <div class="summary" id="workspaceSummary">
            <div class="stat"><div class="stat-value" id="filesScanned">0</div><div class="stat-label">Files Scanned</div></div>
            <div class="stat"><div class="stat-value" id="vulnFound" style="color: var(--vscode-errorForeground);">0</div><div class="stat-label">Vulnerabilities</div></div>
            <div class="stat"><div class="stat-value" id="safeFiles" style="color: var(--vscode-testing-iconPassed);">0</div><div class="stat-label">Safe Files</div></div>
        </div>
        <div id="workspaceResults" class="no-results"><p>No scan results yet.</p><p>Scan a C/C++ file to see results here.</p></div>
    </div>

    <div id="gateView" class="view-content">
        <div id="gateDecisionBanner" class="decision-banner pass" style="display: none;">
            <div class="decision-icon" id="gateDecisionIcon">✅</div>
            <div class="decision-text">
                <div class="decision-title" id="gateDecisionTitle">PASS</div>
                <div class="decision-subtitle" id="gateDecisionSubtitle">No security issues found</div>
            </div>
        </div>
        <div class="summary" id="gateSummary" style="display: none;">
            <div class="stat"><div class="stat-value" id="gateFilesScanned">0</div><div class="stat-label">Files Scanned</div></div>
            <div class="stat"><div class="stat-value" id="gateFunctionsScanned">0</div><div class="stat-label">Functions Scanned</div></div>
            <div class="stat"><div class="stat-value" id="gateDuration">0ms</div><div class="stat-label">Duration</div></div>
        </div>
        <div class="filter-row" id="gateFilterRow" style="display: none;">
            <input type="checkbox" id="filterVulnerable" class="filter-checkbox">
            <label for="filterVulnerable" class="filter-label">Show only vulnerable functions</label>
        </div>
        <div id="gateReasons" class="reasons-list" style="display: none;"><h3>📋 Reasons</h3><ul id="gateReasonsList"></ul></div>
        <div id="gateResults" class="no-results"><p>No gate scan results yet.</p><p>Run a security gate check to see results here.</p></div>
        <div id="gateDisclaimer" class="disclaimer-box" style="display: none;"><strong>⚠️ Disclaimer:</strong><p id="gateDisclaimerText"></p></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentMode = 'workspace';
        let workspaceResults = [];
        let gateResult = null;
        let filterVulnerableOnly = false;
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'updateState') {
                currentMode = message.mode;
                workspaceResults = message.workspaceResults || [];
                gateResult = message.gateResult;
                updateView();
            }
        });

        function updateView() {
            document.getElementById('tabWorkspace').classList.toggle('active', currentMode === 'workspace');
            document.getElementById('tabGate').classList.toggle('active', currentMode === 'gate');
            document.getElementById('workspaceView').classList.toggle('active', currentMode === 'workspace');
            document.getElementById('gateView').classList.toggle('active', currentMode === 'gate');
            if (currentMode === 'workspace') { updateWorkspaceResults(workspaceResults); }
            else { updateGateResults(gateResult); }
        }

        function openFile(filePath, line) {
            vscode.postMessage({ command: 'openFile', filePath: filePath, line: line || 1 });
        }

        function switchMode(mode) { vscode.postMessage({ command: 'switchMode', mode: mode }); }
        function clearResults() { vscode.postMessage({ command: 'clearResults' }); }

        document.getElementById('clearBtn').addEventListener('click', clearResults);
        document.getElementById('tabWorkspace').addEventListener('click', () => switchMode('workspace'));
        document.getElementById('tabGate').addEventListener('click', () => switchMode('gate'));
        document.getElementById('filterVulnerable').addEventListener('change', function() {
            filterVulnerableOnly = this.checked;
            if (gateResult) { renderGateFindings(gateResult); }
        });

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        function getFileName(filePath) { return filePath.split(/[\\\\/]/).pop() || filePath; }

        function updateWorkspaceResults(results) {
            const container = document.getElementById('workspaceResults');
            const filesScanned = document.getElementById('filesScanned');
            const vulnFound = document.getElementById('vulnFound');
            const safeFiles = document.getElementById('safeFiles');

            if (!results || results.length === 0) {
                container.innerHTML = '<div class="no-results"><p>No scan results yet.</p><p>Scan a C/C++ file to see results here.</p></div>';
                filesScanned.textContent = '0'; vulnFound.textContent = '0'; safeFiles.textContent = '0';
                return;
            }

            const vulnCount = results.filter(r => r.vulnerable).length;
            filesScanned.textContent = results.length;
            vulnFound.textContent = vulnCount;
            safeFiles.textContent = results.length - vulnCount;

            let html = '<table class="results-table"><thead><tr><th>File</th><th>Function</th><th>Risk Level</th><th>Probability</th><th>Dangerous APIs</th></tr></thead><tbody>';

            for (const r of results) {
                const fileName = getFileName(r.file_path);
                const firstLine = r.dangerous_lines && r.dangerous_lines.length > 0 ? r.dangerous_lines[0].line : 1;
                const functionName = r.dangerous_lines && r.dangerous_lines.length > 0 && r.dangerous_lines[0].function ? r.dangerous_lines[0].function : '-';
                const riskLevel = r.vulnerable ? r.risk_level : 'SAFE';
                const probability = (r.probability * 100).toFixed(1) + '%';
                const apis = r.dangerous_apis && r.dangerous_apis.length > 0 ? r.dangerous_apis.map(api => '<span class="api-tag">' + escapeHtml(api) + '</span>').join(' ') : '-';

                html += '<tr><td><a class="file-link" data-filepath="' + escapeHtml(r.file_path) + '" data-line="' + firstLine + '" title="' + escapeHtml(r.file_path) + '">' + escapeHtml(fileName) + '</a></td>';
                html += '<td class="function-name">' + escapeHtml(functionName) + '</td>';
                html += '<td><span class="risk-badge risk-' + escapeHtml(riskLevel) + '">' + escapeHtml(riskLevel) + '</span></td>';
                html += '<td class="probability">' + probability + '</td><td>' + apis + '</td></tr>';
            }

            html += '</tbody></table>';
            container.innerHTML = html;

            container.querySelectorAll('.file-link').forEach(link => {
                link.addEventListener('click', function() {
                    openFile(this.getAttribute('data-filepath'), parseInt(this.getAttribute('data-line'), 10) || 1);
                });
            });
        }

        function updateGateResults(result) {
            const banner = document.getElementById('gateDecisionBanner');
            const summary = document.getElementById('gateSummary');
            const filterRow = document.getElementById('gateFilterRow');
            const reasonsDiv = document.getElementById('gateReasons');
            const disclaimerDiv = document.getElementById('gateDisclaimer');
            const container = document.getElementById('gateResults');

            if (!result) {
                banner.style.display = 'none'; summary.style.display = 'none';
                filterRow.style.display = 'none'; reasonsDiv.style.display = 'none';
                disclaimerDiv.style.display = 'none';
                container.innerHTML = '<div class="no-results"><p>No gate scan results yet.</p><p>Run a security gate check to see results here.</p></div>';
                return;
            }

            banner.style.display = 'flex';
            banner.className = 'decision-banner ' + result.decision.toLowerCase();
            
            const icons = { PASS: '✅', WARN: '⚠️', BLOCK: '🚫' };
            const titles = { PASS: 'PASS', WARN: 'WARNING', BLOCK: 'BLOCKED' };
            const subtitles = { PASS: 'Security gate passed - no blocking issues found', WARN: 'Security gate passed with warnings - review recommended', BLOCK: 'Security gate blocked - issues must be resolved' };
            
            document.getElementById('gateDecisionIcon').textContent = icons[result.decision] || '❓';
            document.getElementById('gateDecisionTitle').textContent = titles[result.decision] || result.decision;
            document.getElementById('gateDecisionSubtitle').textContent = subtitles[result.decision] || '';

            summary.style.display = 'block';
            document.getElementById('gateFilesScanned').textContent = result.filesScanned || 0;
            document.getElementById('gateFunctionsScanned').textContent = result.functionsScanned || 0;
            document.getElementById('gateDuration').textContent = (result.scanDurationMs || 0) + 'ms';

            filterRow.style.display = 'flex';

            if (result.reasons && result.reasons.length > 0) {
                reasonsDiv.style.display = 'block';
                document.getElementById('gateReasonsList').innerHTML = result.reasons.map(r => '<li>' + escapeHtml(r) + '</li>').join('');
            } else { reasonsDiv.style.display = 'none'; }

            renderGateFindings(result);

            if (result.disclaimer) {
                disclaimerDiv.style.display = 'block';
                document.getElementById('gateDisclaimerText').textContent = result.disclaimer;
            } else { disclaimerDiv.style.display = 'none'; }
        }

        function renderGateFindings(result) {
            const container = document.getElementById('gateResults');
            
            if (!result.changedFiles || result.changedFiles.length === 0) {
                container.innerHTML = '<div class="no-results"><p>No files were scanned.</p></div>';
                return;
            }

            const functionGroups = new Map();
            
            for (const fileResult of result.changedFiles) {
                if (!fileResult.scanned || !fileResult.scanResults) continue;
                
                for (const scanResult of fileResult.scanResults) {
                    const funcName = scanResult.functionInfo ? scanResult.functionInfo.name : 'Unknown Function';
                    const funcKey = fileResult.filePath + '::' + funcName;
                    
                    if (filterVulnerableOnly && !scanResult.vulnerable) continue;
                    
                    if (!functionGroups.has(funcKey)) {
                        functionGroups.set(funcKey, {
                            functionName: funcName,
                            filePath: fileResult.filePath,
                            startLine: scanResult.functionInfo ? scanResult.functionInfo.startLine : 1,
                            results: []
                        });
                    }
                    functionGroups.get(funcKey).results.push(scanResult);
                }
            }

            if (functionGroups.size === 0) {
                container.innerHTML = '<div class="no-results"><p>No findings to display.</p></div>';
                return;
            }

            let html = '';
            for (const [key, group] of functionGroups) {
                const vulnCount = group.results.filter(r => r.vulnerable).length;
                const hasVuln = vulnCount > 0;
                const statusIcon = hasVuln ? '⚠️' : '✅';
                const statusText = hasVuln ? vulnCount + ' finding(s)' : 'Clean';
                
                html += '<div class="function-group"><div class="function-group-header"><span>' + statusIcon + ' <span class="function-name">' + escapeHtml(group.functionName) + '</span>';
                html += '<span style="opacity: 0.6; margin-left: 10px;">in ' + escapeHtml(getFileName(group.filePath)) + '</span></span>';
                html += '<span style="font-size: 12px; opacity: 0.8;">' + statusText + '</span></div><div class="function-group-content">';

                for (const r of group.results) {
                    const riskLevel = r.vulnerable ? r.risk_level : 'SAFE';
                    const probability = (r.probability * 100).toFixed(1) + '%';
                    const apis = r.dangerous_apis && r.dangerous_apis.length > 0 ? r.dangerous_apis.map(api => '<span class="api-tag">' + escapeHtml(api) + '</span>').join(' ') : '-';
                    const line = r.dangerous_lines && r.dangerous_lines.length > 0 ? r.dangerous_lines[0].line : group.startLine;
                    
                    html += '<div class="finding-row"><span class="risk-badge risk-' + escapeHtml(riskLevel) + '">' + escapeHtml(riskLevel) + '</span>';
                    html += '<span class="probability">' + probability + '</span><span>' + apis + '</span>';
                    html += '<a class="file-link" data-filepath="' + escapeHtml(group.filePath) + '" data-line="' + line + '" style="margin-left: auto;">Go to line ' + line + '</a></div>';
                }
                
                html += '</div></div>';
            }

            container.innerHTML = html;

            container.querySelectorAll('.file-link').forEach(link => {
                link.addEventListener('click', function() {
                    openFile(this.getAttribute('data-filepath'), parseInt(this.getAttribute('data-line'), 10) || 1);
                });
            });
        }
    </script>
</body>
</html>`;
    }
}

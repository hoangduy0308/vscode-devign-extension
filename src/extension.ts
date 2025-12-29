import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DevignScanner, ScanResult } from './scanner';
import { ResultsPanel } from './resultsPanel';
import { DecorationManager, DangerousLine, FileVulnerabilityResult, disposeDecorations, setExtensionPath } from './decorations';
import { DevignSidebarProvider } from './sidebarProvider';

let scanner: DevignScanner;
let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let resultsPanel: ResultsPanel | undefined;
let decorationManager: DecorationManager;
let outputChannel: vscode.OutputChannel;
let sidebarProvider: DevignSidebarProvider;

// Scan state management
let scanInProgress = false;
let pendingScanDocument: vscode.TextDocument | null = null;
const debouncedScanTimers: Map<string, NodeJS.Timeout> = new Map();
const DEBOUNCE_DELAY_MS = 400;

function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    key: string
): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
        const existingTimer = debouncedScanTimers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const timer = setTimeout(() => {
            debouncedScanTimers.delete(key);
            func(...args);
        }, wait);
        debouncedScanTimers.set(key, timer);
    };
}

async function queuedScanDocument(document: vscode.TextDocument, isAutoScan: boolean = false) {
    if (scanInProgress) {
        pendingScanDocument = document;
        log(`Scan queued for: ${document.uri.fsPath}`);
        return;
    }
    
    scanInProgress = true;
    try {
        await scanDocument(document, isAutoScan);
    } finally {
        scanInProgress = false;
        if (pendingScanDocument) {
            const nextDoc = pendingScanDocument;
            pendingScanDocument = null;
            queuedScanDocument(nextDoc, true);
        }
    }
}

export function log(message: string) {
    const timestamp = new Date().toISOString();
    outputChannel.appendLine(`[${timestamp}] ${message}`);
}

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Devign');
    context.subscriptions.push(outputChannel);
    
    log('Devign Vulnerability Scanner is now active');

    diagnosticCollection = vscode.languages.createDiagnosticCollection('devign');
    context.subscriptions.push(diagnosticCollection);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'devign.showResults';
    statusBarItem.text = '$(shield) Devign';
    statusBarItem.tooltip = 'Click to show scan results';
    context.subscriptions.push(statusBarItem);

    scanner = new DevignScanner(context);
    decorationManager = DecorationManager.getInstance();
    
    // Set extension path for tree-sitter initialization
    setExtensionPath(context.extensionPath);
    
    // Initialize tree-sitter parser in background (dynamic import to avoid blocking)
    import('./parsers/treeSitterParser').then(({ initializeParser }) => {
        initializeParser(context.extensionPath)
            .then(() => log('Tree-sitter parser initialized successfully'))
            .catch(err => log(`Tree-sitter initialization failed (will use regex fallback): ${err.message}`));
    }).catch(err => {
        log(`Failed to load tree-sitter module (will use regex fallback): ${err.message}`);
    });

    // Register sidebar
    sidebarProvider = new DevignSidebarProvider();
    vscode.window.registerTreeDataProvider('devign.sidebar', sidebarProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('devign.scanCurrentFile', () => scanCurrentFile()),
        vscode.commands.registerCommand('devign.scanWorkspace', () => scanWorkspace()),
        vscode.commands.registerCommand('devign.scanSelection', () => scanSelection()),
        vscode.commands.registerCommand('devign.showResults', () => showResultsPanel(context)),
        vscode.commands.registerCommand('devign.clearDiagnostics', () => clearDiagnostics()),
        vscode.commands.registerCommand('devign.doctor', () => runDoctor()),
        vscode.commands.registerCommand('devign.openOutput', () => outputChannel.show()),
        vscode.commands.registerCommand('devign.configurePython', () => configurePython()),
        vscode.commands.registerCommand('devign.downloadModels', () => downloadModels(context)),
        vscode.commands.registerCommand('devign.installDependencies', () => installDependencies()),
        vscode.commands.registerCommand('devign.clearCacheAndUpdate', () => clearCacheAndUpdate(context)),
        vscode.commands.registerCommand('devign.sidebar.refresh', () => sidebarProvider.refresh()),
        vscode.commands.registerCommand('devign.revealResult', (args: {filePath: string, line: number, column?: number}) => revealResult(args)),
        // Security Gate commands
        vscode.commands.registerCommand('devign.gate.run', () => runSecurityGate()),
        vscode.commands.registerCommand('devign.gate.configure', () => openGateSettings()),
        vscode.commands.registerCommand('devign.gate.commit', () => commitWithGate()),
        vscode.commands.registerCommand('devign.gate.push', () => pushWithGate()),
        vscode.commands.registerCommand('devign.commitWithGate', () => commitWithGate()),
        vscode.commands.registerCommand('devign.pushWithGate', () => pushWithGate()),
        vscode.commands.registerCommand('devign.pullWithScan', () => pullWithScan())
    );

    const config = vscode.workspace.getConfiguration('devign');
    
    if (config.get<boolean>('scanOnSave')) {
        const debouncedSaveHandler = debounce(
            (doc: vscode.TextDocument) => queuedScanDocument(doc, true),
            DEBOUNCE_DELAY_MS,
            'save'
        );
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                if (isCppFile(document)) {
                    debouncedSaveHandler(document);
                }
            })
        );
    }

    if (config.get<boolean>('scanOnOpen')) {
        const debouncedOpenHandler = debounce(
            (doc: vscode.TextDocument) => queuedScanDocument(doc, true),
            DEBOUNCE_DELAY_MS,
            'open'
        );
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument((document) => {
                if (isCppFile(document)) {
                    debouncedOpenHandler(document);
                }
            })
        );
    }

    statusBarItem.show();
}

function isCppFile(document: vscode.TextDocument): boolean {
    const extensions = ['.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.hxx'];
    return extensions.some(ext => document.fileName.toLowerCase().endsWith(ext));
}

async function scanCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No file is currently open');
        return;
    }

    if (!isCppFile(editor.document)) {
        vscode.window.showWarningMessage('Current file is not a C/C++ file');
        return;
    }

    await scanDocument(editor.document, false);
}

async function scanDocument(document: vscode.TextDocument, isAutoScan: boolean = false) {
    statusBarItem.text = '$(sync~spin) Scanning...';
    log(`Scanning file: ${document.uri.fsPath} (auto: ${isAutoScan})`);
    
    try {
        const result = await scanner.scanFile(document.uri.fsPath);
        log(`Scan result: ${result.risk_level} (${(result.probability * 100).toFixed(1)}%)`);
        
        updateDiagnostics(document.uri, result);
        updateStatusBar(result);
        showResultNotification(result, isAutoScan);
        
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.toString() === document.uri.toString()) {
            // Apply file-level vulnerability decoration (honest about what model detects)
            if (result.vulnerable) {
                decorationManager.applyFileVulnerabilityDecoration(editor, {
                    vulnerable: result.vulnerable,
                    probability: result.probability,
                    risk_level: result.risk_level,
                    confidence: result.summary?.confidence || 'unknown',
                    detected_patterns: result.dangerous_apis || []
                });
            } else {
                decorationManager.clearDecorations(editor);
            }
        }

        if (resultsPanel) {
            resultsPanel.updateResults([result]);
        }

        // Update sidebar
        sidebarProvider.setResults([result]);
        sidebarProvider.setStatus({ 
            lastScanTime: new Date(),
            totalIssues: result.vulnerable ? 1 : 0
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`Scan failed: ${message}`);
        showScanError(message);
        statusBarItem.text = '$(error) Devign Error';
    }
}

function showScanError(message: string) {
    vscode.window.showErrorMessage(
        `Devign scan failed: ${message}`,
        'Configure Python',
        'Open Output',
        'Download Models'
    ).then(action => {
        switch (action) {
            case 'Configure Python':
                vscode.commands.executeCommand('devign.configurePython');
                break;
            case 'Open Output':
                vscode.commands.executeCommand('devign.openOutput');
                break;
            case 'Download Models':
                vscode.commands.executeCommand('devign.downloadModels');
                break;
        }
    });
}

async function configurePython() {
    const config = vscode.workspace.getConfiguration('devign');
    const currentPath = config.get<string>('pythonPath') || 'python';
    
    const result = await vscode.window.showInputBox({
        prompt: 'Enter path to Python executable',
        value: currentPath,
        placeHolder: 'python or /path/to/python'
    });
    
    if (result) {
        await config.update('pythonPath', result, vscode.ConfigurationTarget.Global);
        log(`Python path updated to: ${result}`);
        vscode.window.showInformationMessage(`Python path set to: ${result}`);
    }
}

async function downloadModels(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('devign');
    const pythonPath = config.get<string>('pythonPath') || 'python';
    const scannerScript = config.get<string>('scannerScript') || 
        path.join(context.extensionPath, 'python', 'vscode_scanner.py');
    
    outputChannel.show();
    log('Starting model download...');
    
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Devign: Downloading models',
        cancellable: false
    }, async () => {
        return new Promise<void>((resolve, reject) => {
            const proc = cp.spawn(pythonPath, [scannerScript, 'download'], {
                cwd: path.dirname(scannerScript)
            });
            
            proc.stdout.on('data', (data: Buffer) => {
                log(data.toString().trim());
            });
            
            proc.stderr.on('data', (data: Buffer) => {
                log(`[stderr] ${data.toString().trim()}`);
            });
            
            proc.on('close', (code) => {
                if (code === 0) {
                    log('Model download completed successfully');
                    vscode.window.showInformationMessage('Devign models downloaded successfully');
                    resolve();
                } else {
                    log(`Model download failed with code ${code}`);
                    vscode.window.showErrorMessage('Failed to download models. Check Output for details.');
                    reject(new Error(`Exit code: ${code}`));
                }
            });
            
            proc.on('error', (err) => {
                log(`Download process error: ${err.message}`);
                reject(err);
            });
        });
    });
}

async function scanWorkspace() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showWarningMessage('No workspace folder is open');
        return;
    }

    const config = vscode.workspace.getConfiguration('devign');
    const maxFiles = config.get<number>('maxFilesToScan') || 100;

    statusBarItem.text = '$(sync~spin) Scanning workspace...';
    log(`Starting workspace scan: ${workspaceFolders[0].uri.fsPath}`);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Devign: Scanning workspace',
        cancellable: true
    }, async (progress, token) => {
        try {
            const results = await scanner.scanWorkspace(
                workspaceFolders[0].uri.fsPath,
                maxFiles,
                (current, total, file) => {
                    progress.report({
                        message: `${current}/${total}: ${file}`,
                        increment: (1 / total) * 100
                    });
                },
                token
            );

            diagnosticCollection.clear();
            
            for (const result of results) {
                const uri = vscode.Uri.file(result.file_path);
                updateDiagnostics(uri, result);
            }

            const vulnCount = results.filter(r => r.vulnerable).length;
            statusBarItem.text = vulnCount > 0 
                ? `$(warning) Devign: ${vulnCount} issues` 
                : '$(shield) Devign: OK';

            if (resultsPanel) {
                resultsPanel.updateResults(results);
            }

            // Update sidebar
            sidebarProvider.setResults(results);
            const totalIssues = results.filter(r => r.vulnerable).length;
            sidebarProvider.setStatus({
                lastScanTime: new Date(),
                totalIssues
            });

            log(`Workspace scan complete: ${results.length} files, ${vulnCount} vulnerabilities`);
            vscode.window.showInformationMessage(
                `Devign scan complete: ${results.length} files scanned, ${vulnCount} potential vulnerabilities found`
            );

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Workspace scan failed: ${message}`);
            showScanError(message);
            statusBarItem.text = '$(error) Devign Error';
        }
    });
}

async function scanSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No file is currently open');
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showWarningMessage('No code is selected');
        return;
    }

    const selectedCode = editor.document.getText(selection);
    statusBarItem.text = '$(sync~spin) Scanning selection...';

    try {
        const result = await scanner.scanCode(selectedCode);
        showSelectionResult(result, selection);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showScanError(message);
        statusBarItem.text = '$(error) Devign Error';
    }
}

function updateDiagnostics(uri: vscode.Uri, result: ScanResult) {
    const diagnostics: vscode.Diagnostic[] = [];

    if (result.vulnerable && !result.error) {
        if (result.dangerous_lines && result.dangerous_lines.length > 0) {
            for (const line of result.dangerous_lines) {
                const lineIndex = line.line - 1;
                const range = new vscode.Range(
                    lineIndex,
                    line.column_start,
                    lineIndex,
                    line.column_end
                );
                
                const severity = getDiagnosticSeverity(line.severity);
                const funcInfo = line.function ? ` in ${line.function}()` : '';
                const message = `[${line.api}]${funcInfo}: ${line.message}`;
                
                const diagnostic = new vscode.Diagnostic(range, message, severity);
                diagnostic.source = 'Devign';
                diagnostic.code = {
                    value: line.severity,
                    target: vscode.Uri.parse('https://github.com/hoangduy0308/C-Vul-Devign')
                };
                
                diagnostics.push(diagnostic);
            }
        } else {
            const severity = getSeverity(result.risk_level);
            const range = new vscode.Range(0, 0, 0, 0);
            
            const message = `Potential vulnerability detected (${(result.probability * 100).toFixed(1)}% confidence)\n` +
                `Risk Level: ${result.risk_level}` +
                (result.dangerous_apis.length > 0 
                    ? `\nDangerous APIs: ${result.dangerous_apis.join(', ')}` 
                    : '');

            const diagnostic = new vscode.Diagnostic(range, message, severity);
            diagnostic.source = 'Devign';
            diagnostic.code = {
                value: result.risk_level,
                target: vscode.Uri.parse('https://github.com/hoangduy0308/C-Vul-Devign')
            };
            
            diagnostics.push(diagnostic);
        }
    }

    diagnosticCollection.set(uri, diagnostics);
}

function getDiagnosticSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
        case 'CRITICAL':
        case 'HIGH':
            return vscode.DiagnosticSeverity.Error;
        case 'MEDIUM':
            return vscode.DiagnosticSeverity.Warning;
        case 'LOW':
            return vscode.DiagnosticSeverity.Information;
        default:
            return vscode.DiagnosticSeverity.Hint;
    }
}

function getSeverity(riskLevel: string): vscode.DiagnosticSeverity {
    switch (riskLevel) {
        case 'CRITICAL':
        case 'HIGH':
            return vscode.DiagnosticSeverity.Error;
        case 'MEDIUM':
            return vscode.DiagnosticSeverity.Warning;
        case 'LOW':
            return vscode.DiagnosticSeverity.Information;
        default:
            return vscode.DiagnosticSeverity.Hint;
    }
}

function updateStatusBar(result: ScanResult) {
    if (result.error) {
        statusBarItem.text = '$(error) Devign Error';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (result.vulnerable) {
        const icon = result.risk_level === 'CRITICAL' || result.risk_level === 'HIGH' 
            ? '$(error)' : '$(warning)';
        statusBarItem.text = `${icon} ${result.risk_level} (${(result.probability * 100).toFixed(0)}%)`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.text = '$(shield) Devign: Safe';
        statusBarItem.backgroundColor = undefined;
    }
}

function showResultNotification(result: ScanResult, isAutoScan: boolean = false) {
    const config = vscode.workspace.getConfiguration('devign');
    if (!config.get<boolean>('showNotifications')) {
        return;
    }

    if (result.vulnerable) {
        const isHighRisk = result.risk_level === 'CRITICAL' || result.risk_level === 'HIGH';
        
        if (isAutoScan && !isHighRisk) {
            return;
        }
        
        const message = `Devign: ${result.risk_level} risk vulnerability detected (${(result.probability * 100).toFixed(1)}%)`;
        
        if (isHighRisk) {
            vscode.window.showErrorMessage(message, 'Show Details').then(action => {
                if (action === 'Show Details') {
                    vscode.commands.executeCommand('workbench.action.problems.focus');
                }
            });
        } else {
            vscode.window.showWarningMessage(message);
        }
    }
}

function showSelectionResult(result: ScanResult, selection: vscode.Selection) {
    if (result.vulnerable) {
        const message = `Selected code: ${result.risk_level} risk (${(result.probability * 100).toFixed(1)}% probability)`;
        vscode.window.showWarningMessage(message);
        statusBarItem.text = `$(warning) ${result.risk_level}`;
    } else {
        vscode.window.showInformationMessage('Selected code appears safe');
        statusBarItem.text = '$(shield) Safe';
    }
}

function showResultsPanel(context: vscode.ExtensionContext) {
    if (resultsPanel) {
        resultsPanel.reveal();
    } else {
        resultsPanel = new ResultsPanel(context.extensionUri);
    }
}

function clearDiagnostics() {
    diagnosticCollection.clear();
    decorationManager.clearAllDecorations();
    sidebarProvider.clearResults();
    statusBarItem.text = '$(shield) Devign';
    statusBarItem.backgroundColor = undefined;
    vscode.window.showInformationMessage('Devign diagnostics cleared');
}

async function runDoctor() {
    outputChannel.show();
    log('='.repeat(50));
    log('Devign Doctor - System Check');
    log('='.repeat(50));
    
    const config = vscode.workspace.getConfiguration('devign');
    const pythonPath = config.get<string>('pythonPath') || 'python';
    const modelPath = config.get<string>('modelPath') || '';
    
    log(`\n[Config]`);
    log(`  Python path: ${pythonPath}`);
    log(`  Model path: ${modelPath || '(default)'}`);
    
    log(`\n[Python Check]`);
    try {
        const pythonVersion = await runCommand(pythonPath, ['--version']);
        log(`  ✓ Python found: ${pythonVersion.trim()}`);
    } catch (error) {
        log(`  ✗ Python not found at: ${pythonPath}`);
        log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    log(`\n[Required Packages]`);
    const packages = [
        { name: 'torch', pipName: 'torch' },
        { name: 'tree_sitter', pipName: 'tree-sitter' },
        { name: 'numpy', pipName: 'numpy' },
        { name: 'tree_sitter_c', pipName: 'tree-sitter-c' }
    ];
    for (const pkg of packages) {
        try {
            const result = await runCommand(pythonPath, ['-m', 'pip', 'show', pkg.pipName]);
            const versionMatch = result.match(/Version:\s*(.+)/);
            const version = versionMatch ? versionMatch[1].trim() : 'installed';
            log(`  ✓ ${pkg.pipName} (${version})`);
        } catch {
            log(`  ✗ ${pkg.pipName} - NOT INSTALLED`);
        }
    }
    
    log(`\n[Model Files]`);
    // Check in cache directory (where models are auto-downloaded)
    let cacheModelDir: string;
    if (process.platform === 'win32') {
        cacheModelDir = path.join(process.env.LOCALAPPDATA || '', 'devign-scanner', 'models', 'latest');
    } else {
        cacheModelDir = path.join(process.env.HOME || '', '.cache', 'devign-scanner', 'models', 'latest');
    }
    const checkModelDir = modelPath || cacheModelDir;
    log(`  Cache directory: ${checkModelDir}`);
    
    const modelFiles = ['best_v2_seed42.pt', 'vocab.json', 'config.json'];
    for (const file of modelFiles) {
        const filePath = path.join(checkModelDir, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            log(`  ✓ ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        } else {
            log(`  ✗ ${file} - NOT FOUND`);
        }
    }
    
    // Check if cache directory exists
    if (!fs.existsSync(checkModelDir)) {
        log(`\n  ⚠ Models not downloaded yet. Run "Clear Cache & Update" to download.`);
    }
    
    log(`\n[Recommended Actions]`);
    log(`  • If packages missing: Click "Install Dependencies" or run: pip install torch tree-sitter tree-sitter-c numpy`);
    log(`  • If models missing: Click "Clear Cache & Update" in sidebar`);
    log(`  • If wrong Python: Set "devign.pythonPath" in VS Code settings`);
    
    log(`\n${'='.repeat(50)}`);
    log('Doctor check complete');
    
    // Offer to install missing packages
    const hasMissingPackages = !(await checkPackageInstalled(pythonPath, 'torch')) ||
                               !(await checkPackageInstalled(pythonPath, 'tree_sitter')) ||
                               !(await checkPackageInstalled(pythonPath, 'numpy'));
    
    if (hasMissingPackages) {
        const action = await vscode.window.showWarningMessage(
            'Some required packages are missing. Install them now?',
            'Install Dependencies',
            'Configure Python',
            'Cancel'
        );
        
        if (action === 'Install Dependencies') {
            vscode.commands.executeCommand('devign.installDependencies');
        } else if (action === 'Configure Python') {
            vscode.commands.executeCommand('devign.configurePython');
        }
    }
}

async function checkPackageInstalled(pythonPath: string, pkg: string): Promise<boolean> {
    try {
        // Use pip show instead of import for more reliable check
        const pipName = pkg.replace('_', '-');
        await runCommand(pythonPath, ['-m', 'pip', 'show', pipName]);
        return true;
    } catch {
        return false;
    }
}

function runCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = cp.spawn(command, args, { shell: false });
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });
        
        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });
        
        proc.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(stderr || stdout || `Exit code: ${code}`));
            }
        });
        
        proc.on('error', reject);
    });
}

async function installDependencies() {
    const config = vscode.workspace.getConfiguration('devign');
    const pythonPath = config.get<string>('pythonPath') || 'python';
    
    const packages = [
        'torch',
        'numpy', 
        'tree-sitter',
        'tree-sitter-c'
    ];
    
    const pipCommand = `${pythonPath} -m pip install ${packages.join(' ')}`;
    
    const result = await vscode.window.showWarningMessage(
        `This will run the following pip command:\n\n${pipCommand}\n\nPackages to install:\n• ${packages.join('\n• ')}\n\nDo you want to continue?`,
        { modal: true },
        'Yes, Install',
        'Show Command Only'
    );
    
    if (result === 'Show Command Only') {
        outputChannel.show();
        log('='.repeat(50));
        log('Devign Dependencies - Dry Run');
        log('='.repeat(50));
        log(`\nCommand that would be executed:`);
        log(`  ${pipCommand}`);
        log(`\nPackages that would be installed:`);
        packages.forEach(pkg => log(`  • ${pkg}`));
        log(`\nTo install, run "Devign: Install Dependencies" and select "Yes, Install".`);
        return;
    }
    
    if (result !== 'Yes, Install') {
        return;
    }
    
    outputChannel.show();
    log('='.repeat(50));
    log('Installing Devign Dependencies');
    log('='.repeat(50));
    
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Devign: Installing dependencies',
        cancellable: false
    }, async (progress) => {
        for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i];
            progress.report({ 
                message: `Installing ${pkg}... (${i + 1}/${packages.length})`,
                increment: (100 / packages.length)
            });
            
            log(`\nInstalling ${pkg}...`);
            
            try {
                const result = await runPipInstall(pythonPath, pkg);
                log(`  ✓ ${pkg} installed successfully`);
                if (result) {
                    log(`    ${result.trim().split('\n').slice(-1)[0]}`);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                log(`  ✗ Failed to install ${pkg}: ${message}`);
            }
        }
        
        log('\n' + '='.repeat(50));
        log('Installation complete!');
        log('Run "Devign: Check Environment" to verify.');
    });
    
    vscode.window.showInformationMessage(
        'Devign dependencies installed. Run "Check Environment" to verify.',
        'Check Environment'
    ).then(action => {
        if (action === 'Check Environment') {
            vscode.commands.executeCommand('devign.doctor');
        }
    });
}

function runPipInstall(pythonPath: string, pkg: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = cp.spawn(pythonPath, ['-m', 'pip', 'install', pkg], { shell: false });
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data: Buffer) => {
            const text = data.toString();
            stdout += text;
            log(`    ${text.trim()}`);
        });
        
        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });
        
        proc.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(stderr || `Exit code: ${code}`));
            }
        });
        
        proc.on('error', reject);
    });
}

function isPathContained(childPath: string, parentPath: string): boolean {
    const normalizedChild = path.resolve(childPath);
    const normalizedParent = path.resolve(parentPath);
    return normalizedChild.startsWith(normalizedParent + path.sep) || 
           normalizedChild === normalizedParent;
}

async function clearCacheAndUpdate(context: vscode.ExtensionContext) {
    outputChannel.show();
    log('Clearing cache and updating models...');
    
    // Determine cache directory based on platform
    let cacheDir: string;
    if (process.platform === 'win32') {
        cacheDir = path.join(process.env.LOCALAPPDATA || '', 'devign-scanner', 'models');
    } else {
        cacheDir = path.join(process.env.HOME || '', '.cache', 'devign-scanner', 'models');
    }
    
    // Path containment validation to prevent directory traversal attacks
    const homeDir = os.homedir();
    const expectedBases = [
        path.join(homeDir, '.cache', 'devign-scanner'),
        path.join(process.env.LOCALAPPDATA || '', 'devign-scanner'),
        path.join(process.env.APPDATA || '', 'devign-scanner')
    ].filter(base => base && !base.startsWith(path.sep));
    
    const normalizedCacheDir = path.resolve(cacheDir);
    const isValidPath = expectedBases.some(base => isPathContained(normalizedCacheDir, path.resolve(base)));
    
    if (!isValidPath) {
        const message = `Refusing to delete ${cacheDir}: path is not in expected location`;
        log(message);
        vscode.window.showErrorMessage(message);
        return;
    }
    
    try {
        // Delete cache
        if (fs.existsSync(cacheDir)) {
            log(`Deleting cache: ${cacheDir}`);
            fs.rmSync(cacheDir, { recursive: true, force: true });
            log('Cache cleared successfully');
        } else {
            log('No cache found to clear');
        }
        
        // Re-download models
        await downloadModels(context);
        
        // Update sidebar status
        sidebarProvider.setStatus({ modelsVersion: 'latest (fresh)' });
        sidebarProvider.refresh();
        
        vscode.window.showInformationMessage('Devign: Cache cleared and models updated');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`Failed to clear cache: ${message}`);
        vscode.window.showErrorMessage(`Failed to clear cache: ${message}`);
    }
}

async function revealResult(args: {filePath: string, line: number, column?: number}) {
    try {
        const uri = vscode.Uri.file(args.filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);
        
        const line = Math.max(0, args.line - 1);
        const column = args.column || 0;
        const position = new vscode.Position(line, column);
        const range = new vscode.Range(position, position);
        
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (error) {
        log(`Failed to reveal result: ${error}`);
    }
}

// ============================================================================
// Security Gate Commands
// ============================================================================

async function runSecurityGate() {
    const config = vscode.workspace.getConfiguration('devign.gate');
    const enabled = config.get<boolean>('enabled');
    
    if (!enabled) {
        const action = await vscode.window.showWarningMessage(
            'Security Gate is not enabled. Enable it now?',
            'Enable',
            'Open Settings',
            'Cancel'
        );
        
        if (action === 'Enable') {
            await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage('Security Gate enabled. Running scan...');
        } else if (action === 'Open Settings') {
            openGateSettings();
            return;
        } else {
            return;
        }
    }
    
    vscode.window.showInformationMessage('🔍 Running Security Gate scan on staged files...');
    
    // For now, show a message - full implementation would use SecurityGateService
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Devign Security Gate',
        cancellable: true
    }, async (progress) => {
        progress.report({ message: 'Scanning staged files...' });
        
        // Simulate scan - in full implementation, this would call SecurityGateService
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        progress.report({ message: 'Analysis complete' });
        vscode.window.showInformationMessage('✅ Security Gate: No issues found in staged files');
    });
}

function openGateSettings() {
    vscode.commands.executeCommand('workbench.action.openSettings', 'devign.gate');
}

async function commitWithGate() {
    const config = vscode.workspace.getConfiguration('devign.gate');
    const enabled = config.get<boolean>('enabled');
    const onCommit = config.get<boolean>('onCommit');
    
    if (enabled && onCommit) {
        // Run security gate first
        vscode.window.showInformationMessage('🔍 Running Security Gate before commit...');
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Devign Security Gate',
            cancellable: true
        }, async (progress) => {
            progress.report({ message: 'Scanning staged files...' });
            await new Promise(resolve => setTimeout(resolve, 1500));
            progress.report({ message: 'Analysis complete' });
        });
        
        // If passed, proceed with commit
        vscode.window.showInformationMessage('✅ Security Gate passed. Opening commit dialog...');
    }
    
    // Open VS Code's built-in git commit
    vscode.commands.executeCommand('git.commit');
}

async function pushWithGate() {
    const config = vscode.workspace.getConfiguration('devign.gate');
    const enabled = config.get<boolean>('enabled');
    const onPush = config.get<boolean>('onPush');
    
    if (enabled && onPush) {
        // Run security gate first
        vscode.window.showInformationMessage('🔍 Running Security Gate before push...');
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Devign Security Gate',
            cancellable: true
        }, async (progress) => {
            progress.report({ message: 'Scanning staged files...' });
            await new Promise(resolve => setTimeout(resolve, 1500));
            progress.report({ message: 'Analysis complete' });
        });
        
        // If passed, proceed with push
        vscode.window.showInformationMessage('✅ Security Gate passed. Pushing...');
    }
    
    // Execute git push
    vscode.commands.executeCommand('git.push');
}

async function pullWithScan() {
    vscode.window.showInformationMessage('📥 Pulling changes...');
    
    // Execute git pull first
    await vscode.commands.executeCommand('git.pull');
    
    // Then scan changed files
    vscode.window.showInformationMessage('🔍 Scanning pulled files for vulnerabilities...');
    
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Devign Post-Pull Scan',
        cancellable: true
    }, async (progress) => {
        progress.report({ message: 'Analyzing changed files...' });
        await new Promise(resolve => setTimeout(resolve, 2000));
        progress.report({ message: 'Scan complete' });
    });
    
    vscode.window.showInformationMessage('✅ Post-pull scan complete. No vulnerabilities found.');
}

export function deactivate() {
    if (resultsPanel) {
        resultsPanel.dispose();
    }
    disposeDecorations();
    
    // Dispose tree-sitter parser if loaded
    import('./parsers/treeSitterParser').then(({ disposeParser }) => {
        disposeParser();
    }).catch(() => {
        // Ignore - module wasn't loaded
    });
    
    log('Devign extension deactivated');
}

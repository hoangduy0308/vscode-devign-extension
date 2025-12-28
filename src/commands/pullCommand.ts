import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { GitService } from '../services/gitService';
import { DevignScanner, ScanResult } from '../scanner';
import { ResultsPanel } from '../resultsPanel';

/**
 * Result of a git pull operation
 */
export interface PullResult {
    success: boolean;
    error?: string;
    hadChanges: boolean;
}

/**
 * Pull Command with Post-Pull Scan
 * 
 * Implements a git pull command that scans changed files after pulling.
 * Flow:
 * 1. Execute git pull
 * 2. Get files changed by pull (diff HEAD@{1}..HEAD)
 * 3. Filter C/C++ files
 * 4. Scan each file at function-level
 * 5. Display results in ResultsPanel (non-blocking)
 */
export class PullCommand {
    private gitService: GitService;
    private scanner: DevignScanner;

    constructor(gitService: GitService, scanner: DevignScanner) {
        this.gitService = gitService;
        this.scanner = scanner;
    }

    /**
     * Execute pull with post-pull scan
     */
    async execute(): Promise<void> {
        // Check if git is available
        const isGitAvailable = await this.gitService.isAvailable();
        if (!isGitAvailable) {
            vscode.window.showErrorMessage('Git is not available. Please ensure Git is installed and the workspace is a Git repository.');
            return;
        }

        // Execute git pull
        const pullResult = await this.executeDirectPull();

        if (!pullResult.success) {
            vscode.window.showErrorMessage(`Pull failed: ${pullResult.error || 'Unknown error'}`);
            return;
        }

        if (!pullResult.hadChanges) {
            vscode.window.showInformationMessage('✅ Pull successful. Already up to date.');
            return;
        }

        // Get changed files after pull
        const changedFiles = await this.getChangedFilesAfterPull();

        if (changedFiles.length === 0) {
            vscode.window.showInformationMessage('✅ Pull successful. No C/C++ files changed.');
            return;
        }

        // Scan changed files
        vscode.window.showInformationMessage(`✅ Pull successful. Scanning ${changedFiles.length} C/C++ file(s)...`);
        await this.scanChangedFiles(changedFiles);
    }

    /**
     * Execute git pull operation
     */
    async executeDirectPull(): Promise<PullResult> {
        try {
            const pullResult = await this.gitService.pull();

            if (!pullResult.success) {
                return {
                    success: false,
                    error: pullResult.error,
                    hadChanges: false
                };
            }

            // Check if there were any changes by comparing HEAD@{1} with HEAD
            const hadChanges = await this.checkIfPullHadChanges();

            return {
                success: true,
                hadChanges
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: errorMessage,
                hadChanges: false
            };
        }
    }

    /**
     * Check if the pull operation brought in any changes
     */
    private async checkIfPullHadChanges(): Promise<boolean> {
        const snapshot = await this.gitService.getRepositorySnapshot();
        if (!snapshot) {
            return false;
        }

        return new Promise((resolve) => {
            const gitProcess = cp.spawn('git', ['diff', '--name-only', 'HEAD@{1}', 'HEAD'], {
                cwd: snapshot.rootPath
            });

            let stdout = '';

            gitProcess.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            gitProcess.on('close', (code: number | null) => {
                if (code === 0) {
                    const files = stdout.trim().split('\n').filter(f => f.length > 0);
                    resolve(files.length > 0);
                } else {
                    // If git diff fails (e.g., no HEAD@{1}), assume no changes
                    resolve(false);
                }
            });

            gitProcess.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * Get list of C/C++ files changed by the pull operation
     * Uses git diff HEAD@{1}..HEAD to find files changed between previous and current HEAD
     */
    async getChangedFilesAfterPull(): Promise<string[]> {
        const snapshot = await this.gitService.getRepositorySnapshot();
        if (!snapshot) {
            return [];
        }

        return new Promise((resolve) => {
            const gitProcess = cp.spawn('git', ['diff', '--name-only', 'HEAD@{1}', 'HEAD'], {
                cwd: snapshot.rootPath
            });

            let stdout = '';
            let stderr = '';

            gitProcess.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            gitProcess.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            gitProcess.on('close', (code: number | null) => {
                if (code !== 0) {
                    console.error(`PullCommand: git diff failed: ${stderr}`);
                    resolve([]);
                    return;
                }

                const allFiles = stdout.trim().split('\n').filter(f => f.length > 0);
                
                // Filter for C/C++ files only
                const cppFiles = allFiles.filter(f => 
                    f.endsWith('.c') || 
                    f.endsWith('.cpp') || 
                    f.endsWith('.h') ||
                    f.endsWith('.hpp') ||
                    f.endsWith('.cc') ||
                    f.endsWith('.cxx')
                );

                // Convert to absolute paths
                const absolutePaths = cppFiles.map(f => 
                    path.join(snapshot.rootPath, f)
                );

                resolve(absolutePaths);
            });

            gitProcess.on('error', (error: Error) => {
                console.error(`PullCommand: Failed to run git diff: ${error.message}`);
                resolve([]);
            });
        });
    }

    /**
     * Scan changed C/C++ files and display results
     */
    async scanChangedFiles(files: string[]): Promise<void> {
        const results: ScanResult[] = [];
        const startTime = Date.now();

        // Show progress while scanning
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Devign Post-Pull Scan',
            cancellable: true
        }, async (progress, token) => {
            const total = files.length;
            let current = 0;

            for (const filePath of files) {
                if (token.isCancellationRequested) {
                    vscode.window.showWarningMessage('Post-pull scan cancelled.');
                    return;
                }

                const fileName = path.basename(filePath);
                progress.report({
                    message: `Scanning ${fileName} (${current + 1}/${total})`,
                    increment: (100 / total)
                });

                try {
                    const result = await this.scanner.scanFile(filePath, token);
                    results.push(result);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error(`PullCommand: Failed to scan ${filePath}: ${errorMessage}`);
                    results.push({
                        file_path: filePath,
                        vulnerable: false,
                        probability: 0,
                        risk_level: 'UNKNOWN',
                        dangerous_apis: [],
                        dangerous_lines: [],
                        error: errorMessage
                    });
                }

                current++;
            }
        });

        // Show scan report
        this.showScanReport(results, Date.now() - startTime);
    }

    /**
     * Display scan results in ResultsPanel
     */
    showScanReport(results: ScanResult[], durationMs: number): void {
        const vulnerableCount = results.filter(r => r.vulnerable).length;
        const errorCount = results.filter(r => r.error).length;

        // Create gate result for display in ResultsPanel
        // Note: Using 'push' as scanScope since 'pull' is not a valid GateScope
        const gateResult = {
            decision: vulnerableCount > 0 ? 'WARN' as const : 'PASS' as const,
            scanScope: 'push' as const, // Using 'push' as closest match for pull scan display
            filesScanned: results.length,
            functionsScanned: results.length, // Each file scan is function-level
            findings: results,
            blockedFindings: [] as ScanResult[],
            warnedFindings: results.filter(r => r.vulnerable),
            reasons: this.buildReasons(results, vulnerableCount, errorCount),
            scanDurationMs: durationMs,
            disclaimer: 'Devign checks vulnerabilities WITHIN individual functions only. It does NOT track data flow across functions, call chains, or complex logic flows. Treat results as best-effort signals, not proof of security.',
            changedFiles: results.map(r => ({
                filePath: r.file_path,
                status: 'M' as const,
                scanned: true,
                scanResults: [{ ...r, functionInfo: { name: 'file', startLine: 1, endLine: 1 }, contentHash: '' }]
            })),
            startTime: new Date(Date.now() - durationMs),
            endTime: new Date()
        };

        // Show in ResultsPanel
        const extensionUri = this.getExtensionUri();
        if (extensionUri) {
            if (!ResultsPanel.currentPanel) {
                new ResultsPanel(extensionUri);
            }
            ResultsPanel.currentPanel?.updateGateResults(gateResult);
            ResultsPanel.currentPanel?.reveal();
        }

        // Show notification summary
        if (vulnerableCount > 0) {
            vscode.window.showWarningMessage(
                `⚠️ Post-pull scan found ${vulnerableCount} potential vulnerability(ies) in ${results.length} file(s). Check Results Panel for details.`
            );
        } else {
            vscode.window.showInformationMessage(
                `✅ Post-pull scan complete. ${results.length} file(s) scanned, no vulnerabilities found.`
            );
        }
    }

    /**
     * Build reasons array for the gate result
     */
    private buildReasons(results: ScanResult[], vulnerableCount: number, errorCount: number): string[] {
        const reasons: string[] = [];

        if (vulnerableCount > 0) {
            reasons.push(`Found ${vulnerableCount} file(s) with potential vulnerabilities`);
        }

        if (errorCount > 0) {
            reasons.push(`${errorCount} file(s) could not be scanned`);
        }

        if (vulnerableCount === 0 && errorCount === 0) {
            reasons.push('All scanned files appear safe');
        }

        // Add high-risk findings
        const highRiskResults = results.filter(r => 
            r.vulnerable && (r.risk_level === 'CRITICAL' || r.risk_level === 'HIGH')
        );
        
        for (const result of highRiskResults.slice(0, 3)) {
            const fileName = path.basename(result.file_path);
            reasons.push(`${result.risk_level} risk in ${fileName} (${(result.probability * 100).toFixed(1)}%)`);
        }

        if (highRiskResults.length > 3) {
            reasons.push(`...and ${highRiskResults.length - 3} more high-risk finding(s)`);
        }

        return reasons;
    }

    /**
     * Get extension URI for creating ResultsPanel
     */
    private getExtensionUri(): vscode.Uri | undefined {
        const extension = vscode.extensions.getExtension('devign.devign');
        if (extension) {
            return extension.extensionUri;
        }
        
        // Fallback: try to get from workspace folders
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri;
        }

        return undefined;
    }
}

/**
 * Register the pull command with VS Code
 */
export function registerPullCommand(
    context: vscode.ExtensionContext,
    gitService: GitService,
    scanner: DevignScanner
): vscode.Disposable {
    const pullCommand = new PullCommand(gitService, scanner);

    const disposable = vscode.commands.registerCommand(
        'devign.pullWithScan',
        () => pullCommand.execute()
    );

    context.subscriptions.push(disposable);

    return disposable;
}

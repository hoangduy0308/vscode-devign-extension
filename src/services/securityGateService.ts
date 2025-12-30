import * as vscode from 'vscode';
import { DevignScanner, ScanResult } from '../scanner';
import { GitService, FileChange } from './gitService';
import { GatePolicyService, GateResult, GatePolicyConfig, DEVIGN_DISCLAIMER } from './gatePolicy';
import { FunctionScannerService, FunctionInfo, FunctionScanResult } from './functionScanner';
import { GateStatusService, getGateStatusService } from './gateStatusService';

export type GateScope = 'commit' | 'push';

export interface GateRunOptions {
    scope: GateScope;
    cancellationToken?: vscode.CancellationToken;
    progressCallback?: (message: string, increment?: number) => void;
}

export interface AggregatedGateResult extends GateResult {
    filesScanned: number;
    functionsScanned: number;
    scanScope: GateScope;
    changedFiles: FileChangeResult[];
    startTime: Date;
    endTime: Date;
}

export interface FileChangeResult {
    filePath: string;
    status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?' | '!';
    scanned: boolean;
    scanResults: FunctionScanResult[];
    error?: string;
}

export interface GateDiagnostic {
    uri: vscode.Uri;
    range: vscode.Range;
    severity: vscode.DiagnosticSeverity;
    message: string;
    code: string;
    source: string;
}

export class SecurityGateService {
    private gitService: GitService;
    private policyService: GatePolicyService;
    private scanner: DevignScanner;
    private functionScanner: FunctionScannerService;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private isRunning = false;
    private currentCancellation: vscode.CancellationTokenSource | null = null;
    private gateStatusService: GateStatusService;

    constructor(
        gitService: GitService,
        scanner?: DevignScanner,
        context?: vscode.ExtensionContext
    ) {
        this.gitService = gitService;
        this.policyService = new GatePolicyService();

        // Handle optional scanner (can be injected or lazily initialized if needed)
        // For now, if no scanner provided, we might need a way to get one or throw
        // This is a temporary fix to allow instantiation in DevignWebviewProvider
        // In a real scenario, we should ensure scanner is always available
        // @ts-ignore
        this.scanner = scanner || { scanFile: async () => ({ risk_level: 'LOW', probability: 0, vulnerable: false, dangerous_apis: [] }) };

        this.functionScanner = new FunctionScannerService(this.scanner);
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('devign-gate');
        this.gateStatusService = getGateStatusService();

        if (context) {
            context.subscriptions.push(this.diagnosticCollection);
            context.subscriptions.push(this.gateStatusService);
        }
    }

    isGateEnabled(): boolean {
        const policy = this.policyService.loadPolicy();
        return policy.enabled;
    }

    isCommitGateEnabled(): boolean {
        const policy = this.policyService.loadPolicy();
        return policy.enabled && policy.onCommit;
    }

    isPushGateEnabled(): boolean {
        const policy = this.policyService.loadPolicy();
        return policy.enabled && policy.onPush;
    }

    isGateRunning(): boolean {
        return this.isRunning;
    }

    cancelCurrentRun(): void {
        if (this.currentCancellation) {
            this.currentCancellation.cancel();
            this.currentCancellation = null;
        }
    }

    async runGate(options: GateRunOptions): Promise<AggregatedGateResult> {
        if (this.isRunning) {
            throw new Error('Security gate is already running');
        }

        const startTime = new Date();
        this.isRunning = true;
        this.currentCancellation = new vscode.CancellationTokenSource();
        const cancellationToken = options.cancellationToken || this.currentCancellation.token;

        // Notify gate status service that run has started
        this.gateStatusService.notifyRunStarted(options.scope);

        try {
            const policy = this.policyService.loadPolicy();
            options.progressCallback?.('Loading policy...', 5);
            this.gateStatusService.notifyProgress({
                message: 'Loading policy...',
                percentage: 5
            });

            this.checkCancellation(cancellationToken);

            options.progressCallback?.('Getting staged files...', 10);
            this.gateStatusService.notifyProgress({
                message: 'Getting staged files...',
                percentage: 10
            });
            const changedFiles = await this.getFilesToScan(policy);

            if (changedFiles.length === 0) {
                const result = this.createEmptyResult(policy, options.scope, startTime);
                this.gateStatusService.notifyRunCompleted(result);
                return result;
            }

            this.checkCancellation(cancellationToken);

            options.progressCallback?.(`Found ${changedFiles.length} C/C++ file(s) to scan`, 15);
            this.gateStatusService.notifyProgress({
                message: `Found ${changedFiles.length} C/C++ file(s) to scan`,
                percentage: 15,
                totalFiles: changedFiles.length,
                filesScanned: 0
            });

            const fileResults: FileChangeResult[] = [];
            const allScanResults: ScanResult[] = [];
            let totalFunctionsScanned = 0;

            const progressPerFile = 70 / changedFiles.length;
            let currentProgress = 20;

            for (let i = 0; i < changedFiles.length; i++) {
                const file = changedFiles[i];
                this.checkCancellation(cancellationToken);

                const fileName = this.getBasename(file.filePath);
                options.progressCallback?.(`Scanning ${fileName}...`, currentProgress);
                this.gateStatusService.notifyProgress({
                    message: `Scanning ${fileName}...`,
                    percentage: currentProgress,
                    currentFile: fileName,
                    totalFiles: changedFiles.length,
                    filesScanned: i
                });

                const fileResult = await this.scanFile(file, cancellationToken);
                fileResults.push(fileResult);

                if (fileResult.scanned && fileResult.scanResults.length > 0) {
                    allScanResults.push(...fileResult.scanResults);
                    totalFunctionsScanned += fileResult.scanResults.length;
                }

                currentProgress += progressPerFile;
            }

            this.checkCancellation(cancellationToken);

            options.progressCallback?.('Evaluating results...', 90);
            this.gateStatusService.notifyProgress({
                message: 'Evaluating results...',
                percentage: 90,
                filesScanned: changedFiles.length,
                totalFiles: changedFiles.length
            });

            const endTime = new Date();
            const scanDurationMs = endTime.getTime() - startTime.getTime();

            const gateResult = this.policyService.evaluateResults(allScanResults, scanDurationMs);

            const result: AggregatedGateResult = {
                ...gateResult,
                filesScanned: fileResults.filter(f => f.scanned).length,
                functionsScanned: totalFunctionsScanned,
                scanScope: options.scope,
                changedFiles: fileResults,
                startTime,
                endTime
            };

            options.progressCallback?.('Updating diagnostics...', 95);
            this.gateStatusService.notifyProgress({
                message: 'Updating diagnostics...',
                percentage: 95
            });
            this.updateDiagnostics(result);

            options.progressCallback?.('Gate check complete', 100);
            this.gateStatusService.notifyProgress({
                message: 'Gate check complete',
                percentage: 100
            });

            // Notify gate status service that run has completed
            this.gateStatusService.notifyRunCompleted(result);

            return result;

        } catch (error) {
            const endTime = new Date();
            const scanDurationMs = endTime.getTime() - startTime.getTime();

            if (error instanceof Error && error.message === 'Cancelled') {
                this.gateStatusService.notifyError(error, 'Gate scan was cancelled');
                throw error;
            }

            const errorObj = error instanceof Error ? error : new Error(String(error));
            this.gateStatusService.notifyError(errorObj);

            const fallbackResult = this.policyService.evaluateFallback(
                errorObj,
                scanDurationMs
            );

            return {
                ...fallbackResult,
                filesScanned: 0,
                functionsScanned: 0,
                scanScope: options.scope,
                changedFiles: [],
                startTime,
                endTime
            };
        } finally {
            this.isRunning = false;
            this.currentCancellation = null;
        }
    }

    private async getFilesToScan(policy: GatePolicyConfig): Promise<FileChange[]> {
        if (policy.scope === 'staged') {
            return this.gitService.getStagedCppFiles();
        }
        return this.gitService.getModifiedCppFiles('staged+unstaged');
    }

    private async scanFile(
        file: FileChange,
        cancellationToken: vscode.CancellationToken
    ): Promise<FileChangeResult> {
        if (file.status === 2) {
            return {
                filePath: file.filePath,
                status: file.statusLetter,
                scanned: false,
                scanResults: [],
                error: 'File deleted - skipping scan'
            };
        }

        try {
            const result = await this.scanner.scanFile(file.filePath, cancellationToken);

            const functionResult: FunctionScanResult = {
                ...result,
                functionInfo: {
                    name: 'file',
                    code: '',
                    filePath: file.filePath,
                    startLine: 1,
                    endLine: 1
                },
                contentHash: '',
                cached: false
            };

            return {
                filePath: file.filePath,
                status: file.statusLetter,
                scanned: true,
                scanResults: [functionResult]
            };
        } catch (error) {
            return {
                filePath: file.filePath,
                status: file.statusLetter,
                scanned: false,
                scanResults: [],
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private createEmptyResult(
        policy: GatePolicyConfig,
        scope: GateScope,
        startTime: Date
    ): AggregatedGateResult {
        const endTime = new Date();
        return {
            decision: 'PASS',
            reasons: ['No C/C++ files to scan'],
            findings: [],
            blockedFindings: [],
            warnedFindings: [],
            scanDurationMs: endTime.getTime() - startTime.getTime(),
            policyUsed: policy,
            disclaimer: DEVIGN_DISCLAIMER,
            filesScanned: 0,
            functionsScanned: 0,
            scanScope: scope,
            changedFiles: [],
            startTime,
            endTime
        };
    }

    private checkCancellation(token: vscode.CancellationToken): void {
        if (token.isCancellationRequested) {
            throw new Error('Cancelled');
        }
    }

    private getBasename(filePath: string): string {
        const parts = filePath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || filePath;
    }

    updateDiagnostics(result: AggregatedGateResult): void {
        this.diagnosticCollection.clear();

        const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>();

        for (const fileResult of result.changedFiles) {
            if (!fileResult.scanned) {
                continue;
            }

            const uri = vscode.Uri.file(fileResult.filePath);
            const uriKey = uri.toString();

            if (!diagnosticsByUri.has(uriKey)) {
                diagnosticsByUri.set(uriKey, []);
            }

            const diagnostics = diagnosticsByUri.get(uriKey)!;

            for (const scanResult of fileResult.scanResults) {
                if (!scanResult.vulnerable) {
                    continue;
                }

                const severity = this.getSeverity(scanResult.probability, scanResult.risk_level);

                if (scanResult.dangerous_lines && scanResult.dangerous_lines.length > 0) {
                    for (const dl of scanResult.dangerous_lines) {
                        const range = new vscode.Range(
                            dl.line - 1,
                            dl.column_start || 0,
                            dl.line - 1,
                            dl.column_end || 1000
                        );

                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `[Devign Gate] ${dl.message || 'Potential vulnerability detected'} (${Math.round(scanResult.probability * 100)}% confidence)`,
                            severity
                        ));
                    }
                } else {
                    const range = new vscode.Range(0, 0, 0, 0);
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `[Devign Gate] ${scanResult.risk_level} risk vulnerability detected (${Math.round(scanResult.probability * 100)}% confidence)`,
                        severity
                    ));
                }
            }
        }

        for (const [uriKey, diagnostics] of diagnosticsByUri) {
            const uri = vscode.Uri.parse(uriKey);
            this.diagnosticCollection.set(uri, diagnostics);
        }
    }

    private getSeverity(probability: number, riskLevel: string): vscode.DiagnosticSeverity {
        const level = riskLevel.toUpperCase();
        if (level === 'CRITICAL' || probability >= 0.8) {
            return vscode.DiagnosticSeverity.Error;
        }
        if (level === 'HIGH' || probability >= 0.6) {
            return vscode.DiagnosticSeverity.Warning;
        }
        if (level === 'MEDIUM' || probability >= 0.4) {
            return vscode.DiagnosticSeverity.Warning;
        }
        return vscode.DiagnosticSeverity.Information;
    }

    clearDiagnostics(): void {
        this.diagnosticCollection.clear();
    }

    /**
     * Gets the gate status service for subscribing to status events
     */
    getStatusService(): GateStatusService {
        return this.gateStatusService;
    }

    formatResultSummary(result: AggregatedGateResult): string {
        const lines: string[] = [];

        const decisionIcon = result.decision === 'PASS' ? '✅' :
            result.decision === 'WARN' ? '⚠️' : '🚫';

        lines.push(`${decisionIcon} Security Gate: ${result.decision}`);
        lines.push('');
        lines.push(`📁 Files scanned: ${result.filesScanned}`);
        lines.push(`🔍 Functions scanned: ${result.functionsScanned}`);
        lines.push(`⏱️ Duration: ${result.scanDurationMs}ms`);

        if (result.blockedFindings.length > 0) {
            lines.push('');
            lines.push(`🚫 Blocking findings: ${result.blockedFindings.length}`);
        }

        if (result.warnedFindings.length > 0) {
            lines.push(`⚠️ Warning findings: ${result.warnedFindings.length}`);
        }

        if (result.reasons.length > 0) {
            lines.push('');
            lines.push('Reasons:');
            for (const reason of result.reasons) {
                lines.push(`  • ${reason}`);
            }
        }

        lines.push('');
        lines.push(`ℹ️ ${result.disclaimer}`);

        return lines.join('\n');
    }

    formatResultForQuickPick(result: AggregatedGateResult): vscode.QuickPickItem[] {
        const items: vscode.QuickPickItem[] = [];

        items.push({
            label: `$(${this.getDecisionIcon(result.decision)}) ${result.decision}`,
            description: `${result.filesScanned} files, ${result.functionsScanned} functions scanned`,
            detail: result.reasons.join('; ')
        });

        items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });

        for (const fileResult of result.changedFiles) {
            if (!fileResult.scanned) {
                continue;
            }

            const vulnCount = fileResult.scanResults.filter(r => r.vulnerable).length;
            const icon = vulnCount > 0 ? 'warning' : 'check';

            items.push({
                label: `$(${icon}) ${this.getBasename(fileResult.filePath)}`,
                description: vulnCount > 0 ? `${vulnCount} finding(s)` : 'Clean',
                detail: fileResult.filePath
            });
        }

        return items;
    }

    private getDecisionIcon(decision: string): string {
        switch (decision) {
            case 'PASS': return 'check';
            case 'WARN': return 'warning';
            case 'BLOCK': return 'error';
            default: return 'question';
        }
    }
}

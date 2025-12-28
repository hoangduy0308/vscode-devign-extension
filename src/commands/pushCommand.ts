import * as vscode from 'vscode';
import { SecurityGateService, AggregatedGateResult } from '../services/securityGateService';
import { GitService } from '../services/gitService';
import { GateDecision } from '../services/gatePolicy';

/**
 * Push Command with Security Gate
 * 
 * Implements a git push command that optionally runs a security gate scan
 * before pushing. Based on the gate result:
 * - PASS: Proceeds with push
 * - WARN: Shows confirmation dialog, pushes if user confirms
 * - BLOCK: Cancels push and shows report
 */
export class PushCommand {
    private securityGateService: SecurityGateService | undefined;
    private gitService: GitService;

    constructor(
        gitService: GitService,
        securityGateService?: SecurityGateService
    ) {
        this.gitService = gitService;
        this.securityGateService = securityGateService;
    }

    /**
     * Set the security gate service (for lazy initialization)
     */
    setSecurityGateService(service: SecurityGateService): void {
        this.securityGateService = service;
    }

    /**
     * Execute push with security gate
     */
    async execute(): Promise<void> {
        // Check if git is available
        const isGitAvailable = await this.gitService.isAvailable();
        if (!isGitAvailable) {
            vscode.window.showErrorMessage('Git is not available. Please ensure Git is installed and the workspace is a Git repository.');
            return;
        }

        // Check for changes to push
        const hasChangesToPush = await this.checkForChangesToPush();
        if (!hasChangesToPush) {
            vscode.window.showInformationMessage('No commits to push.');
            return;
        }

        // Check if push gate is enabled
        const isPushGateEnabled = this.securityGateService?.isPushGateEnabled() ?? false;

        if (isPushGateEnabled && this.securityGateService) {
            await this.executeWithGate();
        } else {
            await this.executeDirectPush();
        }
    }

    /**
     * Check if there are commits to push
     */
    private async checkForChangesToPush(): Promise<boolean> {
        const snapshot = await this.gitService.getRepositorySnapshot();
        if (!snapshot) {
            return false;
        }

        // Check if there's an upstream branch configured
        // If no upstream, we assume there are changes to push (new branch)
        // The actual push will handle the upstream setup
        return true;
    }

    /**
     * Execute push with security gate scan
     */
    private async executeWithGate(): Promise<void> {
        if (!this.securityGateService) {
            await this.executeDirectPush();
            return;
        }

        // Show progress while running gate
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Devign Security Gate',
            cancellable: true
        }, async (progress, token) => {
            return this.securityGateService!.runGate({
                scope: 'push',
                cancellationToken: token,
                progressCallback: (message, increment) => {
                    progress.report({ message, increment });
                }
            });
        });

        // Handle gate result
        await this.handleGateResult(result);
    }

    /**
     * Handle the security gate result
     */
    private async handleGateResult(result: AggregatedGateResult): Promise<void> {
        switch (result.decision) {
            case 'PASS':
                await this.handlePassResult(result);
                break;
            case 'WARN':
                await this.handleWarnResult(result);
                break;
            case 'BLOCK':
                await this.handleBlockResult(result);
                break;
        }
    }

    /**
     * Handle PASS result - proceed with push
     */
    private async handlePassResult(result: AggregatedGateResult): Promise<void> {
        vscode.window.showInformationMessage(
            `✅ Security gate passed. Pushing changes...`
        );
        await this.executeDirectPush();
    }

    /**
     * Handle WARN result - show confirmation dialog
     */
    private async handleWarnResult(result: AggregatedGateResult): Promise<void> {
        const warnCount = result.warnedFindings.length;
        const message = `⚠️ Security gate found ${warnCount} warning(s). Do you want to proceed with push?`;

        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: true, detail: this.formatWarningDetails(result) },
            'Push Anyway',
            'View Report',
            'Cancel'
        );

        switch (choice) {
            case 'Push Anyway':
                await this.executeDirectPush();
                break;
            case 'View Report':
                await this.showGateReport(result);
                break;
            case 'Cancel':
            default:
                vscode.window.showInformationMessage('Push cancelled.');
                break;
        }
    }

    /**
     * Handle BLOCK result - cancel push and show report
     */
    private async handleBlockResult(result: AggregatedGateResult): Promise<void> {
        const blockCount = result.blockedFindings.length;
        const message = `🚫 Security gate blocked push: ${blockCount} critical finding(s) detected.`;

        const choice = await vscode.window.showErrorMessage(
            message,
            { modal: true, detail: this.formatBlockDetails(result) },
            'View Report',
            'Close'
        );

        if (choice === 'View Report') {
            await this.showGateReport(result);
        }
    }

    /**
     * Execute direct git push without gate
     */
    private async executeDirectPush(): Promise<void> {
        try {
            const pushResult = await this.gitService.push();

            if (pushResult.success) {
                vscode.window.showInformationMessage('✅ Push successful!');
            } else {
                vscode.window.showErrorMessage(`Push failed: ${pushResult.error || 'Unknown error'}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Push failed: ${errorMessage}`);
        }
    }

    /**
     * Format warning details for the confirmation dialog
     */
    private formatWarningDetails(result: AggregatedGateResult): string {
        const lines: string[] = [];
        
        lines.push(`Files scanned: ${result.filesScanned}`);
        lines.push(`Functions scanned: ${result.functionsScanned}`);
        lines.push(`Warnings: ${result.warnedFindings.length}`);
        lines.push('');
        lines.push('Reasons:');
        for (const reason of result.reasons) {
            lines.push(`  • ${reason}`);
        }
        lines.push('');
        lines.push(`ℹ️ ${result.disclaimer}`);

        return lines.join('\n');
    }

    /**
     * Format block details for the error dialog
     */
    private formatBlockDetails(result: AggregatedGateResult): string {
        const lines: string[] = [];
        
        lines.push(`Files scanned: ${result.filesScanned}`);
        lines.push(`Functions scanned: ${result.functionsScanned}`);
        lines.push(`Blocked findings: ${result.blockedFindings.length}`);
        lines.push('');
        lines.push('Blocking reasons:');
        for (const reason of result.reasons) {
            lines.push(`  • ${reason}`);
        }
        lines.push('');
        lines.push(`ℹ️ ${result.disclaimer}`);

        return lines.join('\n');
    }

    /**
     * Show detailed gate report
     */
    private async showGateReport(result: AggregatedGateResult): Promise<void> {
        // Create output channel for detailed report
        const outputChannel = vscode.window.createOutputChannel('Devign Security Gate Report');
        outputChannel.clear();
        
        outputChannel.appendLine('='.repeat(60));
        outputChannel.appendLine('DEVIGN SECURITY GATE REPORT');
        outputChannel.appendLine('='.repeat(60));
        outputChannel.appendLine('');
        
        // Summary
        const decisionIcon = result.decision === 'PASS' ? '✅' :
            result.decision === 'WARN' ? '⚠️' : '🚫';
        outputChannel.appendLine(`Decision: ${decisionIcon} ${result.decision}`);
        outputChannel.appendLine(`Scope: ${result.scanScope}`);
        outputChannel.appendLine(`Duration: ${result.scanDurationMs}ms`);
        outputChannel.appendLine('');
        
        // Statistics
        outputChannel.appendLine('--- Statistics ---');
        outputChannel.appendLine(`Files scanned: ${result.filesScanned}`);
        outputChannel.appendLine(`Functions scanned: ${result.functionsScanned}`);
        outputChannel.appendLine(`Total findings: ${result.findings.length}`);
        outputChannel.appendLine(`Blocked findings: ${result.blockedFindings.length}`);
        outputChannel.appendLine(`Warning findings: ${result.warnedFindings.length}`);
        outputChannel.appendLine('');
        
        // Reasons
        outputChannel.appendLine('--- Reasons ---');
        for (const reason of result.reasons) {
            outputChannel.appendLine(`  • ${reason}`);
        }
        outputChannel.appendLine('');
        
        // Blocked findings details
        if (result.blockedFindings.length > 0) {
            outputChannel.appendLine('--- Blocked Findings ---');
            for (const finding of result.blockedFindings) {
                outputChannel.appendLine(`  File: ${finding.file_path}`);
                outputChannel.appendLine(`  Risk: ${finding.risk_level} (${(finding.probability * 100).toFixed(1)}%)`);
                if (finding.dangerous_lines && finding.dangerous_lines.length > 0) {
                    for (const line of finding.dangerous_lines) {
                        outputChannel.appendLine(`    Line ${line.line}: ${line.message || 'Potential vulnerability'}`);
                    }
                }
                outputChannel.appendLine('');
            }
        }
        
        // Warning findings details
        if (result.warnedFindings.length > 0) {
            outputChannel.appendLine('--- Warning Findings ---');
            for (const finding of result.warnedFindings) {
                outputChannel.appendLine(`  File: ${finding.file_path}`);
                outputChannel.appendLine(`  Risk: ${finding.risk_level} (${(finding.probability * 100).toFixed(1)}%)`);
                if (finding.dangerous_lines && finding.dangerous_lines.length > 0) {
                    for (const line of finding.dangerous_lines) {
                        outputChannel.appendLine(`    Line ${line.line}: ${line.message || 'Potential vulnerability'}`);
                    }
                }
                outputChannel.appendLine('');
            }
        }
        
        // Disclaimer
        outputChannel.appendLine('--- Disclaimer ---');
        outputChannel.appendLine(result.disclaimer);
        outputChannel.appendLine('');
        outputChannel.appendLine('='.repeat(60));
        
        outputChannel.show();
    }
}

/**
 * Register the push command with VS Code
 */
export function registerPushCommand(
    context: vscode.ExtensionContext,
    gitService: GitService,
    securityGateService?: SecurityGateService
): vscode.Disposable {
    const pushCommand = new PushCommand(gitService, securityGateService);

    const disposable = vscode.commands.registerCommand(
        'devign.pushWithGate',
        () => pushCommand.execute()
    );

    context.subscriptions.push(disposable);

    return disposable;
}

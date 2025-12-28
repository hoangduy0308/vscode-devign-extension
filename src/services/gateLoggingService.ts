/**
 * Gate Logging Service
 * 
 * Provides structured logging for security gate runs using VS Code OutputChannel.
 * Logs repository info, files scanned, functions analyzed, and decision reasons
 * to help users debug issues when reporting problems.
 */

import * as vscode from 'vscode';

export type GateScope = 'commit' | 'push';
export type GateDecision = 'PASS' | 'WARN' | 'BLOCK';

export interface FunctionLogInfo {
    file: string;
    name: string;
}

/**
 * Service for structured logging of security gate operations.
 * Uses VS Code OutputChannel for user-visible logging.
 */
export class GateLoggingService implements vscode.Disposable {
    private static instance: GateLoggingService | undefined;
    private outputChannel: vscode.OutputChannel;
    private runCounter: number = 0;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Devign Security Gate');
    }

    /**
     * Gets the singleton instance of GateLoggingService
     */
    static getInstance(): GateLoggingService {
        if (!GateLoggingService.instance) {
            GateLoggingService.instance = new GateLoggingService();
        }
        return GateLoggingService.instance;
    }

    /**
     * Resets the singleton instance (useful for testing)
     */
    static resetInstance(): void {
        if (GateLoggingService.instance) {
            GateLoggingService.instance.dispose();
            GateLoggingService.instance = undefined;
        }
    }

    /**
     * Formats a timestamp for log entries
     */
    private formatTimestamp(): string {
        return new Date().toISOString();
    }

    /**
     * Formats a log line with timestamp and level
     */
    private formatLogLine(level: string, message: string): string {
        return `[${this.formatTimestamp()}] [${level}] ${message}`;
    }

    /**
     * Logs the start of a gate run
     * @param scope The scope of the gate run ('commit' or 'push')
     * @param repoPath The path to the repository being scanned
     */
    logGateStart(scope: GateScope, repoPath: string): void {
        this.runCounter++;
        const runId = this.runCounter;

        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('═'.repeat(70));
        this.outputChannel.appendLine(this.formatLogLine('INFO', `Security Gate Run #${runId} Started`));
        this.outputChannel.appendLine('─'.repeat(70));
        this.outputChannel.appendLine(`  Scope:      ${scope.toUpperCase()}`);
        this.outputChannel.appendLine(`  Repository: ${repoPath}`);
        this.outputChannel.appendLine(`  Started:    ${this.formatTimestamp()}`);
        this.outputChannel.appendLine('─'.repeat(70));
    }

    /**
     * Logs the files being scanned
     * @param files Array of file paths being scanned
     */
    logFilesScanned(files: string[]): void {
        this.outputChannel.appendLine(this.formatLogLine('INFO', `Scanning ${files.length} file(s)`));
        
        if (files.length === 0) {
            this.outputChannel.appendLine('  (No files to scan)');
            return;
        }

        this.outputChannel.appendLine('  Files:');
        for (const file of files) {
            // Extract just the filename for cleaner display
            const fileName = this.getBasename(file);
            this.outputChannel.appendLine(`    • ${fileName}`);
        }
        
        // If there are many files, also show the full paths in a collapsed section
        if (files.length > 3) {
            this.outputChannel.appendLine('  Full paths:');
            for (const file of files) {
                this.outputChannel.appendLine(`    ${file}`);
            }
        }
    }

    /**
     * Logs the functions being scanned
     * @param functions Array of function info objects with file and name
     */
    logFunctionsScanned(functions: FunctionLogInfo[]): void {
        this.outputChannel.appendLine(this.formatLogLine('INFO', `Analyzing ${functions.length} function(s)`));
        
        if (functions.length === 0) {
            this.outputChannel.appendLine('  (No functions extracted)');
            return;
        }

        // Group functions by file for cleaner display
        const byFile = new Map<string, string[]>();
        for (const fn of functions) {
            const fileName = this.getBasename(fn.file);
            if (!byFile.has(fileName)) {
                byFile.set(fileName, []);
            }
            byFile.get(fileName)!.push(fn.name);
        }

        this.outputChannel.appendLine('  Functions by file:');
        for (const [file, funcNames] of byFile) {
            this.outputChannel.appendLine(`    ${file}:`);
            for (const name of funcNames) {
                this.outputChannel.appendLine(`      • ${name}`);
            }
        }
    }

    /**
     * Logs the final decision of the gate run
     * @param decision The gate decision ('PASS', 'WARN', or 'BLOCK')
     * @param reasons Array of reasons for the decision
     */
    logDecision(decision: GateDecision, reasons: string[]): void {
        const icon = decision === 'PASS' ? '✅' : decision === 'WARN' ? '⚠️' : '🚫';
        const level = decision === 'BLOCK' ? 'ERROR' : decision === 'WARN' ? 'WARN' : 'INFO';
        
        this.outputChannel.appendLine('─'.repeat(70));
        this.outputChannel.appendLine(this.formatLogLine(level, `${icon} Gate Decision: ${decision}`));
        
        if (reasons.length > 0) {
            this.outputChannel.appendLine('  Reasons:');
            for (const reason of reasons) {
                this.outputChannel.appendLine(`    • ${reason}`);
            }
        }
        
        this.outputChannel.appendLine('═'.repeat(70));
        this.outputChannel.appendLine('');
    }

    /**
     * Logs an error with optional context
     * @param error The error that occurred
     * @param context Optional context about where/why the error occurred
     */
    logError(error: Error, context?: string): void {
        this.outputChannel.appendLine(this.formatLogLine('ERROR', context ? `${context}: ${error.message}` : error.message));
        
        if (error.stack) {
            this.outputChannel.appendLine('  Stack trace:');
            const stackLines = error.stack.split('\n').slice(1, 6); // First 5 stack frames
            for (const line of stackLines) {
                this.outputChannel.appendLine(`    ${line.trim()}`);
            }
        }
    }

    /**
     * Logs a progress update during gate run
     * @param message The progress message
     */
    logProgress(message: string): void {
        this.outputChannel.appendLine(this.formatLogLine('INFO', message));
    }

    /**
     * Logs a debug message (for detailed troubleshooting)
     * @param message The debug message
     */
    logDebug(message: string): void {
        this.outputChannel.appendLine(this.formatLogLine('DEBUG', message));
    }

    /**
     * Logs a warning message
     * @param message The warning message
     */
    logWarning(message: string): void {
        this.outputChannel.appendLine(this.formatLogLine('WARN', message));
    }

    /**
     * Logs scan results summary
     * @param filesScanned Number of files scanned
     * @param functionsScanned Number of functions scanned
     * @param vulnerableCount Number of vulnerable findings
     * @param durationMs Duration of the scan in milliseconds
     */
    logScanSummary(
        filesScanned: number,
        functionsScanned: number,
        vulnerableCount: number,
        durationMs: number
    ): void {
        this.outputChannel.appendLine(this.formatLogLine('INFO', 'Scan Summary'));
        this.outputChannel.appendLine(`  Files scanned:     ${filesScanned}`);
        this.outputChannel.appendLine(`  Functions scanned: ${functionsScanned}`);
        this.outputChannel.appendLine(`  Vulnerabilities:   ${vulnerableCount}`);
        this.outputChannel.appendLine(`  Duration:          ${durationMs}ms`);
    }

    /**
     * Shows the output channel to the user
     * @param preserveFocus If true, the output channel will not take focus
     */
    show(preserveFocus: boolean = true): void {
        this.outputChannel.show(preserveFocus);
    }

    /**
     * Clears the output channel
     */
    clear(): void {
        this.outputChannel.clear();
    }

    /**
     * Gets the output channel (for advanced usage)
     */
    getOutputChannel(): vscode.OutputChannel {
        return this.outputChannel;
    }

    /**
     * Extracts the basename from a file path
     */
    private getBasename(filePath: string): string {
        const parts = filePath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || filePath;
    }

    /**
     * Disposes of the output channel
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}

/**
 * Convenience function to get the GateLoggingService instance
 */
export function getGateLoggingService(): GateLoggingService {
    return GateLoggingService.getInstance();
}

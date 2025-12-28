/**
 * Gate Logging Service
 * 
 * Provides structured logging for security gate runs using VS Code OutputChannel.
 * Logs repository info, files scanned, functions analyzed, and decision reasons
 * to help users debug issues when reporting problems.
 * 
 * Features:
 * - Structured logging with log levels (DEBUG, INFO, WARN, ERROR)
 * - Context tagging for different components
 * - Performance timing helpers
 * - Log rotation/truncation for long outputs
 */

import * as vscode from 'vscode';

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Log levels for structured logging
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4
}

/**
 * Context tags for different components
 */
export enum LogContext {
    SecurityGate = 'SecurityGate',
    DiffAnalyzer = 'DiffAnalyzer',
    FunctionExtractor = 'FunctionExtractor',
    VulnerabilityScanner = 'VulnerabilityScanner',
    GitOperations = 'GitOperations',
    Configuration = 'Configuration',
    General = 'General'
}

export type GateScope = 'commit' | 'push';
export type GateDecision = 'PASS' | 'WARN' | 'BLOCK';

export interface FunctionLogInfo {
    file: string;
    name: string;
}

/**
 * Timer handle returned by startTimer
 */
export interface TimerHandle {
    id: string;
    context: LogContext;
    operation: string;
    startTime: number;
}

/**
 * Configuration options for the logging service
 */
export interface LoggingConfig {
    minLevel: LogLevel;
    maxLogLines: number;
    enableTimestamps: boolean;
    enableContextTags: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: LoggingConfig = {
    minLevel: LogLevel.DEBUG,
    maxLogLines: 5000,
    enableTimestamps: true,
    enableContextTags: true
};

const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.SILENT]: 'SILENT'
};

const LOG_LEVEL_ICONS: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: '🔍',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.ERROR]: '❌',
    [LogLevel.SILENT]: ''
};

// ============================================================================
// GateLoggingService Class
// ============================================================================

/**
 * Service for structured logging of security gate operations.
 * Uses VS Code OutputChannel for user-visible logging.
 */
export class GateLoggingService implements vscode.Disposable {
    private static instance: GateLoggingService | undefined;
    private outputChannel: vscode.OutputChannel;
    private runCounter: number = 0;
    private lineCount: number = 0;
    private config: LoggingConfig;
    private activeTimers: Map<string, TimerHandle> = new Map();
    private timerCounter: number = 0;

    private constructor(config?: Partial<LoggingConfig>) {
        this.outputChannel = vscode.window.createOutputChannel('Devign Security Gate');
        this.config = { ...DEFAULT_CONFIG, ...config };
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

    // ========================================================================
    // Configuration
    // ========================================================================

    /**
     * Updates the logging configuration
     * @param config Partial configuration to merge with current config
     */
    setConfig(config: Partial<LoggingConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Gets the current logging configuration
     */
    getConfig(): LoggingConfig {
        return { ...this.config };
    }

    /**
     * Sets the minimum log level
     * @param level The minimum level to log
     */
    setLogLevel(level: LogLevel): void {
        this.config.minLevel = level;
    }

    /**
     * Gets the current minimum log level
     */
    getLogLevel(): LogLevel {
        return this.config.minLevel;
    }

    // ========================================================================
    // Timestamp Formatting
    // ========================================================================

    /**
     * Formats a timestamp for log entries (ISO 8601 format)
     */
    private formatTimestamp(): string {
        return new Date().toISOString();
    }

    /**
     * Formats a timestamp in a more readable format
     */
    private formatReadableTimestamp(): string {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const ms = now.getMilliseconds().toString().padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${ms}`;
    }

    /**
     * Formats a duration in milliseconds to a human-readable string
     */
    private formatDuration(ms: number): string {
        if (ms < 1000) {
            return `${ms.toFixed(0)}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(2)}s`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = ((ms % 60000) / 1000).toFixed(1);
            return `${minutes}m ${seconds}s`;
        }
    }

    // ========================================================================
    // Core Logging Methods
    // ========================================================================

    /**
     * Formats a log line with timestamp, level, and optional context
     */
    private formatLogLine(level: LogLevel, message: string, context?: LogContext): string {
        const parts: string[] = [];
        
        if (this.config.enableTimestamps) {
            parts.push(`[${this.formatReadableTimestamp()}]`);
        }
        
        parts.push(`[${LOG_LEVEL_LABELS[level]}]`);
        
        if (this.config.enableContextTags && context) {
            parts.push(`[${context}]`);
        }
        
        parts.push(message);
        
        return parts.join(' ');
    }

    /**
     * Writes a line to the output channel with log rotation
     */
    private writeLine(line: string): void {
        // Check for log rotation
        if (this.lineCount >= this.config.maxLogLines) {
            this.rotateLog();
        }
        
        this.outputChannel.appendLine(line);
        this.lineCount++;
    }

    /**
     * Rotates the log by clearing old entries and adding a marker
     */
    private rotateLog(): void {
        const truncationMessage = `\n${'─'.repeat(70)}\n[LOG TRUNCATED] Previous ${this.lineCount} lines cleared to prevent excessive memory usage\n${'─'.repeat(70)}\n`;
        this.outputChannel.clear();
        this.outputChannel.appendLine(truncationMessage);
        this.lineCount = 3; // Account for the truncation message lines
    }

    /**
     * Core logging method - all other log methods delegate to this
     */
    private log(level: LogLevel, message: string, context?: LogContext): void {
        if (level < this.config.minLevel) {
            return;
        }
        
        const formattedLine = this.formatLogLine(level, message, context);
        this.writeLine(formattedLine);
    }

    // ========================================================================
    // Public Logging Methods
    // ========================================================================

    /**
     * Logs a debug message (for detailed troubleshooting)
     * @param message The debug message
     * @param context Optional context tag
     */
    logDebug(message: string, context?: LogContext): void {
        this.log(LogLevel.DEBUG, message, context ?? LogContext.General);
    }

    /**
     * Logs an info message
     * @param message The info message
     * @param context Optional context tag
     */
    logInfo(message: string, context?: LogContext): void {
        this.log(LogLevel.INFO, message, context ?? LogContext.General);
    }

    /**
     * Logs a warning message
     * @param message The warning message
     * @param context Optional context tag
     */
    logWarning(message: string, context?: LogContext): void {
        this.log(LogLevel.WARN, message, context ?? LogContext.General);
    }

    /**
     * Logs an error message
     * @param message The error message
     * @param context Optional context tag
     */
    logErrorMessage(message: string, context?: LogContext): void {
        this.log(LogLevel.ERROR, message, context ?? LogContext.General);
    }

    /**
     * Logs a progress update during gate run
     * @param message The progress message
     * @param context Optional context tag
     */
    logProgress(message: string, context?: LogContext): void {
        this.log(LogLevel.INFO, message, context ?? LogContext.SecurityGate);
    }

    // ========================================================================
    // Performance Timing Helpers
    // ========================================================================

    /**
     * Starts a performance timer for an operation
     * @param operation Name of the operation being timed
     * @param context Context tag for the operation
     * @returns TimerHandle to pass to endTimer
     */
    startTimer(operation: string, context: LogContext = LogContext.General): TimerHandle {
        const id = `timer_${++this.timerCounter}`;
        const handle: TimerHandle = {
            id,
            context,
            operation,
            startTime: performance.now()
        };
        
        this.activeTimers.set(id, handle);
        this.logDebug(`⏱️ Starting: ${operation}`, context);
        
        return handle;
    }

    /**
     * Ends a performance timer and logs the duration
     * @param handle The timer handle from startTimer
     * @param additionalInfo Optional additional info to include in the log
     * @returns Duration in milliseconds
     */
    endTimer(handle: TimerHandle, additionalInfo?: string): number {
        const endTime = performance.now();
        const duration = endTime - handle.startTime;
        
        this.activeTimers.delete(handle.id);
        
        const durationStr = this.formatDuration(duration);
        const message = additionalInfo 
            ? `⏱️ Completed: ${handle.operation} (${durationStr}) - ${additionalInfo}`
            : `⏱️ Completed: ${handle.operation} (${durationStr})`;
        
        this.logDebug(message, handle.context);
        
        return duration;
    }

    /**
     * Times an async operation and logs the duration
     * @param operation Name of the operation
     * @param fn The async function to time
     * @param context Context tag for the operation
     * @returns The result of the async function
     */
    async timeAsync<T>(
        operation: string, 
        fn: () => Promise<T>, 
        context: LogContext = LogContext.General
    ): Promise<T> {
        const timer = this.startTimer(operation, context);
        try {
            const result = await fn();
            this.endTimer(timer);
            return result;
        } catch (error) {
            this.endTimer(timer, `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    /**
     * Times a sync operation and logs the duration
     * @param operation Name of the operation
     * @param fn The function to time
     * @param context Context tag for the operation
     * @returns The result of the function
     */
    timeSync<T>(
        operation: string, 
        fn: () => T, 
        context: LogContext = LogContext.General
    ): T {
        const timer = this.startTimer(operation, context);
        try {
            const result = fn();
            this.endTimer(timer);
            return result;
        } catch (error) {
            this.endTimer(timer, `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    // ========================================================================
    // Gate-Specific Logging Methods (Original API preserved)
    // ========================================================================

    /**
     * Logs the start of a gate run
     * @param scope The scope of the gate run ('commit' or 'push')
     * @param repoPath The path to the repository being scanned
     */
    logGateStart(scope: GateScope, repoPath: string): void {
        this.runCounter++;
        const runId = this.runCounter;

        this.writeLine('');
        this.writeLine('═'.repeat(70));
        this.log(LogLevel.INFO, `Security Gate Run #${runId} Started`, LogContext.SecurityGate);
        this.writeLine('─'.repeat(70));
        this.writeLine(`  Scope:      ${scope.toUpperCase()}`);
        this.writeLine(`  Repository: ${repoPath}`);
        this.writeLine(`  Started:    ${this.formatTimestamp()}`);
        this.writeLine('─'.repeat(70));
    }

    /**
     * Logs the files being scanned
     * @param files Array of file paths being scanned
     */
    logFilesScanned(files: string[]): void {
        this.log(LogLevel.INFO, `Scanning ${files.length} file(s)`, LogContext.DiffAnalyzer);
        
        if (files.length === 0) {
            this.writeLine('  (No files to scan)');
            return;
        }

        this.writeLine('  Files:');
        
        // Truncate if too many files
        const maxFilesToShow = 50;
        const filesToShow = files.slice(0, maxFilesToShow);
        
        for (const file of filesToShow) {
            const fileName = this.getBasename(file);
            this.writeLine(`    • ${fileName}`);
        }
        
        if (files.length > maxFilesToShow) {
            this.writeLine(`    ... and ${files.length - maxFilesToShow} more files`);
        }
        
        // If there are many files, also show the full paths in a collapsed section
        if (files.length > 3 && files.length <= maxFilesToShow) {
            this.writeLine('  Full paths:');
            for (const file of files) {
                this.writeLine(`    ${file}`);
            }
        }
    }

    /**
     * Logs the functions being scanned
     * @param functions Array of function info objects with file and name
     */
    logFunctionsScanned(functions: FunctionLogInfo[]): void {
        this.log(LogLevel.INFO, `Analyzing ${functions.length} function(s)`, LogContext.FunctionExtractor);
        
        if (functions.length === 0) {
            this.writeLine('  (No functions extracted)');
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

        this.writeLine('  Functions by file:');
        
        // Truncate if too many files
        const maxFilesToShow = 20;
        const maxFunctionsPerFile = 10;
        let filesShown = 0;
        
        for (const [file, funcNames] of byFile) {
            if (filesShown >= maxFilesToShow) {
                this.writeLine(`    ... and ${byFile.size - maxFilesToShow} more files`);
                break;
            }
            
            this.writeLine(`    ${file}:`);
            const functionsToShow = funcNames.slice(0, maxFunctionsPerFile);
            for (const name of functionsToShow) {
                this.writeLine(`      • ${name}`);
            }
            
            if (funcNames.length > maxFunctionsPerFile) {
                this.writeLine(`      ... and ${funcNames.length - maxFunctionsPerFile} more functions`);
            }
            
            filesShown++;
        }
    }

    /**
     * Logs the final decision of the gate run
     * @param decision The gate decision ('PASS', 'WARN', or 'BLOCK')
     * @param reasons Array of reasons for the decision
     */
    logDecision(decision: GateDecision, reasons: string[]): void {
        const icon = decision === 'PASS' ? '✅' : decision === 'WARN' ? '⚠️' : '🚫';
        const level = decision === 'BLOCK' ? LogLevel.ERROR : decision === 'WARN' ? LogLevel.WARN : LogLevel.INFO;
        
        this.writeLine('─'.repeat(70));
        this.log(level, `${icon} Gate Decision: ${decision}`, LogContext.SecurityGate);
        
        if (reasons.length > 0) {
            this.writeLine('  Reasons:');
            
            // Truncate if too many reasons
            const maxReasons = 20;
            const reasonsToShow = reasons.slice(0, maxReasons);
            
            for (const reason of reasonsToShow) {
                this.writeLine(`    • ${reason}`);
            }
            
            if (reasons.length > maxReasons) {
                this.writeLine(`    ... and ${reasons.length - maxReasons} more reasons`);
            }
        }
        
        this.writeLine('═'.repeat(70));
        this.writeLine('');
    }

    /**
     * Logs an error with optional context
     * @param error The error that occurred
     * @param context Optional context about where/why the error occurred
     */
    logError(error: Error, context?: string): void {
        const message = context ? `${context}: ${error.message}` : error.message;
        this.log(LogLevel.ERROR, message, LogContext.General);
        
        if (error.stack) {
            this.writeLine('  Stack trace:');
            const stackLines = error.stack.split('\n').slice(1, 6); // First 5 stack frames
            for (const line of stackLines) {
                this.writeLine(`    ${line.trim()}`);
            }
        }
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
        this.log(LogLevel.INFO, 'Scan Summary', LogContext.VulnerabilityScanner);
        this.writeLine(`  Files scanned:     ${filesScanned}`);
        this.writeLine(`  Functions scanned: ${functionsScanned}`);
        this.writeLine(`  Vulnerabilities:   ${vulnerableCount}`);
        this.writeLine(`  Duration:          ${this.formatDuration(durationMs)}`);
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Logs a separator line for visual organization
     * @param style The style of separator ('single', 'double', 'dashed')
     */
    logSeparator(style: 'single' | 'double' | 'dashed' = 'single'): void {
        const char = style === 'double' ? '═' : style === 'dashed' ? '─' : '─';
        this.writeLine(char.repeat(70));
    }

    /**
     * Logs a section header
     * @param title The section title
     * @param context Optional context tag
     */
    logSection(title: string, context?: LogContext): void {
        this.writeLine('');
        this.logSeparator('dashed');
        this.log(LogLevel.INFO, `📋 ${title}`, context ?? LogContext.General);
        this.logSeparator('dashed');
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
        this.lineCount = 0;
    }

    /**
     * Gets the output channel (for advanced usage)
     */
    getOutputChannel(): vscode.OutputChannel {
        return this.outputChannel;
    }

    /**
     * Gets the current line count
     */
    getLineCount(): number {
        return this.lineCount;
    }

    /**
     * Extracts the basename from a file path
     */
    private getBasename(filePath: string): string {
        const parts = filePath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || filePath;
    }

    /**
     * Disposes of the output channel and cleans up resources
     */
    dispose(): void {
        this.activeTimers.clear();
        this.outputChannel.dispose();
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Convenience function to get the GateLoggingService instance
 */
export function getGateLoggingService(): GateLoggingService {
    return GateLoggingService.getInstance();
}

/**
 * Convenience function to create a scoped logger with a default context
 */
export function createScopedLogger(context: LogContext): {
    debug: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    startTimer: (operation: string) => TimerHandle;
    endTimer: (handle: TimerHandle, additionalInfo?: string) => number;
} {
    const service = getGateLoggingService();
    return {
        debug: (message: string) => service.logDebug(message, context),
        info: (message: string) => service.logInfo(message, context),
        warn: (message: string) => service.logWarning(message, context),
        error: (message: string) => service.logErrorMessage(message, context),
        startTimer: (operation: string) => service.startTimer(operation, context),
        endTimer: (handle: TimerHandle, additionalInfo?: string) => service.endTimer(handle, additionalInfo)
    };
}

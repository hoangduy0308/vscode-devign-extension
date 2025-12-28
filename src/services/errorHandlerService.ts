/**
 * Error Handler Service
 * 
 * Provides centralized error handling for the Devign security gate system.
 * Maps raw errors to user-friendly GateErrors and displays them with
 * actionable recovery buttons.
 */

import * as vscode from 'vscode';
import {
    GateError,
    GateErrorCode,
    GateErrors,
    ErrorAction,
    isGateError,
    ensureGateError
} from '../models/gateErrors';

/**
 * Error patterns for automatic error classification
 */
interface ErrorPattern {
    /** Regex or string patterns to match against error messages */
    patterns: (RegExp | string)[];
    /** Function to create the appropriate GateError */
    createError: (message: string, originalError?: Error) => GateError;
}

/**
 * Error classification patterns ordered by specificity
 */
const ERROR_PATTERNS: ErrorPattern[] = [
    // Scanner/Python not found patterns
    {
        patterns: [
            /ENOENT.*python/i,
            /spawn.*python.*ENOENT/i,
            /python.*not found/i,
            /python.*is not recognized/i,
            /No such file or directory.*python/i,
            /'python' is not recognized/i,
            /cannot find.*python/i
        ],
        createError: (msg, err) => GateErrors.pythonNotFound('python', err)
    },
    
    // Scanner script missing patterns
    {
        patterns: [
            /scanner.*not found/i,
            /vscode_scanner\.py.*not found/i,
            /ENOENT.*scanner/i,
            /No such file or directory.*scanner/i,
            /Failed to start scanner/i
        ],
        createError: (msg, err) => GateErrors.scannerMissing('python/vscode_scanner.py', err)
    },
    
    // Model files missing patterns
    {
        patterns: [
            /model.*not found/i,
            /best_v2_seed42\.pt.*not found/i,
            /vocab\.json.*not found/i,
            /config\.json.*not found/i,
            /models.*not downloaded/i,
            /FileNotFoundError.*model/i
        ],
        createError: (msg, err) => GateErrors.modelsMissing('models/', err)
    },
    
    // Python package missing patterns
    {
        patterns: [
            /ModuleNotFoundError.*torch/i,
            /No module named.*torch/i,
            /ImportError.*torch/i
        ],
        createError: (msg, err) => GateErrors.pythonPackageMissing(['torch'], err)
    },
    {
        patterns: [
            /ModuleNotFoundError.*tree_sitter/i,
            /No module named.*tree_sitter/i,
            /ImportError.*tree_sitter/i
        ],
        createError: (msg, err) => GateErrors.pythonPackageMissing(['tree-sitter', 'tree-sitter-c'], err)
    },
    {
        patterns: [
            /ModuleNotFoundError.*numpy/i,
            /No module named.*numpy/i,
            /ImportError.*numpy/i
        ],
        createError: (msg, err) => GateErrors.pythonPackageMissing(['numpy'], err)
    },
    {
        patterns: [
            /ModuleNotFoundError/i,
            /No module named/i,
            /ImportError/i
        ],
        createError: (msg, err) => {
            // Try to extract package name
            const match = msg.match(/(?:No module named|ModuleNotFoundError:.*)'([^']+)'/);
            const pkg = match ? match[1].replace('_', '-') : 'unknown';
            return GateErrors.pythonPackageMissing([pkg], err);
        }
    },
    
    // Timeout patterns
    {
        patterns: [
            /timed? ?out/i,
            /timeout/i,
            /exceeded.*time/i,
            /operation.*cancelled.*timeout/i
        ],
        createError: (msg, err) => {
            // Try to extract timeout value
            const match = msg.match(/(\d+)\s*(?:seconds?|s\b|ms)/i);
            const timeoutMs = match ? parseInt(match[1]) * (msg.includes('ms') ? 1 : 1000) : 60000;
            return GateErrors.timeout('scan', timeoutMs, err);
        }
    },
    
    // Parse failure patterns
    {
        patterns: [
            /Failed to parse.*output/i,
            /JSON\.parse/i,
            /SyntaxError.*JSON/i,
            /Unexpected token/i,
            /invalid json/i
        ],
        createError: (msg, err) => GateErrors.parseFailOutput(msg, err)
    },
    {
        patterns: [
            /parse.*error.*source/i,
            /syntax error/i,
            /tree-sitter.*error/i,
            /failed to parse.*\.c/i,
            /failed to parse.*\.cpp/i
        ],
        createError: (msg, err) => GateErrors.parseFailSource('unknown', err)
    },
    
    // Git API failure patterns
    {
        patterns: [
            /Git extension not/i,
            /git.*not available/i,
            /git.*disabled/i
        ],
        createError: (msg, err) => GateErrors.gitExtensionNotAvailable(err)
    },
    {
        patterns: [
            /No.*repository/i,
            /not a git repository/i,
            /repository not found/i
        ],
        createError: (msg, err) => GateErrors.gitRepositoryNotFound(err)
    },
    {
        patterns: [
            /git.*failed/i,
            /git.*error/i,
            /fatal:.*git/i
        ],
        createError: (msg, err) => GateErrors.gitOperationFailed('unknown', msg, err)
    },
    
    // Python general errors
    {
        patterns: [
            /python.*error/i,
            /python.*failed/i,
            /exit code/i,
            /exited with code/i
        ],
        createError: (msg, err) => GateErrors.pythonMisconfig(msg, err)
    }
];

/**
 * Options for showing error messages
 */
export interface ShowErrorOptions {
    /** Whether to log the error to the output channel */
    log?: boolean;
    
    /** Custom prefix for the error message */
    prefix?: string;
    
    /** Whether to show as modal dialog */
    modal?: boolean;
    
    /** Maximum number of action buttons to show (default: 3) */
    maxActions?: number;
}

/**
 * Result of showing an error message
 */
export interface ShowErrorResult {
    /** The action that was clicked, or undefined if dismissed */
    action?: ErrorAction;
    
    /** Whether the error was shown successfully */
    shown: boolean;
}

/**
 * Callback type for retry operations
 */
export type RetryCallback<T> = () => Promise<T>;

/**
 * Service for handling and displaying gate errors with user-friendly messages
 * and actionable recovery options.
 */
export class ErrorHandlerService {
    private outputChannel: vscode.OutputChannel | undefined;
    private errorHistory: GateError[] = [];
    private readonly maxHistorySize = 50;

    constructor(outputChannel?: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /**
     * Sets the output channel for logging
     */
    public setOutputChannel(channel: vscode.OutputChannel): void {
        this.outputChannel = channel;
    }

    /**
     * Maps a raw error to a GateError with appropriate classification
     */
    public mapError(error: unknown): GateError {
        // If already a GateError, return as-is
        if (isGateError(error)) {
            return error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        const originalError = error instanceof Error ? error : undefined;

        // Try to match against known patterns
        for (const pattern of ERROR_PATTERNS) {
            for (const p of pattern.patterns) {
                const matches = typeof p === 'string' 
                    ? errorMessage.toLowerCase().includes(p.toLowerCase())
                    : p.test(errorMessage);
                
                if (matches) {
                    return pattern.createError(errorMessage, originalError);
                }
            }
        }

        // No pattern matched, return unknown error
        return GateErrors.unknown(errorMessage, originalError);
    }

    /**
     * Shows an error message with action buttons
     */
    public async showErrorWithActions(
        error: GateError | unknown,
        options: ShowErrorOptions = {}
    ): Promise<ShowErrorResult> {
        const gateError = isGateError(error) ? error : this.mapError(error);
        
        // Add to history
        this.addToHistory(gateError);

        // Log if requested
        if (options.log !== false && this.outputChannel) {
            this.logError(gateError);
        }

        // Build message
        const prefix = options.prefix ? `${options.prefix}: ` : '';
        const message = `${prefix}${gateError.userMessage}`;

        // Get action labels (limited by maxActions)
        const maxActions = options.maxActions ?? 3;
        const actions = gateError.actions.slice(0, maxActions);
        const actionLabels = actions.map(a => a.label);

        // Show error message
        let selectedLabel: string | undefined;
        
        if (options.modal) {
            selectedLabel = await vscode.window.showErrorMessage(
                message,
                { modal: true },
                ...actionLabels
            );
        } else {
            selectedLabel = await vscode.window.showErrorMessage(message, ...actionLabels);
        }

        // Execute selected action
        if (selectedLabel) {
            const selectedAction = actions.find(a => a.label === selectedLabel);
            if (selectedAction) {
                await this.executeAction(selectedAction);
                return { action: selectedAction, shown: true };
            }
        }

        return { action: undefined, shown: true };
    }

    /**
     * Shows a warning message with action buttons
     */
    public async showWarningWithActions(
        error: GateError | unknown,
        options: ShowErrorOptions = {}
    ): Promise<ShowErrorResult> {
        const gateError = isGateError(error) ? error : this.mapError(error);
        
        // Add to history
        this.addToHistory(gateError);

        // Log if requested
        if (options.log !== false && this.outputChannel) {
            this.logError(gateError, 'WARN');
        }

        // Build message
        const prefix = options.prefix ? `${options.prefix}: ` : '';
        const message = `${prefix}${gateError.userMessage}`;

        // Get action labels
        const maxActions = options.maxActions ?? 3;
        const actions = gateError.actions.slice(0, maxActions);
        const actionLabels = actions.map(a => a.label);

        // Show warning message
        const selectedLabel = await vscode.window.showWarningMessage(message, ...actionLabels);

        // Execute selected action
        if (selectedLabel) {
            const selectedAction = actions.find(a => a.label === selectedLabel);
            if (selectedAction) {
                await this.executeAction(selectedAction);
                return { action: selectedAction, shown: true };
            }
        }

        return { action: undefined, shown: true };
    }

    /**
     * Executes an error action command
     */
    public async executeAction(action: ErrorAction): Promise<void> {
        try {
            if (action.args && action.args.length > 0) {
                await vscode.commands.executeCommand(action.command, ...action.args);
            } else {
                await vscode.commands.executeCommand(action.command);
            }
        } catch (error) {
            // Log but don't throw - action execution failure shouldn't crash
            if (this.outputChannel) {
                this.outputChannel.appendLine(
                    `[ERROR] Failed to execute action "${action.label}": ${error}`
                );
            }
        }
    }

    /**
     * Logs an error to the output channel
     */
    public logError(error: GateError | unknown, level: 'ERROR' | 'WARN' = 'ERROR'): void {
        if (!this.outputChannel) {
            return;
        }

        const gateError = isGateError(error) ? error : this.mapError(error);
        const timestamp = new Date().toISOString();
        
        this.outputChannel.appendLine(`[${timestamp}] [${level}] [${gateError.code}]`);
        this.outputChannel.appendLine(`  Message: ${gateError.message}`);
        this.outputChannel.appendLine(`  User Message: ${gateError.userMessage}`);
        
        if (gateError.context) {
            this.outputChannel.appendLine(`  Context: ${JSON.stringify(gateError.context)}`);
        }
        
        if (gateError.originalError) {
            this.outputChannel.appendLine(`  Original: ${gateError.originalError.message}`);
            if (gateError.originalError.stack) {
                this.outputChannel.appendLine(`  Stack: ${gateError.originalError.stack}`);
            }
        }
        
        this.outputChannel.appendLine('');
    }

    /**
     * Wraps an async operation with error handling
     */
    public async withErrorHandling<T>(
        operation: () => Promise<T>,
        options: ShowErrorOptions & { 
            fallback?: T;
            rethrow?: boolean;
        } = {}
    ): Promise<T | undefined> {
        try {
            return await operation();
        } catch (error) {
            await this.showErrorWithActions(error, options);
            
            if (options.rethrow) {
                throw isGateError(error) ? error : this.mapError(error);
            }
            
            return options.fallback;
        }
    }

    /**
     * Wraps an async operation with retry capability
     */
    public async withRetry<T>(
        operation: RetryCallback<T>,
        options: {
            maxRetries?: number;
            retryDelay?: number;
            shouldRetry?: (error: GateError) => boolean;
            onRetry?: (attempt: number, error: GateError) => void;
        } = {}
    ): Promise<T> {
        const maxRetries = options.maxRetries ?? 3;
        const retryDelay = options.retryDelay ?? 1000;
        const shouldRetry = options.shouldRetry ?? ((e) => e.code === GateErrorCode.TIMEOUT);

        let lastError: GateError | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = isGateError(error) ? error : this.mapError(error);
                
                if (attempt < maxRetries && shouldRetry(lastError)) {
                    options.onRetry?.(attempt, lastError);
                    await this.delay(retryDelay);
                    continue;
                }
                
                throw lastError;
            }
        }

        // Should never reach here, but TypeScript needs this
        throw lastError ?? GateErrors.unknown('Retry failed');
    }

    /**
     * Gets the error history
     */
    public getErrorHistory(): readonly GateError[] {
        return [...this.errorHistory];
    }

    /**
     * Gets the most recent error
     */
    public getLastError(): GateError | undefined {
        return this.errorHistory[this.errorHistory.length - 1];
    }

    /**
     * Clears the error history
     */
    public clearHistory(): void {
        this.errorHistory = [];
    }

    /**
     * Gets error statistics
     */
    public getErrorStats(): Record<GateErrorCode, number> {
        const stats: Record<GateErrorCode, number> = {
            [GateErrorCode.SCANNER_MISSING]: 0,
            [GateErrorCode.PYTHON_MISCONFIG]: 0,
            [GateErrorCode.TIMEOUT]: 0,
            [GateErrorCode.PARSE_FAIL]: 0,
            [GateErrorCode.GIT_API_FAIL]: 0,
            [GateErrorCode.UNKNOWN]: 0
        };

        for (const error of this.errorHistory) {
            stats[error.code]++;
        }

        return stats;
    }

    /**
     * Checks if a specific error type has occurred recently
     */
    public hasRecentError(code: GateErrorCode, withinMs: number = 60000): boolean {
        const cutoff = Date.now() - withinMs;
        return this.errorHistory.some(
            e => e.code === code && e.timestamp.getTime() > cutoff
        );
    }

    /**
     * Creates a GateError from an error code with default message
     */
    public createError(code: GateErrorCode, details?: string, originalError?: Error): GateError {
        switch (code) {
            case GateErrorCode.SCANNER_MISSING:
                return GateErrors.scannerMissing(details || 'unknown', originalError);
            case GateErrorCode.PYTHON_MISCONFIG:
                return GateErrors.pythonMisconfig(details || 'Unknown configuration issue', originalError);
            case GateErrorCode.TIMEOUT:
                return GateErrors.timeout(details || 'operation', 60000, originalError);
            case GateErrorCode.PARSE_FAIL:
                return GateErrors.parseFailOutput(details || '', originalError);
            case GateErrorCode.GIT_API_FAIL:
                return GateErrors.gitOperationFailed('unknown', details || 'Unknown error', originalError);
            case GateErrorCode.UNKNOWN:
            default:
                return GateErrors.unknown(details || 'An unknown error occurred', originalError);
        }
    }

    /**
     * Adds an error to history
     */
    private addToHistory(error: GateError): void {
        this.errorHistory.push(error);
        
        // Trim history if too large
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Delays execution
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
let errorHandlerInstance: ErrorHandlerService | undefined;

/**
 * Gets the singleton ErrorHandlerService instance
 */
export function getErrorHandlerService(): ErrorHandlerService {
    if (!errorHandlerInstance) {
        errorHandlerInstance = new ErrorHandlerService();
    }
    return errorHandlerInstance;
}

/**
 * Initializes the error handler service with an output channel
 */
export function initializeErrorHandler(outputChannel: vscode.OutputChannel): ErrorHandlerService {
    const service = getErrorHandlerService();
    service.setOutputChannel(outputChannel);
    return service;
}

/**
 * Convenience function to show an error with actions
 */
export async function showGateError(
    error: unknown,
    options?: ShowErrorOptions
): Promise<ShowErrorResult> {
    return getErrorHandlerService().showErrorWithActions(error, options);
}

/**
 * Convenience function to map any error to a GateError
 */
export function mapToGateError(error: unknown): GateError {
    return getErrorHandlerService().mapError(error);
}

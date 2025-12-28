/**
 * Gate Progress Service
 * 
 * Provides progress display and cancellation support for security gate operations.
 * Uses VS Code's withProgress API to show step-by-step progress during scanning.
 */

import * as vscode from 'vscode';

/**
 * Progress step types for the security gate workflow
 */
export type GateProgressStep = 'collecting' | 'mapping' | 'scanning' | 'deciding';

/**
 * Progress information for each step
 */
export interface GateProgressInfo {
    /** Current step in the workflow */
    step: GateProgressStep;
    /** Human-readable message for the step */
    message: string;
    /** Optional increment percentage (0-100) */
    increment?: number;
}

/**
 * Error thrown when an operation is cancelled by the user
 */
export class OperationCancelledError extends Error {
    public readonly step: GateProgressStep;
    public readonly timestamp: Date;

    constructor(step: GateProgressStep, message?: string) {
        super(message || `Operation cancelled during ${step} step`);
        this.name = 'OperationCancelledError';
        this.step = step;
        this.timestamp = new Date();

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, OperationCancelledError);
        }
    }
}

/**
 * Type guard to check if an error is an OperationCancelledError
 */
export function isOperationCancelledError(error: unknown): error is OperationCancelledError {
    return error instanceof OperationCancelledError;
}

/**
 * Progress reporter interface for step-by-step updates
 */
export interface ProgressReporter {
    /** Report progress for a specific step */
    report(info: GateProgressInfo): void;
    
    /** Check if the operation has been cancelled */
    isCancelled(): boolean;
    
    /** Throw OperationCancelledError if cancelled */
    checkCancellation(step: GateProgressStep): void;
    
    /** Get the cancellation token */
    readonly token: vscode.CancellationToken;
}

/**
 * Options for running a task with progress
 */
export interface RunWithProgressOptions {
    /** Title shown in the progress notification */
    title: string;
    
    /** Location of the progress indicator */
    location?: vscode.ProgressLocation;
    
    /** Whether the progress can be cancelled */
    cancellable?: boolean;
}

/**
 * Default progress percentages for each step
 */
const STEP_PROGRESS: Record<GateProgressStep, { start: number; end: number }> = {
    collecting: { start: 0, end: 10 },
    mapping: { start: 10, end: 30 },
    scanning: { start: 30, end: 90 },
    deciding: { start: 90, end: 100 }
};

/**
 * Default messages for each step
 */
const STEP_MESSAGES: Record<GateProgressStep, string> = {
    collecting: 'Collecting staged changes...',
    mapping: 'Mapping changes to functions...',
    scanning: 'Scanning functions...',
    deciding: 'Making decision...'
};

/**
 * Service for managing progress display and cancellation during gate operations
 */
export class GateProgressService {
    private outputChannel: vscode.OutputChannel | undefined;

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
     * Runs a task with progress display and cancellation support
     * 
     * @param title - Title shown in the progress notification
     * @param task - The async task to run with progress and cancellation support
     * @returns The result of the task, or undefined if cancelled
     */
    public async runWithProgress<T>(
        title: string,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>
    ): Promise<T | undefined> {
        return this.runWithProgressOptions({ title }, task);
    }

    /**
     * Runs a task with progress display and cancellation support (with options)
     * 
     * @param options - Progress options including title, location, and cancellable flag
     * @param task - The async task to run with progress and cancellation support
     * @returns The result of the task, or undefined if cancelled
     */
    public async runWithProgressOptions<T>(
        options: RunWithProgressOptions,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>
    ): Promise<T | undefined> {
        const location = options.location ?? vscode.ProgressLocation.Notification;
        const cancellable = options.cancellable ?? true;

        try {
            return await vscode.window.withProgress(
                {
                    location,
                    title: options.title,
                    cancellable
                },
                async (progress, token) => {
                    // Log start
                    this.log(`Starting: ${options.title}`);

                    try {
                        const result = await task(progress, token);
                        this.log(`Completed: ${options.title}`);
                        return result;
                    } catch (error) {
                        if (isOperationCancelledError(error)) {
                            this.log(`Cancelled: ${options.title} at step "${error.step}"`);
                            return undefined;
                        }
                        throw error;
                    }
                }
            );
        } catch (error) {
            if (isOperationCancelledError(error)) {
                this.log(`Cancelled: ${options.title}`);
                return undefined;
            }
            throw error;
        }
    }

    /**
     * Creates a progress reporter for step-by-step updates
     * 
     * @param progress - VS Code progress object
     * @param token - Cancellation token
     * @returns A ProgressReporter for reporting step progress
     */
    public createProgressReporter(
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken
    ): ProgressReporter {
        let lastReportedProgress = 0;

        return {
            report: (info: GateProgressInfo) => {
                // Check cancellation before reporting
                if (token.isCancellationRequested) {
                    throw new OperationCancelledError(info.step);
                }

                const stepProgress = STEP_PROGRESS[info.step];
                let increment: number;

                if (info.increment !== undefined) {
                    // Use provided increment
                    increment = info.increment;
                } else {
                    // Calculate increment based on step
                    const targetProgress = stepProgress.start;
                    increment = Math.max(0, targetProgress - lastReportedProgress);
                }

                lastReportedProgress += increment;

                progress.report({
                    message: info.message,
                    increment
                });

                this.log(`[${info.step}] ${info.message} (+${increment}%)`);
            },

            isCancelled: () => token.isCancellationRequested,

            checkCancellation: (step: GateProgressStep) => {
                if (token.isCancellationRequested) {
                    throw new OperationCancelledError(step);
                }
            },

            token
        };
    }

    /**
     * Reports progress for the "collecting" step
     */
    public reportCollecting(
        reporter: ProgressReporter,
        customMessage?: string
    ): void {
        reporter.report({
            step: 'collecting',
            message: customMessage || STEP_MESSAGES.collecting,
            increment: STEP_PROGRESS.collecting.end - STEP_PROGRESS.collecting.start
        });
    }

    /**
     * Reports progress for the "mapping" step
     */
    public reportMapping(
        reporter: ProgressReporter,
        customMessage?: string
    ): void {
        reporter.report({
            step: 'mapping',
            message: customMessage || STEP_MESSAGES.mapping,
            increment: STEP_PROGRESS.mapping.end - STEP_PROGRESS.mapping.start
        });
    }

    /**
     * Reports progress for the "scanning" step with incremental updates
     * 
     * @param reporter - Progress reporter
     * @param current - Current function being scanned (1-based)
     * @param total - Total number of functions to scan
     * @param functionName - Optional name of the function being scanned
     */
    public reportScanning(
        reporter: ProgressReporter,
        current: number,
        total: number,
        functionName?: string
    ): void {
        const scanRange = STEP_PROGRESS.scanning.end - STEP_PROGRESS.scanning.start;
        const incrementPerFunction = total > 0 ? scanRange / total : scanRange;
        
        const message = functionName
            ? `Scanning function ${current}/${total}: ${functionName}...`
            : `Scanning ${current}/${total} functions...`;

        reporter.report({
            step: 'scanning',
            message,
            increment: incrementPerFunction
        });
    }

    /**
     * Reports progress for the "deciding" step
     */
    public reportDeciding(
        reporter: ProgressReporter,
        customMessage?: string
    ): void {
        reporter.report({
            step: 'deciding',
            message: customMessage || STEP_MESSAGES.deciding,
            increment: STEP_PROGRESS.deciding.end - STEP_PROGRESS.deciding.start
        });
    }

    /**
     * Gets the default message for a step
     */
    public getStepMessage(step: GateProgressStep): string {
        return STEP_MESSAGES[step];
    }

    /**
     * Gets the progress range for a step
     */
    public getStepProgressRange(step: GateProgressStep): { start: number; end: number } {
        return { ...STEP_PROGRESS[step] };
    }

    /**
     * Logs a message to the output channel
     */
    private log(message: string): void {
        if (this.outputChannel) {
            const timestamp = new Date().toISOString();
            this.outputChannel.appendLine(`[${timestamp}] [Progress] ${message}`);
        }
    }
}

// Singleton instance
let progressServiceInstance: GateProgressService | undefined;

/**
 * Gets the singleton GateProgressService instance
 */
export function getGateProgressService(): GateProgressService {
    if (!progressServiceInstance) {
        progressServiceInstance = new GateProgressService();
    }
    return progressServiceInstance;
}

/**
 * Initializes the progress service with an output channel
 */
export function initializeProgressService(outputChannel: vscode.OutputChannel): GateProgressService {
    const service = getGateProgressService();
    service.setOutputChannel(outputChannel);
    return service;
}

/**
 * Convenience function to run a task with progress
 */
export async function runWithProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>
): Promise<T | undefined> {
    return getGateProgressService().runWithProgress(title, task);
}

/**
 * Convenience function to create a progress reporter
 */
export function createProgressReporter(
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
): ProgressReporter {
    return getGateProgressService().createProgressReporter(progress, token);
}

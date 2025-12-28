/**
 * Gate Status Service
 * 
 * Manages gate status state and emits events for real-time updates.
 * Uses VS Code EventEmitter pattern for sidebar and other component subscriptions.
 */

import * as vscode from 'vscode';
import {
    GateStatus,
    GateProgress,
    GateStatusEvent,
    GateStatusChangedEvent,
    GateRunStartedEvent,
    GateRunCompletedEvent,
    GateProgressUpdatedEvent,
    GateErrorEvent,
    createDefaultGateStatus,
    cloneGateStatus,
    areGateStatusesEqual
} from '../models/gateStatus';
import { GateDecision } from './gatePolicy';
import { AggregatedGateResult } from './securityGateService';

/**
 * Service for managing and broadcasting gate status changes.
 * Implements the singleton pattern for global access.
 */
export class GateStatusService implements vscode.Disposable {
    private static instance: GateStatusService | undefined;

    // Event emitters for different event types
    private readonly _onStatusChanged = new vscode.EventEmitter<GateStatusChangedEvent>();
    private readonly _onRunStarted = new vscode.EventEmitter<GateRunStartedEvent>();
    private readonly _onRunCompleted = new vscode.EventEmitter<GateRunCompletedEvent>();
    private readonly _onProgressUpdated = new vscode.EventEmitter<GateProgressUpdatedEvent>();
    private readonly _onError = new vscode.EventEmitter<GateErrorEvent>();
    
    // Combined event emitter for all events
    private readonly _onEvent = new vscode.EventEmitter<GateStatusEvent>();

    // Public event subscriptions
    readonly onStatusChanged: vscode.Event<GateStatusChangedEvent> = this._onStatusChanged.event;
    readonly onRunStarted: vscode.Event<GateRunStartedEvent> = this._onRunStarted.event;
    readonly onRunCompleted: vscode.Event<GateRunCompletedEvent> = this._onRunCompleted.event;
    readonly onProgressUpdated: vscode.Event<GateProgressUpdatedEvent> = this._onProgressUpdated.event;
    readonly onError: vscode.Event<GateErrorEvent> = this._onError.event;
    readonly onEvent: vscode.Event<GateStatusEvent> = this._onEvent.event;

    // Current status state
    private _status: GateStatus;
    private _currentScope: 'commit' | 'push' | undefined;
    private _runStartTime: Date | undefined;

    private constructor() {
        this._status = createDefaultGateStatus();
    }

    /**
     * Gets the singleton instance of GateStatusService
     */
    static getInstance(): GateStatusService {
        if (!GateStatusService.instance) {
            GateStatusService.instance = new GateStatusService();
        }
        return GateStatusService.instance;
    }

    /**
     * Resets the singleton instance (useful for testing)
     */
    static resetInstance(): void {
        if (GateStatusService.instance) {
            GateStatusService.instance.dispose();
            GateStatusService.instance = undefined;
        }
    }

    /**
     * Gets the current gate status
     */
    get status(): GateStatus {
        return cloneGateStatus(this._status);
    }

    /**
     * Gets whether a gate run is currently in progress
     */
    get isRunning(): boolean {
        return this._status.isRunning;
    }

    /**
     * Gets the last decision from the gate
     */
    get lastDecision(): GateDecision | undefined {
        return this._status.lastDecision;
    }

    /**
     * Signals that a gate run has started
     */
    notifyRunStarted(scope: 'commit' | 'push'): void {
        const previousStatus = cloneGateStatus(this._status);
        this._runStartTime = new Date();
        this._currentScope = scope;

        this._status = {
            ...this._status,
            isRunning: true,
            blockingReasons: [] // Clear previous blocking reasons
        };

        const startedEvent: GateRunStartedEvent = {
            type: 'runStarted',
            scope,
            timestamp: this._runStartTime
        };

        const changedEvent: GateStatusChangedEvent = {
            type: 'statusChanged',
            status: cloneGateStatus(this._status),
            previousStatus
        };

        this._onRunStarted.fire(startedEvent);
        this._onStatusChanged.fire(changedEvent);
        this._onEvent.fire(startedEvent);
        this._onEvent.fire(changedEvent);
    }

    /**
     * Signals that a gate run has completed
     */
    notifyRunCompleted(result: AggregatedGateResult): void {
        const previousStatus = cloneGateStatus(this._status);
        const endTime = new Date();
        const durationMs = this._runStartTime 
            ? endTime.getTime() - this._runStartTime.getTime()
            : result.scanDurationMs;

        // Extract blocking reasons from the result
        const blockingReasons: string[] = [];
        if (result.decision === 'BLOCK') {
            blockingReasons.push(...result.reasons);
        }

        this._status = {
            lastRunTime: endTime,
            lastDecision: result.decision,
            scannedFilesCount: result.filesScanned,
            scannedFunctionsCount: result.functionsScanned,
            blockingReasons,
            isRunning: false
        };

        const completedEvent: GateRunCompletedEvent = {
            type: 'runCompleted',
            status: cloneGateStatus(this._status),
            durationMs,
            scope: this._currentScope || result.scanScope
        };

        const changedEvent: GateStatusChangedEvent = {
            type: 'statusChanged',
            status: cloneGateStatus(this._status),
            previousStatus
        };

        this._onRunCompleted.fire(completedEvent);
        this._onStatusChanged.fire(changedEvent);
        this._onEvent.fire(completedEvent);
        this._onEvent.fire(changedEvent);

        // Reset run state
        this._runStartTime = undefined;
        this._currentScope = undefined;
    }

    /**
     * Updates progress during a gate run
     */
    notifyProgress(progress: GateProgress): void {
        // Update scanned counts if provided
        if (progress.filesScanned !== undefined) {
            this._status.scannedFilesCount = progress.filesScanned;
        }

        const progressEvent: GateProgressUpdatedEvent = {
            type: 'progressUpdated',
            progress
        };

        this._onProgressUpdated.fire(progressEvent);
        this._onEvent.fire(progressEvent);
    }

    /**
     * Signals that an error occurred during a gate run
     */
    notifyError(error: Error, message?: string): void {
        const previousStatus = cloneGateStatus(this._status);

        this._status = {
            ...this._status,
            isRunning: false,
            blockingReasons: [message || error.message]
        };

        const errorEvent: GateErrorEvent = {
            type: 'error',
            error,
            message: message || error.message
        };

        const changedEvent: GateStatusChangedEvent = {
            type: 'statusChanged',
            status: cloneGateStatus(this._status),
            previousStatus
        };

        this._onError.fire(errorEvent);
        this._onStatusChanged.fire(changedEvent);
        this._onEvent.fire(errorEvent);
        this._onEvent.fire(changedEvent);

        // Reset run state
        this._runStartTime = undefined;
        this._currentScope = undefined;
    }

    /**
     * Manually updates the status (for external updates)
     */
    updateStatus(partialStatus: Partial<GateStatus>): void {
        const previousStatus = cloneGateStatus(this._status);
        
        this._status = {
            ...this._status,
            ...partialStatus,
            // Ensure blockingReasons is always an array
            blockingReasons: partialStatus.blockingReasons 
                ? [...partialStatus.blockingReasons]
                : this._status.blockingReasons
        };

        // Only fire event if status actually changed
        if (!areGateStatusesEqual(previousStatus, this._status)) {
            const changedEvent: GateStatusChangedEvent = {
                type: 'statusChanged',
                status: cloneGateStatus(this._status),
                previousStatus
            };

            this._onStatusChanged.fire(changedEvent);
            this._onEvent.fire(changedEvent);
        }
    }

    /**
     * Resets the status to default values
     */
    reset(): void {
        const previousStatus = cloneGateStatus(this._status);
        this._status = createDefaultGateStatus();
        this._runStartTime = undefined;
        this._currentScope = undefined;

        if (!areGateStatusesEqual(previousStatus, this._status)) {
            const changedEvent: GateStatusChangedEvent = {
                type: 'statusChanged',
                status: cloneGateStatus(this._status),
                previousStatus
            };

            this._onStatusChanged.fire(changedEvent);
            this._onEvent.fire(changedEvent);
        }
    }

    /**
     * Creates a progress callback function for use with SecurityGateService
     */
    createProgressCallback(): (message: string, increment?: number) => void {
        let currentPercentage = 0;
        let filesScanned = 0;

        return (message: string, increment?: number) => {
            if (increment !== undefined) {
                currentPercentage = Math.min(100, currentPercentage + increment);
            }

            // Try to extract file info from message
            const fileMatch = message.match(/Scanning (.+)\.\.\./);
            const currentFile = fileMatch ? fileMatch[1] : undefined;

            // Try to extract progress numbers
            const progressMatch = message.match(/(\d+)\/(\d+)/);
            let totalFiles: number | undefined;
            if (progressMatch) {
                filesScanned = parseInt(progressMatch[1], 10);
                totalFiles = parseInt(progressMatch[2], 10);
            }

            this.notifyProgress({
                message,
                percentage: currentPercentage,
                currentFile,
                filesScanned,
                totalFiles
            });
        };
    }

    /**
     * Disposes of all event emitters
     */
    dispose(): void {
        this._onStatusChanged.dispose();
        this._onRunStarted.dispose();
        this._onRunCompleted.dispose();
        this._onProgressUpdated.dispose();
        this._onError.dispose();
        this._onEvent.dispose();
    }
}

/**
 * Convenience function to get the GateStatusService instance
 */
export function getGateStatusService(): GateStatusService {
    return GateStatusService.getInstance();
}

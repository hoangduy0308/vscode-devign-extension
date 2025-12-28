/**
 * Gate Status Model
 * 
 * Defines the state for security gate runs including:
 * - Last run time and decision
 * - Scanned files/functions count
 * - Blocking reasons
 * - Running state
 */

import { GateDecision } from '../services/gatePolicy';

/**
 * Represents the current status of the security gate
 */
export interface GateStatus {
    /** Timestamp of the last gate run */
    lastRunTime: Date | undefined;
    
    /** Decision from the last gate run */
    lastDecision: GateDecision | undefined;
    
    /** Number of files scanned in the last run */
    scannedFilesCount: number;
    
    /** Number of functions scanned in the last run */
    scannedFunctionsCount: number;
    
    /** List of reasons why the gate blocked (if applicable) */
    blockingReasons: string[];
    
    /** Whether a gate scan is currently in progress */
    isRunning: boolean;
}

/**
 * Progress information during a gate run
 */
export interface GateProgress {
    /** Current progress message */
    message: string;
    
    /** Progress percentage (0-100) */
    percentage: number;
    
    /** Current file being scanned (if applicable) */
    currentFile?: string;
    
    /** Total files to scan */
    totalFiles?: number;
    
    /** Files scanned so far */
    filesScanned?: number;
}

/**
 * Event types emitted by the GateStatusService
 */
export type GateStatusEventType = 
    | 'statusChanged'
    | 'runStarted'
    | 'runCompleted'
    | 'progressUpdated'
    | 'error';

/**
 * Event data for gate status changes
 */
export interface GateStatusChangedEvent {
    type: 'statusChanged';
    status: GateStatus;
    previousStatus?: GateStatus;
}

/**
 * Event data for gate run started
 */
export interface GateRunStartedEvent {
    type: 'runStarted';
    scope: 'commit' | 'push';
    timestamp: Date;
}

/**
 * Event data for gate run completed
 */
export interface GateRunCompletedEvent {
    type: 'runCompleted';
    status: GateStatus;
    durationMs: number;
    scope: 'commit' | 'push';
}

/**
 * Event data for progress updates
 */
export interface GateProgressUpdatedEvent {
    type: 'progressUpdated';
    progress: GateProgress;
}

/**
 * Event data for errors
 */
export interface GateErrorEvent {
    type: 'error';
    error: Error;
    message: string;
}

/**
 * Union type for all gate status events
 */
export type GateStatusEvent = 
    | GateStatusChangedEvent
    | GateRunStartedEvent
    | GateRunCompletedEvent
    | GateProgressUpdatedEvent
    | GateErrorEvent;

/**
 * Creates a default/initial gate status
 */
export function createDefaultGateStatus(): GateStatus {
    return {
        lastRunTime: undefined,
        lastDecision: undefined,
        scannedFilesCount: 0,
        scannedFunctionsCount: 0,
        blockingReasons: [],
        isRunning: false
    };
}

/**
 * Creates a copy of a gate status object
 */
export function cloneGateStatus(status: GateStatus): GateStatus {
    return {
        lastRunTime: status.lastRunTime,
        lastDecision: status.lastDecision,
        scannedFilesCount: status.scannedFilesCount,
        scannedFunctionsCount: status.scannedFunctionsCount,
        blockingReasons: [...status.blockingReasons],
        isRunning: status.isRunning
    };
}

/**
 * Checks if two gate statuses are equal
 */
export function areGateStatusesEqual(a: GateStatus, b: GateStatus): boolean {
    return (
        a.lastRunTime?.getTime() === b.lastRunTime?.getTime() &&
        a.lastDecision === b.lastDecision &&
        a.scannedFilesCount === b.scannedFilesCount &&
        a.scannedFunctionsCount === b.scannedFunctionsCount &&
        a.blockingReasons.length === b.blockingReasons.length &&
        a.blockingReasons.every((r, i) => r === b.blockingReasons[i]) &&
        a.isRunning === b.isRunning
    );
}

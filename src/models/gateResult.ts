import { ScanResult } from '../scanner';
import { GatePolicyConfig, GateDecision, GateResult } from '../services/gatePolicy';
import { FunctionScanResult } from '../services/functionScanner';

export type GateScope = 'commit' | 'push';

export interface FileChangeResult {
    filePath: string;
    status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?' | '!';
    scanned: boolean;
    scanResults: FunctionScanResult[];
    error?: string;
}

export interface AggregatedGateResult extends GateResult {
    filesScanned: number;
    functionsScanned: number;
    scanScope: GateScope;
    changedFiles: FileChangeResult[];
    startTime: Date;
    endTime: Date;
}

export interface GateRunSummary {
    decision: GateDecision;
    totalFiles: number;
    filesScanned: number;
    filesSkipped: number;
    functionsScanned: number;
    vulnerableCount: number;
    blockedCount: number;
    warnedCount: number;
    durationMs: number;
    scope: GateScope;
}

export function summarizeGateResult(result: AggregatedGateResult): GateRunSummary {
    const filesSkipped = result.changedFiles.filter(f => !f.scanned).length;
    const vulnerableCount = result.findings.filter(f => f.vulnerable).length;

    return {
        decision: result.decision,
        totalFiles: result.changedFiles.length,
        filesScanned: result.filesScanned,
        filesSkipped,
        functionsScanned: result.functionsScanned,
        vulnerableCount,
        blockedCount: result.blockedFindings.length,
        warnedCount: result.warnedFindings.length,
        durationMs: result.scanDurationMs,
        scope: result.scanScope
    };
}

export { GateDecision, GateResult, GatePolicyConfig };

import * as vscode from 'vscode';
import { ScanResult } from '../scanner';

export interface GatePolicyConfig {
    enabled: boolean;
    blockThreshold: number;
    warnThreshold: number;
    maxCriticalFindings: number;
    maxHighFindings: number;
    fallbackMode: 'allow' | 'warn' | 'block';
    timeoutSeconds: number;
    allowedFilePatterns?: string[];
}

export type GateDecision = 'PASS' | 'WARN' | 'BLOCK';

export interface GateResult {
    decision: GateDecision;
    reasons: string[];
    findings: ScanResult[];
    blockedFindings: ScanResult[];
    warnedFindings: ScanResult[];
    scanDurationMs: number;
    policyUsed: GatePolicyConfig;
}

export class GatePolicyService {
    getDefaultPolicy(): GatePolicyConfig {
        return {
            enabled: false,
            blockThreshold: 0.8,
            warnThreshold: 0.5,
            maxCriticalFindings: 0,
            maxHighFindings: 3,
            fallbackMode: 'warn',
            timeoutSeconds: 120,
            allowedFilePatterns: []
        };
    }

    loadPolicy(): GatePolicyConfig {
        const config = vscode.workspace.getConfiguration('devign.gate');
        const defaults = this.getDefaultPolicy();

        return {
            enabled: config.get<boolean>('enabled') ?? defaults.enabled,
            blockThreshold: config.get<number>('blockThreshold') ?? defaults.blockThreshold,
            warnThreshold: config.get<number>('warnThreshold') ?? defaults.warnThreshold,
            maxCriticalFindings: config.get<number>('maxCriticalFindings') ?? defaults.maxCriticalFindings,
            maxHighFindings: config.get<number>('maxHighFindings') ?? defaults.maxHighFindings,
            fallbackMode: config.get<'allow' | 'warn' | 'block'>('fallbackMode') ?? defaults.fallbackMode,
            timeoutSeconds: config.get<number>('timeoutSeconds') ?? defaults.timeoutSeconds,
            allowedFilePatterns: config.get<string[]>('allowedFilePatterns') ?? defaults.allowedFilePatterns
        };
    }

    evaluateResults(results: ScanResult[], scanDurationMs: number = 0): GateResult {
        const policy = this.loadPolicy();
        const reasons: string[] = [];
        const blockedFindings: ScanResult[] = [];
        const warnedFindings: ScanResult[] = [];

        let criticalCount = 0;
        let highCount = 0;

        for (const result of results) {
            if (!result.vulnerable) {
                continue;
            }

            const riskLevel = result.risk_level.toUpperCase();
            if (riskLevel === 'CRITICAL') {
                criticalCount++;
            } else if (riskLevel === 'HIGH') {
                highCount++;
            }

            if (result.probability >= policy.blockThreshold) {
                blockedFindings.push(result);
            } else if (result.probability >= policy.warnThreshold) {
                warnedFindings.push(result);
            }
        }

        let decision: GateDecision = 'PASS';

        if (blockedFindings.length > 0) {
            decision = 'BLOCK';
            reasons.push(`${blockedFindings.length} finding(s) exceed block threshold (${policy.blockThreshold})`);
        }

        if (policy.maxCriticalFindings >= 0 && criticalCount > policy.maxCriticalFindings) {
            decision = 'BLOCK';
            reasons.push(`${criticalCount} critical finding(s) exceed maximum allowed (${policy.maxCriticalFindings})`);
        }

        if (policy.maxHighFindings >= 0 && highCount > policy.maxHighFindings) {
            decision = 'BLOCK';
            reasons.push(`${highCount} high severity finding(s) exceed maximum allowed (${policy.maxHighFindings})`);
        }

        if (decision !== 'BLOCK' && warnedFindings.length > 0) {
            decision = 'WARN';
            reasons.push(`${warnedFindings.length} finding(s) exceed warn threshold (${policy.warnThreshold})`);
        }

        if (decision === 'PASS' && results.length > 0) {
            reasons.push('All scanned files passed policy checks');
        } else if (decision === 'PASS') {
            reasons.push('No files scanned');
        }

        return {
            decision,
            reasons,
            findings: results,
            blockedFindings,
            warnedFindings,
            scanDurationMs,
            policyUsed: policy
        };
    }

    evaluateFallback(error: Error, scanDurationMs: number = 0): GateResult {
        const policy = this.loadPolicy();
        const decision = this.fallbackModeToDecision(policy.fallbackMode);

        return {
            decision,
            reasons: [`Scan failed: ${error.message}. Using fallback mode: ${policy.fallbackMode}`],
            findings: [],
            blockedFindings: [],
            warnedFindings: [],
            scanDurationMs,
            policyUsed: policy
        };
    }

    private fallbackModeToDecision(mode: 'allow' | 'warn' | 'block'): GateDecision {
        switch (mode) {
            case 'allow': return 'PASS';
            case 'warn': return 'WARN';
            case 'block': return 'BLOCK';
        }
    }
}

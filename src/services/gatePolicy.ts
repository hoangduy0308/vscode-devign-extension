import * as vscode from 'vscode';
import { ScanResult } from '../scanner';

/**
 * Important disclaimer about Devign model limitations.
 * This should be shown to users on both PASS and FAIL results.
 */
export const DEVIGN_DISCLAIMER = 
    'Devign checks vulnerabilities WITHIN individual functions only. ' +
    'It does NOT track data flow across functions, call chains, or complex logic flows. ' +
    'Treat results as best-effort signals, not proof of security.';

export type GateScanScope = 'staged' | 'staged+unstaged';
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface GatePolicyConfig {
    enabled: boolean;
    onCommit: boolean;
    onPush: boolean;
    scope: GateScanScope;
    blockOnRiskLevels: RiskLevel[];
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
    /** Disclaimer about model limitations - always included */
    disclaimer: string;
}

export class GatePolicyService {
    getDefaultPolicy(): GatePolicyConfig {
        return {
            enabled: false,
            onCommit: true,
            onPush: false,
            scope: 'staged',
            blockOnRiskLevels: ['CRITICAL', 'HIGH'],
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
            onCommit: config.get<boolean>('onCommit') ?? defaults.onCommit,
            onPush: config.get<boolean>('onPush') ?? defaults.onPush,
            scope: config.get<GateScanScope>('scope') ?? defaults.scope,
            blockOnRiskLevels: config.get<RiskLevel[]>('blockOnRiskLevels') ?? defaults.blockOnRiskLevels,
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
            policyUsed: policy,
            disclaimer: DEVIGN_DISCLAIMER
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
            policyUsed: policy,
            disclaimer: DEVIGN_DISCLAIMER
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

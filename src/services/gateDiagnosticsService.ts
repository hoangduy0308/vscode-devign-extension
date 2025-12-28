/**
 * Gate Diagnostics Service
 * 
 * Manages VS Code diagnostics for security gate scan results.
 * Only annotates lines within changed functions (not whole files)
 * to provide focused, actionable feedback to developers.
 */

import * as vscode from 'vscode';
import { FunctionScanResult, FunctionInfo } from './functionScanner';
import { ScanResult } from '../scanner';

/**
 * Result from a gate scan that includes function information
 */
export interface GateScanResult extends ScanResult {
    /** Information about the function that was scanned */
    functionInfo?: FunctionInfo;
}

/**
 * Service for managing VS Code diagnostics for security gate results.
 * Filters diagnostics to only show lines within changed functions.
 */
export class GateDiagnosticsService implements vscode.Disposable {
    private static instance: GateDiagnosticsService | undefined;
    private diagnosticCollection: vscode.DiagnosticCollection;

    private constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('devign-gate');
    }

    /**
     * Gets the singleton instance of GateDiagnosticsService
     */
    static getInstance(): GateDiagnosticsService {
        if (!GateDiagnosticsService.instance) {
            GateDiagnosticsService.instance = new GateDiagnosticsService();
        }
        return GateDiagnosticsService.instance;
    }

    /**
     * Resets the singleton instance (useful for testing)
     */
    static resetInstance(): void {
        if (GateDiagnosticsService.instance) {
            GateDiagnosticsService.instance.dispose();
            GateDiagnosticsService.instance = undefined;
        }
    }

    /**
     * Sets diagnostics for gate scan results.
     * Only shows diagnostics for lines within changed functions.
     * 
     * @param results Array of gate scan results with function information
     */
    setDiagnosticsForGate(results: GateScanResult[]): void {
        // Clear existing gate diagnostics first
        this.diagnosticCollection.clear();

        // Group diagnostics by file URI
        const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>();

        for (const result of results) {
            // Skip non-vulnerable results
            if (!result.vulnerable) {
                continue;
            }

            const filePath = result.functionInfo?.filePath || result.file_path;
            if (!filePath) {
                continue;
            }

            const uri = vscode.Uri.file(filePath);
            const uriKey = uri.toString();

            if (!diagnosticsByUri.has(uriKey)) {
                diagnosticsByUri.set(uriKey, []);
            }

            const diagnostics = diagnosticsByUri.get(uriKey)!;
            const functionBounds = result.functionInfo 
                ? { start: result.functionInfo.startLine, end: result.functionInfo.endLine }
                : undefined;

            // Create diagnostics for dangerous lines
            if (result.dangerous_lines && result.dangerous_lines.length > 0) {
                for (const dl of result.dangerous_lines) {
                    // Filter: only include lines within the function bounds
                    if (functionBounds && !this.isLineInFunction(dl.line, functionBounds)) {
                        continue;
                    }

                    const severity = this.getSeverityFromRiskLevel(result.risk_level, result.probability);
                    const range = new vscode.Range(
                        dl.line - 1, // VS Code uses 0-based line numbers
                        dl.column_start || 0,
                        dl.line - 1,
                        dl.column_end || Number.MAX_SAFE_INTEGER
                    );

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        this.formatDiagnosticMessage(dl.message, result),
                        severity
                    );

                    diagnostic.source = 'Devign Gate';
                    diagnostic.code = this.getDiagnosticCode(result.risk_level);

                    // Add related information if we have function context
                    if (result.functionInfo) {
                        diagnostic.relatedInformation = [
                            new vscode.DiagnosticRelatedInformation(
                                new vscode.Location(
                                    uri,
                                    new vscode.Range(
                                        result.functionInfo.startLine - 1, 0,
                                        result.functionInfo.startLine - 1, 0
                                    )
                                ),
                                `In function: ${result.functionInfo.name}`
                            )
                        ];
                    }

                    diagnostics.push(diagnostic);
                }
            } else if (functionBounds) {
                // No specific dangerous lines, but we have function bounds
                // Create a diagnostic at the function start
                const severity = this.getSeverityFromRiskLevel(result.risk_level, result.probability);
                const range = new vscode.Range(
                    functionBounds.start - 1, 0,
                    functionBounds.start - 1, Number.MAX_SAFE_INTEGER
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    this.formatGenericDiagnosticMessage(result),
                    severity
                );

                diagnostic.source = 'Devign Gate';
                diagnostic.code = this.getDiagnosticCode(result.risk_level);

                diagnostics.push(diagnostic);
            }
        }

        // Apply diagnostics to each file
        for (const [uriKey, diagnostics] of diagnosticsByUri) {
            const uri = vscode.Uri.parse(uriKey);
            this.diagnosticCollection.set(uri, diagnostics);
        }
    }

    /**
     * Clears all gate-specific diagnostics
     */
    clearGateDiagnostics(): void {
        this.diagnosticCollection.clear();
    }

    /**
     * Gets the diagnostic collection (for advanced usage)
     */
    getDiagnosticCollection(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    /**
     * Checks if a line number is within the function bounds
     */
    private isLineInFunction(line: number, bounds: { start: number; end: number }): boolean {
        return line >= bounds.start && line <= bounds.end;
    }

    /**
     * Determines the diagnostic severity based on risk level and probability
     */
    private getSeverityFromRiskLevel(riskLevel: string, probability: number): vscode.DiagnosticSeverity {
        const level = riskLevel.toUpperCase();

        // Critical or very high probability -> Error
        if (level === 'CRITICAL' || probability >= 0.8) {
            return vscode.DiagnosticSeverity.Error;
        }

        // High or moderately high probability -> Warning
        if (level === 'HIGH' || probability >= 0.6) {
            return vscode.DiagnosticSeverity.Warning;
        }

        // Medium -> Warning
        if (level === 'MEDIUM' || probability >= 0.4) {
            return vscode.DiagnosticSeverity.Warning;
        }

        // Low -> Information
        return vscode.DiagnosticSeverity.Information;
    }

    /**
     * Formats a diagnostic message with context
     */
    private formatDiagnosticMessage(
        lineMessage: string | undefined,
        result: GateScanResult
    ): string {
        const confidence = Math.round(result.probability * 100);
        const baseMessage = lineMessage || 'Potential vulnerability detected';
        
        return `[Devign] ${baseMessage} (${result.risk_level} risk, ${confidence}% confidence)`;
    }

    /**
     * Formats a generic diagnostic message when no specific line message is available
     */
    private formatGenericDiagnosticMessage(result: GateScanResult): string {
        const confidence = Math.round(result.probability * 100);
        const functionName = result.functionInfo?.name || 'unknown';
        
        return `[Devign] ${result.risk_level} risk vulnerability detected in function '${functionName}' (${confidence}% confidence)`;
    }

    /**
     * Gets a diagnostic code based on risk level
     */
    private getDiagnosticCode(riskLevel: string): string {
        const level = riskLevel.toUpperCase();
        switch (level) {
            case 'CRITICAL':
                return 'DEVIGN-CRITICAL';
            case 'HIGH':
                return 'DEVIGN-HIGH';
            case 'MEDIUM':
                return 'DEVIGN-MEDIUM';
            case 'LOW':
                return 'DEVIGN-LOW';
            default:
                return 'DEVIGN-UNKNOWN';
        }
    }

    /**
     * Disposes of the diagnostic collection
     */
    dispose(): void {
        this.diagnosticCollection.dispose();
    }
}

/**
 * Convenience function to get the GateDiagnosticsService instance
 */
export function getGateDiagnosticsService(): GateDiagnosticsService {
    return GateDiagnosticsService.getInstance();
}

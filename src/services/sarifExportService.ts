import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ScanResult } from '../scanner';
import { FunctionScanResult } from './functionScanner';
import { HybridScanResult } from './hybridScanService';
import { AggregatedGateResult } from './securityGateService';

/**
 * SARIF 2.1.0 Schema Types
 * https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 */

export interface SarifLog {
    $schema: string;
    version: '2.1.0';
    runs: SarifRun[];
}

export interface SarifRun {
    tool: SarifTool;
    results: SarifResult[];
    artifacts?: SarifArtifact[];
    invocations?: SarifInvocation[];
}

export interface SarifTool {
    driver: SarifToolComponent;
}

export interface SarifToolComponent {
    name: string;
    version: string;
    informationUri?: string;
    rules?: SarifReportingDescriptor[];
}

export interface SarifReportingDescriptor {
    id: string;
    name?: string;
    shortDescription?: SarifMessage;
    fullDescription?: SarifMessage;
    helpUri?: string;
    defaultConfiguration?: SarifReportingConfiguration;
    properties?: Record<string, unknown>;
}

export interface SarifReportingConfiguration {
    level?: SarifLevel;
    enabled?: boolean;
}

export type SarifLevel = 'none' | 'note' | 'warning' | 'error';

export interface SarifResult {
    ruleId: string;
    ruleIndex?: number;
    level?: SarifLevel;
    message: SarifMessage;
    locations?: SarifLocation[];
    fingerprints?: Record<string, string>;
    properties?: Record<string, unknown>;
}

export interface SarifMessage {
    text?: string;
    markdown?: string;
    id?: string;
    arguments?: string[];
}

export interface SarifLocation {
    physicalLocation?: SarifPhysicalLocation;
    logicalLocations?: SarifLogicalLocation[];
}

export interface SarifPhysicalLocation {
    artifactLocation?: SarifArtifactLocation;
    region?: SarifRegion;
}

export interface SarifArtifactLocation {
    uri?: string;
    uriBaseId?: string;
    index?: number;
}

export interface SarifRegion {
    startLine?: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
    charOffset?: number;
    charLength?: number;
    snippet?: SarifArtifactContent;
}

export interface SarifArtifactContent {
    text?: string;
    rendered?: SarifMessage;
}

export interface SarifLogicalLocation {
    name?: string;
    fullyQualifiedName?: string;
    kind?: string;
}

export interface SarifArtifact {
    location?: SarifArtifactLocation;
    mimeType?: string;
    length?: number;
}

export interface SarifInvocation {
    executionSuccessful: boolean;
    startTimeUtc?: string;
    endTimeUtc?: string;
    workingDirectory?: SarifArtifactLocation;
}

/**
 * Options for SARIF export
 */
export interface SarifExportOptions {
    includeSnippets?: boolean;
    includeArtifacts?: boolean;
    baseUri?: string;
    workspaceRoot?: string;
}

/**
 * SARIF Export Service
 * 
 * Exports scan results to SARIF 2.1.0 format.
 */
export class SarifExportService {
    private readonly SARIF_SCHEMA = 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';
    private readonly TOOL_NAME = 'Devign Vulnerability Scanner';
    private readonly TOOL_VERSION = '1.0.0';
    private readonly TOOL_INFO_URI = 'https://github.com/hoangduy0308/vscode-devign-extension';

    private rules: Map<string, SarifReportingDescriptor> = new Map();

    constructor() {
        this.initializeRules();
    }

    private initializeRules(): void {
        this.rules.set('DEVIGN001', {
            id: 'DEVIGN001',
            name: 'VulnerableCode',
            shortDescription: { text: 'ML-detected vulnerability' },
            fullDescription: {
                text: 'The Devign machine learning model has detected patterns consistent with known vulnerability types in this code segment.'
            },
            helpUri: 'https://github.com/hoangduy0308/vscode-devign-extension#vulnerability-detection',
            defaultConfiguration: { level: 'warning' }
        });

        this.rules.set('DEVIGN002', {
            id: 'DEVIGN002',
            name: 'HighRiskCode',
            shortDescription: { text: 'High-risk vulnerability detected' },
            fullDescription: {
                text: 'High confidence vulnerability detection. This code requires immediate attention and review.'
            },
            helpUri: 'https://github.com/hoangduy0308/vscode-devign-extension#high-risk',
            defaultConfiguration: { level: 'error' }
        });

        this.rules.set('DEVIGN003', {
            id: 'DEVIGN003',
            name: 'CriticalVulnerability',
            shortDescription: { text: 'Critical vulnerability detected' },
            fullDescription: {
                text: 'Critical vulnerability with very high confidence. This code should not be deployed without remediation.'
            },
            helpUri: 'https://github.com/hoangduy0308/vscode-devign-extension#critical',
            defaultConfiguration: { level: 'error' }
        });

        this.rules.set('DEVIGN004', {
            id: 'DEVIGN004',
            name: 'DangerousApiUsage',
            shortDescription: { text: 'Dangerous API usage detected' },
            fullDescription: {
                text: 'Use of a dangerous C/C++ API function that is known to be prone to security vulnerabilities.'
            },
            helpUri: 'https://github.com/hoangduy0308/vscode-devign-extension#dangerous-apis',
            defaultConfiguration: { level: 'warning' }
        });
    }

    /**
     * Export hybrid scan results to SARIF format
     */
    exportHybridResults(
        results: HybridScanResult[],
        options: SarifExportOptions = {}
    ): SarifLog {
        const sarifResults: SarifResult[] = [];
        const artifacts: SarifArtifact[] = [];
        const artifactIndexMap = new Map<string, number>();

        for (const hybridResult of results) {
            if (options.includeArtifacts) {
                if (!artifactIndexMap.has(hybridResult.filePath)) {
                    artifactIndexMap.set(hybridResult.filePath, artifacts.length);
                    artifacts.push({
                        location: {
                            uri: this.toFileUri(hybridResult.filePath, options.workspaceRoot)
                        },
                        mimeType: 'text/x-c'
                    });
                }
            }

            for (const funcResult of hybridResult.functions) {
                if (funcResult.vulnerable) {
                    sarifResults.push(
                        this.convertFunctionScanResult(funcResult, options, artifactIndexMap)
                    );
                }
            }
        }

        return this.createSarifLog(sarifResults, artifacts, options);
    }

    /**
     * Export gate results to SARIF format
     */
    exportGateResults(
        result: AggregatedGateResult,
        options: SarifExportOptions = {}
    ): SarifLog {
        const sarifResults: SarifResult[] = [];
        const artifacts: SarifArtifact[] = [];
        const artifactIndexMap = new Map<string, number>();

        for (const fileResult of result.changedFiles) {
            if (!fileResult.scanned) continue;

            if (options.includeArtifacts) {
                if (!artifactIndexMap.has(fileResult.filePath)) {
                    artifactIndexMap.set(fileResult.filePath, artifacts.length);
                    artifacts.push({
                        location: {
                            uri: this.toFileUri(fileResult.filePath, options.workspaceRoot)
                        },
                        mimeType: 'text/x-c'
                    });
                }
            }

            for (const scanResult of fileResult.scanResults) {
                if (scanResult.vulnerable) {
                    sarifResults.push(
                        this.convertFunctionScanResult(scanResult, options, artifactIndexMap)
                    );
                }
            }
        }

        const invocation: SarifInvocation = {
            executionSuccessful: true,
            startTimeUtc: result.startTime.toISOString(),
            endTimeUtc: result.endTime.toISOString()
        };

        if (options.workspaceRoot) {
            invocation.workingDirectory = {
                uri: this.toFileUri(options.workspaceRoot)
            };
        }

        return this.createSarifLog(sarifResults, artifacts, options, [invocation]);
    }

    /**
     * Export a single scan result to SARIF format
     */
    exportScanResult(
        scanResult: ScanResult,
        filePath: string,
        options: SarifExportOptions = {}
    ): SarifLog {
        const sarifResults: SarifResult[] = [];

        if (scanResult.vulnerable) {
            const ruleId = this.getRuleIdForResult(scanResult);
            const level = this.getLevelForResult(scanResult);

            const result: SarifResult = {
                ruleId,
                level,
                message: {
                    text: this.buildMessage(scanResult)
                },
                locations: [{
                    physicalLocation: {
                        artifactLocation: {
                            uri: this.toFileUri(filePath, options.workspaceRoot)
                        }
                    }
                }],
                fingerprints: {
                    'devign/v1': this.generateFingerprint(scanResult, filePath)
                },
                properties: {
                    probability: scanResult.probability,
                    riskLevel: scanResult.risk_level
                }
            };

            if (scanResult.dangerous_lines && scanResult.dangerous_lines.length > 0) {
                result.locations = scanResult.dangerous_lines.map(dl => ({
                    physicalLocation: {
                        artifactLocation: {
                            uri: this.toFileUri(filePath, options.workspaceRoot)
                        },
                        region: {
                            startLine: dl.line,
                            startColumn: dl.column_start || 1,
                            endColumn: dl.column_end || 1000,
                            snippet: options.includeSnippets ? {
                                text: dl.message || ''
                            } : undefined
                        }
                    },
                    logicalLocations: dl.function ? [{
                        name: dl.function,
                        kind: 'function'
                    }] : undefined
                }));
            }

            sarifResults.push(result);
        }

        return this.createSarifLog(sarifResults, [], options);
    }

    /**
     * Save SARIF log to file
     */
    async saveToFile(sarifLog: SarifLog, outputPath: string): Promise<void> {
        const content = JSON.stringify(sarifLog, null, 2);
        await fs.promises.writeFile(outputPath, content, 'utf-8');
    }

    /**
     * Get SARIF log as JSON string
     */
    toJson(sarifLog: SarifLog, pretty: boolean = true): string {
        return JSON.stringify(sarifLog, null, pretty ? 2 : undefined);
    }

    /**
     * Validate SARIF structure (basic validation)
     */
    validate(sarifLog: SarifLog): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (sarifLog.version !== '2.1.0') {
            errors.push(`Invalid version: expected '2.1.0', got '${sarifLog.version}'`);
        }

        if (!sarifLog.runs || sarifLog.runs.length === 0) {
            errors.push('SARIF log must contain at least one run');
        }

        for (let i = 0; i < sarifLog.runs.length; i++) {
            const run = sarifLog.runs[i];
            
            if (!run.tool?.driver?.name) {
                errors.push(`Run ${i}: tool.driver.name is required`);
            }

            for (let j = 0; j < (run.results?.length || 0); j++) {
                const result = run.results[j];
                
                if (!result.ruleId) {
                    errors.push(`Run ${i}, Result ${j}: ruleId is required`);
                }
                
                if (!result.message?.text && !result.message?.markdown) {
                    errors.push(`Run ${i}, Result ${j}: message.text or message.markdown is required`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    private createSarifLog(
        results: SarifResult[],
        artifacts: SarifArtifact[],
        options: SarifExportOptions,
        invocations?: SarifInvocation[]
    ): SarifLog {
        const run: SarifRun = {
            tool: {
                driver: {
                    name: this.TOOL_NAME,
                    version: this.TOOL_VERSION,
                    informationUri: this.TOOL_INFO_URI,
                    rules: Array.from(this.rules.values())
                }
            },
            results
        };

        if (artifacts.length > 0 && options.includeArtifacts) {
            run.artifacts = artifacts;
        }

        if (invocations && invocations.length > 0) {
            run.invocations = invocations;
        }

        return {
            $schema: this.SARIF_SCHEMA,
            version: '2.1.0',
            runs: [run]
        };
    }

    private convertFunctionScanResult(
        funcResult: FunctionScanResult,
        options: SarifExportOptions,
        artifactIndexMap: Map<string, number>
    ): SarifResult {
        const ruleId = this.getRuleIdForResult(funcResult);
        const level = this.getLevelForResult(funcResult);

        const result: SarifResult = {
            ruleId,
            ruleIndex: this.getRuleIndex(ruleId),
            level,
            message: {
                text: this.buildMessage(funcResult)
            },
            locations: [{
                physicalLocation: {
                    artifactLocation: {
                        uri: this.toFileUri(funcResult.functionInfo.filePath, options.workspaceRoot),
                        index: artifactIndexMap.get(funcResult.functionInfo.filePath)
                    },
                    region: {
                        startLine: funcResult.functionInfo.startLine,
                        endLine: funcResult.functionInfo.endLine,
                        snippet: options.includeSnippets ? {
                            text: funcResult.functionInfo.code.substring(0, 500)
                        } : undefined
                    }
                },
                logicalLocations: [{
                    name: funcResult.functionInfo.name,
                    kind: 'function'
                }]
            }],
            fingerprints: {
                'devign/v1': funcResult.contentHash
            },
            properties: {
                probability: funcResult.probability,
                riskLevel: funcResult.risk_level,
                cached: funcResult.cached,
                functionName: funcResult.functionInfo.name
            }
        };

        if (funcResult.dangerous_lines && funcResult.dangerous_lines.length > 0) {
            result.locations = funcResult.dangerous_lines.map(dl => ({
                physicalLocation: {
                    artifactLocation: {
                        uri: this.toFileUri(funcResult.functionInfo.filePath, options.workspaceRoot),
                        index: artifactIndexMap.get(funcResult.functionInfo.filePath)
                    },
                    region: {
                        startLine: dl.line,
                        startColumn: dl.column_start || 1,
                        endColumn: dl.column_end || 1000
                    }
                },
                logicalLocations: dl.function ? [{
                    name: dl.function,
                    kind: 'function'
                }] : undefined
            }));
        }

        return result;
    }

    private getRuleIdForResult(result: ScanResult): string {
        if (result.risk_level === 'CRITICAL' || result.probability >= 0.9) {
            return 'DEVIGN003';
        }
        if (result.risk_level === 'HIGH' || result.probability >= 0.7) {
            return 'DEVIGN002';
        }
        return 'DEVIGN001';
    }

    private getRuleIndex(ruleId: string): number {
        const ruleIds = Array.from(this.rules.keys());
        return ruleIds.indexOf(ruleId);
    }

    private getLevelForResult(result: ScanResult): SarifLevel {
        if (result.risk_level === 'CRITICAL' || result.probability >= 0.9) {
            return 'error';
        }
        if (result.risk_level === 'HIGH' || result.probability >= 0.7) {
            return 'error';
        }
        if (result.risk_level === 'MEDIUM' || result.probability >= 0.5) {
            return 'warning';
        }
        return 'note';
    }

    private buildMessage(result: ScanResult): string {
        const parts: string[] = [];
        
        parts.push(`Vulnerability detected with ${(result.probability * 100).toFixed(1)}% confidence.`);
        parts.push(`Risk level: ${result.risk_level}`);

        if (result.dangerous_lines && result.dangerous_lines.length > 0) {
            const apiNames = result.dangerous_lines
                .filter(dl => dl.api)
                .map(dl => dl.api)
                .filter((v, i, a) => a.indexOf(v) === i);
            
            if (apiNames.length > 0) {
                parts.push(`Dangerous APIs: ${apiNames.join(', ')}`);
            }
        }

        return parts.join(' ');
    }

    private toFileUri(filePath: string, workspaceRoot?: string): string {
        let uri = filePath.replace(/\\/g, '/');
        
        if (workspaceRoot) {
            const normalizedRoot = workspaceRoot.replace(/\\/g, '/');
            if (uri.startsWith(normalizedRoot)) {
                uri = uri.substring(normalizedRoot.length);
                if (uri.startsWith('/')) {
                    uri = uri.substring(1);
                }
                return uri;
            }
        }

        if (!uri.startsWith('file://')) {
            uri = 'file:///' + uri;
        }
        
        return uri;
    }

    private generateFingerprint(result: ScanResult, filePath: string): string {
        const data = `${filePath}:${result.probability}:${result.risk_level}`;
        let hash = 5381;
        for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) + hash) + data.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
}

let sarifExportServiceInstance: SarifExportService | null = null;

export function getSarifExportService(): SarifExportService {
    if (!sarifExportServiceInstance) {
        sarifExportServiceInstance = new SarifExportService();
    }
    return sarifExportServiceInstance;
}

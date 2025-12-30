export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const Severity = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
} as const;

export interface Range {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}

export interface Vulnerability {
    id: string;
    type: string;
    severity: Severity;
    confidence: number;
    description: string;
    file: string;
    range: Range;
    snippet?: string;
}

export interface ScanResultPayload {
    scanId: string;
    timestamp: number;
    filesScanned: number;
    vulnerabilities: Vulnerability[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

export const MessageType = {
    SCAN_RESULT: 'SCAN_RESULT',
    SCAN_STATUS: 'SCAN_STATUS',
    OPEN_FILE: 'OPEN_FILE',
    REPORT_DATA: 'REPORT_DATA',
    EXPORT_REPORT: 'EXPORT_REPORT',
    GIT_ACTION: 'GIT_ACTION'
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

export interface ReportVulnerability {
    id: string;
    ruleId: string;
    severity: Severity;
    message: string;
    file: string;
    line: number;
    endLine?: number;
    snippet?: string;
    probability?: number;
    functionName?: string;
}

export interface ReportSummary {
    totalVulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    filesAffected: number;
    scanTime: string;
    toolName: string;
    toolVersion: string;
}

export interface ReportData {
    summary: ReportSummary;
    vulnerabilities: ReportVulnerability[];
    generatedAt: string;
}
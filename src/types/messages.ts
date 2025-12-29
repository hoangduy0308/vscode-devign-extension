import { z } from 'zod';

// Protocol Version
export const PROTOCOL_VERSION = '1.0.0';

// Enums
export enum MessageType {
    // VSCode -> Webview
    SCAN_RESULT = 'SCAN_RESULT',
    SCAN_STATUS = 'SCAN_STATUS',
    GIT_STATUS = 'GIT_STATUS',
    CONFIGURATION = 'CONFIGURATION',

    // Webview -> VSCode
    START_SCAN = 'START_SCAN',
    STOP_SCAN = 'STOP_SCAN',
    OPEN_FILE = 'OPEN_FILE',
    UPDATE_CONFIG = 'UPDATE_CONFIG'
}

export enum ScanStatus {
    IDLE = 'idle',
    SCANNING = 'scanning',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export enum Severity {
    CRITICAL = 'CRITICAL',
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
}

// Zod Schemas

// Basic Types
export const RangeSchema = z.object({
    startLine: z.number(),
    startColumn: z.number(),
    endLine: z.number(),
    endColumn: z.number()
});

export const VulnerabilitySchema = z.object({
    id: z.string(),
    type: z.string(),
    severity: z.nativeEnum(Severity),
    confidence: z.number().min(0).max(1),
    description: z.string(),
    file: z.string(),
    range: RangeSchema,
    snippet: z.string().optional()
});

export const ScanResultPayloadSchema = z.object({
    scanId: z.string(),
    timestamp: z.number(),
    filesScanned: z.number(),
    vulnerabilities: z.array(VulnerabilitySchema),
    summary: z.object({
        critical: z.number(),
        high: z.number(),
        medium: z.number(),
        low: z.number()
    })
});

export const ScanStatusPayloadSchema = z.object({
    status: z.nativeEnum(ScanStatus),
    progress: z.number().min(0).max(100).optional(),
    currentFile: z.string().optional(),
    message: z.string().optional()
});

// Message Schemas
export const BaseMessageSchema = z.object({
    type: z.nativeEnum(MessageType),
    version: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    payload: z.any()
});

export const ScanResultMessageSchema = BaseMessageSchema.extend({
    type: z.literal(MessageType.SCAN_RESULT),
    payload: ScanResultPayloadSchema
});

export const ScanStatusMessageSchema = BaseMessageSchema.extend({
    type: z.literal(MessageType.SCAN_STATUS),
    payload: ScanStatusPayloadSchema
});

export const StartScanMessageSchema = BaseMessageSchema.extend({
    type: z.literal(MessageType.START_SCAN),
    payload: z.object({
        scope: z.enum(['file', 'workspace', 'selection']),
        target: z.string().optional() // path to file or workspace
    })
});

export const OpenFileMessageSchema = BaseMessageSchema.extend({
    type: z.literal(MessageType.OPEN_FILE),
    payload: z.object({
        path: z.string(),
        range: RangeSchema.optional()
    })
});

// Type Definitions derived from Schemas
export type Range = z.infer<typeof RangeSchema>;
export type Vulnerability = z.infer<typeof VulnerabilitySchema>;
export type ScanResultPayload = z.infer<typeof ScanResultPayloadSchema>;
export type ScanStatusPayload = z.infer<typeof ScanStatusPayloadSchema>;

export type ExtensionMessage =
    | z.infer<typeof ScanResultMessageSchema>
    | z.infer<typeof ScanStatusMessageSchema>;

export type WebviewMessage =
    | z.infer<typeof StartScanMessageSchema>
    | z.infer<typeof OpenFileMessageSchema>;
import * as assert from 'assert';
import {
    ScanResultPayloadSchema,
    ScanStatusPayloadSchema,
    ScanStatus,
    Severity,
    VulnerabilitySchema
} from '../../types/messages';

suite('Protocol Schema Test Suite', () => {
    test('should validate valid ScanResultPayload', () => {
        const validPayload = {
            scanId: '123',
            timestamp: Date.now(),
            filesScanned: 10,
            vulnerabilities: [
                {
                    id: 'vuln-1',
                    type: 'buffer_overflow',
                    severity: Severity.HIGH,
                    confidence: 0.9,
                    description: 'Buffer overflow detected',
                    file: 'main.c',
                    range: {
                        startLine: 10,
                        startColumn: 1,
                        endLine: 10,
                        endColumn: 20
                    },
                    snippet: 'char buf[10];'
                }
            ],
            summary: {
                critical: 0,
                high: 1,
                medium: 0,
                low: 0
            }
        };

        const result = ScanResultPayloadSchema.safeParse(validPayload);
        assert.ok(result.success);
    });

    test('should reject invalid ScanResultPayload', () => {
        const invalidPayload = {
            scanId: 123, // Should be string
            timestamp: 'now', // Should be number
            vulnerabilities: []
        };

        const result = ScanResultPayloadSchema.safeParse(invalidPayload);
        assert.ok(!result.success);
    });

    test('should validate ScanStatusPayload', () => {
        const validStatus = {
            status: ScanStatus.SCANNING,
            progress: 50,
            currentFile: 'test.c'
        };

        const result = ScanStatusPayloadSchema.safeParse(validStatus);
        assert.ok(result.success);
    });

    test('should validate Vulnerability', () => {
        const validVuln = {
            id: 'vuln-1',
            type: 'buffer_overflow',
            severity: Severity.CRITICAL,
            confidence: 1.0,
            description: 'Critical issue',
            file: 'src/main.cpp',
            range: {
                startLine: 1,
                startColumn: 1,
                endLine: 2,
                endColumn: 1
            }
        };

        const result = VulnerabilitySchema.safeParse(validVuln);
        assert.ok(result.success);
    });
});
import './vscode-mock'; // Must be first
import * as assert from 'assert';
import { SarifExportService, getSarifExportService, SarifLog } from '../../services/sarifExportService';
import { ScanResult } from '../../scanner';

// Helper to create minimal valid ScanResult for testing
function createScanResult(overrides: Partial<ScanResult> & { vulnerable: boolean; probability: number; risk_level: string }): ScanResult {
    return {
        file_path: 'test.c',
        dangerous_apis: [],
        dangerous_lines: [],
        ...overrides
    };
}

suite('SarifExportService Test Suite', () => {
    let sarifService: SarifExportService;

    setup(() => {
        sarifService = new SarifExportService();
    });

    suite('Singleton Pattern', () => {
        test('getSarifExportService returns singleton', () => {
            const instance1 = getSarifExportService();
            const instance2 = getSarifExportService();
            assert.strictEqual(instance1, instance2, 'Should return the same singleton instance');
        });
    });

    suite('exportScanResult - SARIF Structure', () => {
        test('creates valid SARIF 2.1.0 structure', () => {
            const scanResult = createScanResult({
                vulnerable: true,
                probability: 0.85,
                risk_level: 'HIGH'
            });

            const sarifLog = sarifService.exportScanResult(scanResult, 'test.c');

            assert.strictEqual(sarifLog.version, '2.1.0', 'Version should be 2.1.0');
            assert.ok(sarifLog.$schema, 'Should have $schema');
            assert.ok(sarifLog.$schema.includes('sarif'), 'Schema should reference SARIF');
        });

        test('includes required SARIF fields', () => {
            const scanResult = createScanResult({
                vulnerable: true,
                probability: 0.75,
                risk_level: 'HIGH'
            });

            const sarifLog = sarifService.exportScanResult(scanResult, 'test.c');

            // Check runs array exists
            assert.ok(Array.isArray(sarifLog.runs), 'Should have runs array');
            assert.strictEqual(sarifLog.runs.length, 1, 'Should have one run');

            // Check tool info
            const run = sarifLog.runs[0];
            assert.ok(run.tool, 'Run should have tool');
            assert.ok(run.tool.driver, 'Tool should have driver');
            assert.ok(run.tool.driver.name, 'Driver should have name');
            assert.ok(run.tool.driver.version, 'Driver should have version');

            // Check results array exists
            assert.ok(Array.isArray(run.results), 'Run should have results array');
        });

        test('includes tool information', () => {
            const scanResult = createScanResult({
                vulnerable: true,
                probability: 0.80,
                risk_level: 'HIGH'
            });

            const sarifLog = sarifService.exportScanResult(scanResult, 'test.c');
            const driver = sarifLog.runs[0].tool.driver;

            assert.strictEqual(driver.name, 'Devign Vulnerability Scanner');
            assert.strictEqual(driver.version, '1.0.0');
            assert.ok(driver.informationUri, 'Should have informationUri');
        });

        test('includes rules definitions', () => {
            const scanResult = createScanResult({
                vulnerable: true,
                probability: 0.80,
                risk_level: 'HIGH'
            });

            const sarifLog = sarifService.exportScanResult(scanResult, 'test.c');
            const rules = sarifLog.runs[0].tool.driver.rules;

            assert.ok(Array.isArray(rules), 'Should have rules array');
            assert.ok(rules!.length > 0, 'Should have at least one rule');

            // Check rule structure
            const rule = rules![0];
            assert.ok(rule.id, 'Rule should have id');
            assert.ok(rule.shortDescription, 'Rule should have shortDescription');
        });
    });

    suite('exportScanResult - Result Handling', () => {
        test('adds result for vulnerable scan', () => {
            const scanResult = createScanResult({
                vulnerable: true,
                probability: 0.85,
                risk_level: 'HIGH'
            });

            const sarifLog = sarifService.exportScanResult(scanResult, 'test.c');
            const results = sarifLog.runs[0].results;

            assert.strictEqual(results.length, 1, 'Should have one result');
            assert.ok(results[0].ruleId, 'Result should have ruleId');
            assert.ok(results[0].message, 'Result should have message');
        });

        test('does not add result for non-vulnerable scan', () => {
            const scanResult = createScanResult({
                vulnerable: false,
                probability: 0.20,
                risk_level: 'LOW'
            });

            const sarifLog = sarifService.exportScanResult(scanResult, 'test.c');
            const results = sarifLog.runs[0].results;

            assert.strictEqual(results.length, 0, 'Should have no results for non-vulnerable');
        });

        test('includes location in result', () => {
            const scanResult = createScanResult({
                vulnerable: true,
                probability: 0.85,
                risk_level: 'HIGH'
            });

            const sarifLog = sarifService.exportScanResult(scanResult, 'path/to/test.c');
            const result = sarifLog.runs[0].results[0];

            assert.ok(result.locations, 'Result should have locations');
            assert.ok(result.locations!.length > 0, 'Should have at least one location');
            
            const location = result.locations![0];
            assert.ok(location.physicalLocation, 'Should have physicalLocation');
            assert.ok(location.physicalLocation!.artifactLocation, 'Should have artifactLocation');
        });

        test('includes fingerprint in result', () => {
            const scanResult = createScanResult({
                vulnerable: true,
                probability: 0.85,
                risk_level: 'HIGH'
            });

            const sarifLog = sarifService.exportScanResult(scanResult, 'test.c');
            const result = sarifLog.runs[0].results[0];

            assert.ok(result.fingerprints, 'Result should have fingerprints');
            assert.ok(result.fingerprints!['devign/v1'], 'Should have devign fingerprint');
        });

        test('includes properties with probability and risk level', () => {
            const scanResult = createScanResult({
                vulnerable: true,
                probability: 0.85,
                risk_level: 'HIGH'
            });

            const sarifLog = sarifService.exportScanResult(scanResult, 'test.c');
            const result = sarifLog.runs[0].results[0];

            assert.ok(result.properties, 'Result should have properties');
            assert.strictEqual(result.properties!.probability, 0.85);
            assert.strictEqual(result.properties!.riskLevel, 'HIGH');
        });

        test('assigns correct rule ID based on probability', () => {
            // Critical (>= 0.9)
            let sarifLog = sarifService.exportScanResult(
                createScanResult({ vulnerable: true, probability: 0.95, risk_level: 'CRITICAL' }),
                'test.c'
            );
            assert.strictEqual(sarifLog.runs[0].results[0].ruleId, 'DEVIGN003');

            // High (>= 0.7)
            sarifLog = sarifService.exportScanResult(
                createScanResult({ vulnerable: true, probability: 0.75, risk_level: 'HIGH' }),
                'test.c'
            );
            assert.strictEqual(sarifLog.runs[0].results[0].ruleId, 'DEVIGN002');

            // Medium/Low (< 0.7)
            sarifLog = sarifService.exportScanResult(
                createScanResult({ vulnerable: true, probability: 0.55, risk_level: 'MEDIUM' }),
                'test.c'
            );
            assert.strictEqual(sarifLog.runs[0].results[0].ruleId, 'DEVIGN001');
        });
    });

    suite('validate', () => {
        test('validates correct SARIF structure', () => {
            const sarifLog: SarifLog = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0',
                runs: [{
                    tool: { driver: { name: 'Test', version: '1.0' } },
                    results: [
                        { ruleId: 'R1', message: { text: 'Test message' } }
                    ]
                }]
            };

            const validation = sarifService.validate(sarifLog);

            assert.strictEqual(validation.valid, true);
            assert.strictEqual(validation.errors.length, 0);
        });

        test('reports invalid version', () => {
            const sarifLog = {
                $schema: 'https://sarif.example.com',
                version: '1.0.0' as any,
                runs: [{
                    tool: { driver: { name: 'Test', version: '1.0' } },
                    results: []
                }]
            };

            const validation = sarifService.validate(sarifLog);

            assert.strictEqual(validation.valid, false);
            assert.ok(validation.errors.some(e => e.includes('version')));
        });

        test('reports missing runs', () => {
            const sarifLog = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0' as const,
                runs: []
            };

            const validation = sarifService.validate(sarifLog);

            assert.strictEqual(validation.valid, false);
            assert.ok(validation.errors.some(e => e.includes('at least one run')));
        });

        test('reports missing tool driver name', () => {
            const sarifLog = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0' as const,
                runs: [{
                    tool: { driver: { name: '', version: '1.0' } },
                    results: []
                }]
            };

            const validation = sarifService.validate(sarifLog);

            assert.strictEqual(validation.valid, false);
            assert.ok(validation.errors.some(e => e.includes('tool.driver.name')));
        });

        test('reports missing result ruleId', () => {
            const sarifLog: any = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0',
                runs: [{
                    tool: { driver: { name: 'Test', version: '1.0' } },
                    results: [
                        { message: { text: 'Test' } } // Missing ruleId
                    ]
                }]
            };

            const validation = sarifService.validate(sarifLog);

            assert.strictEqual(validation.valid, false);
            assert.ok(validation.errors.some(e => e.includes('ruleId')));
        });

        test('reports missing result message', () => {
            const sarifLog: any = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0',
                runs: [{
                    tool: { driver: { name: 'Test', version: '1.0' } },
                    results: [
                        { ruleId: 'R1', message: {} } // Empty message
                    ]
                }]
            };

            const validation = sarifService.validate(sarifLog);

            assert.strictEqual(validation.valid, false);
            assert.ok(validation.errors.some(e => e.includes('message.text')));
        });
    });

    suite('toJson', () => {
        test('serializes to JSON string', () => {
            const sarifLog: SarifLog = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0',
                runs: [{
                    tool: { driver: { name: 'Test', version: '1.0' } },
                    results: []
                }]
            };

            const json = sarifService.toJson(sarifLog);

            assert.ok(typeof json === 'string');
            const parsed = JSON.parse(json);
            assert.strictEqual(parsed.version, '2.1.0');
        });

        test('supports pretty and compact output', () => {
            const sarifLog: SarifLog = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0',
                runs: [{
                    tool: { driver: { name: 'Test', version: '1.0' } },
                    results: []
                }]
            };

            const pretty = sarifService.toJson(sarifLog, true);
            const compact = sarifService.toJson(sarifLog, false);

            assert.ok(pretty.includes('\n'), 'Pretty output should have newlines');
            assert.ok(!compact.includes('\n'), 'Compact output should not have newlines');
        });
    });

    // Note: Testing exportHybridResults, exportGateResults, and saveToFile
    // requires mocking the filesystem and complex scan result types.
    // TODO: Add integration tests with proper mocks for:
    // - exportHybridResults with HybridScanResult[]
    // - exportGateResults with AggregatedGateResult
    // - saveToFile with fs mocking
});

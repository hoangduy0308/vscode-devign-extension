import './vscode-mock'; // Must be first
import * as assert from 'assert';
import { PRService, ScanSummary } from '../../services/prService';
import { SarifLog } from '../../services/sarifExportService';

suite('PRService Test Suite', () => {
    let prService: PRService;

    setup(() => {
        // PRService requires a GitService, but we can test pure methods
        // by accessing them directly or creating a minimal mock
        // For parseRemoteUrl and other pure functions, we create with a mock
        const mockGitService = {} as any;
        prService = new PRService(mockGitService);
    });

    suite('parseRemoteUrl', () => {
        test('parses SSH format correctly', () => {
            const result = prService.parseRemoteUrl('git@github.com:owner/repo.git');
            assert.ok(result, 'Should return RepoInfo');
            assert.strictEqual(result!.owner, 'owner');
            assert.strictEqual(result!.repo, 'repo');
            assert.strictEqual(result!.fullName, 'owner/repo');
        });

        test('parses SSH format without .git suffix', () => {
            const result = prService.parseRemoteUrl('git@github.com:myorg/myrepo');
            assert.ok(result, 'Should return RepoInfo');
            assert.strictEqual(result!.owner, 'myorg');
            assert.strictEqual(result!.repo, 'myrepo');
        });

        test('parses HTTPS format correctly', () => {
            const result = prService.parseRemoteUrl('https://github.com/owner/repo.git');
            assert.ok(result, 'Should return RepoInfo');
            assert.strictEqual(result!.owner, 'owner');
            assert.strictEqual(result!.repo, 'repo');
            assert.strictEqual(result!.fullName, 'owner/repo');
        });

        test('parses HTTPS format without .git suffix', () => {
            const result = prService.parseRemoteUrl('https://github.com/testowner/testrepo');
            assert.ok(result, 'Should return RepoInfo');
            assert.strictEqual(result!.owner, 'testowner');
            assert.strictEqual(result!.repo, 'testrepo');
        });

        test('parses HTTP format correctly', () => {
            const result = prService.parseRemoteUrl('http://github.com/owner/repo.git');
            assert.ok(result, 'Should return RepoInfo');
            assert.strictEqual(result!.owner, 'owner');
            assert.strictEqual(result!.repo, 'repo');
        });

        test('returns null for undefined URL', () => {
            const result = prService.parseRemoteUrl(undefined);
            assert.strictEqual(result, null);
        });

        test('returns null for invalid URL', () => {
            const result = prService.parseRemoteUrl('not-a-valid-url');
            assert.strictEqual(result, null);
        });

        test('returns null for non-GitHub URL', () => {
            const result = prService.parseRemoteUrl('https://gitlab.com/owner/repo.git');
            assert.strictEqual(result, null);
        });

        test('returns null for empty string', () => {
            const result = prService.parseRemoteUrl('');
            assert.strictEqual(result, null);
        });
    });

    suite('generateScanSummary', () => {
        test('counts severities correctly based on probability', () => {
            const sarifLog: SarifLog = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0',
                runs: [{
                    tool: { driver: { name: 'Test', version: '1.0' } },
                    results: [
                        { ruleId: 'R1', message: { text: 'Critical' }, properties: { probability: 0.95 } },
                        { ruleId: 'R2', message: { text: 'High' }, properties: { probability: 0.80 } },
                        { ruleId: 'R3', message: { text: 'Medium' }, properties: { probability: 0.60 } },
                        { ruleId: 'R4', message: { text: 'Low' }, properties: { probability: 0.30 } }
                    ]
                }]
            };

            const summary = prService.generateScanSummary(sarifLog);

            assert.strictEqual(summary.totalFindings, 4);
            assert.strictEqual(summary.criticalCount, 1, 'Should have 1 critical (>=0.9)');
            assert.strictEqual(summary.highCount, 1, 'Should have 1 high (>=0.75)');
            assert.strictEqual(summary.mediumCount, 1, 'Should have 1 medium (>=0.5)');
            assert.strictEqual(summary.lowCount, 1, 'Should have 1 low (<0.5)');
        });

        test('handles empty results', () => {
            const sarifLog: SarifLog = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0',
                runs: [{
                    tool: { driver: { name: 'Test', version: '1.0' } },
                    results: []
                }]
            };

            const summary = prService.generateScanSummary(sarifLog);

            assert.strictEqual(summary.totalFindings, 0);
            assert.strictEqual(summary.criticalCount, 0);
            assert.strictEqual(summary.highCount, 0);
            assert.strictEqual(summary.mediumCount, 0);
            assert.strictEqual(summary.lowCount, 0);
        });

        test('counts unique files correctly', () => {
            const sarifLog: SarifLog = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0',
                runs: [{
                    tool: { driver: { name: 'Test', version: '1.0' } },
                    results: [
                        { 
                            ruleId: 'R1', 
                            message: { text: 'Test' }, 
                            properties: { probability: 0.8 },
                            locations: [{ physicalLocation: { artifactLocation: { uri: 'file1.c' } } }]
                        },
                        { 
                            ruleId: 'R2', 
                            message: { text: 'Test' }, 
                            properties: { probability: 0.8 },
                            locations: [{ physicalLocation: { artifactLocation: { uri: 'file1.c' } } }]
                        },
                        { 
                            ruleId: 'R3', 
                            message: { text: 'Test' }, 
                            properties: { probability: 0.8 },
                            locations: [{ physicalLocation: { artifactLocation: { uri: 'file2.c' } } }]
                        }
                    ]
                }]
            };

            const summary = prService.generateScanSummary(sarifLog);

            assert.strictEqual(summary.filesScanned, 2, 'Should count unique files');
            assert.strictEqual(summary.totalFindings, 3);
        });

        test('limits findings to top 10', () => {
            const results = [];
            for (let i = 0; i < 15; i++) {
                results.push({
                    ruleId: `R${i}`,
                    message: { text: `Finding ${i}` },
                    properties: { probability: 0.8 }
                });
            }

            const sarifLog: SarifLog = {
                $schema: 'https://sarif.example.com',
                version: '2.1.0',
                runs: [{
                    tool: { driver: { name: 'Test', version: '1.0' } },
                    results
                }]
            };

            const summary = prService.generateScanSummary(sarifLog);

            assert.strictEqual(summary.totalFindings, 15);
            assert.strictEqual(summary.findings.length, 10, 'Should limit to top 10 findings');
        });
    });

    suite('generatePRBody', () => {
        test('includes markdown sections', () => {
            const summary: ScanSummary = {
                totalFindings: 2,
                criticalCount: 1,
                highCount: 1,
                mediumCount: 0,
                lowCount: 0,
                filesScanned: 1,
                functionsScanned: 2,
                scanDate: new Date().toISOString(),
                findings: [
                    { file: 'test.c', function: 'main', line: 10, severity: 'CRITICAL', probability: 0.95, message: 'Test' }
                ]
            };

            const body = prService.generatePRBody(summary);

            assert.ok(body.includes('## 🔒 Devign Security Scan Summary'), 'Should include header');
            assert.ok(body.includes('### Findings Overview'), 'Should include findings overview');
            assert.ok(body.includes('### Top Findings'), 'Should include top findings');
            assert.ok(body.includes('| Severity | Count |'), 'Should include severity table');
        });

        test('includes custom body when provided', () => {
            const summary: ScanSummary = {
                totalFindings: 0,
                criticalCount: 0,
                highCount: 0,
                mediumCount: 0,
                lowCount: 0,
                filesScanned: 1,
                functionsScanned: 1,
                scanDate: new Date().toISOString(),
                findings: []
            };

            const customBody = 'This is my custom PR description';
            const body = prService.generatePRBody(summary, customBody);

            assert.ok(body.includes(customBody), 'Should include custom body');
            assert.ok(body.includes('---'), 'Should include separator');
        });

        test('shows success message when no findings', () => {
            const summary: ScanSummary = {
                totalFindings: 0,
                criticalCount: 0,
                highCount: 0,
                mediumCount: 0,
                lowCount: 0,
                filesScanned: 5,
                functionsScanned: 10,
                scanDate: new Date().toISOString(),
                findings: []
            };

            const body = prService.generatePRBody(summary);

            assert.ok(body.includes('✅ **No vulnerabilities detected!**'), 'Should show success message');
        });

        test('includes Devign attribution link', () => {
            const summary: ScanSummary = {
                totalFindings: 0,
                criticalCount: 0,
                highCount: 0,
                mediumCount: 0,
                lowCount: 0,
                filesScanned: 1,
                functionsScanned: 1,
                scanDate: new Date().toISOString(),
                findings: []
            };

            const body = prService.generatePRBody(summary);

            assert.ok(body.includes('Devign Vulnerability Scanner'), 'Should include attribution');
            assert.ok(body.includes('https://github.com/hoangduy0308/vscode-devign-extension'), 'Should include repo link');
        });
    });

    suite('getSeverityEmoji (via generatePRBody)', () => {
        test('returns correct emojis for each severity', () => {
            const summary: ScanSummary = {
                totalFindings: 4,
                criticalCount: 1,
                highCount: 1,
                mediumCount: 1,
                lowCount: 1,
                filesScanned: 1,
                functionsScanned: 1,
                scanDate: new Date().toISOString(),
                findings: [
                    { file: 'test.c', function: 'f1', line: 1, severity: 'CRITICAL', probability: 0.95, message: '' },
                    { file: 'test.c', function: 'f2', line: 2, severity: 'HIGH', probability: 0.80, message: '' },
                    { file: 'test.c', function: 'f3', line: 3, severity: 'MEDIUM', probability: 0.60, message: '' },
                    { file: 'test.c', function: 'f4', line: 4, severity: 'LOW', probability: 0.30, message: '' }
                ]
            };

            const body = prService.generatePRBody(summary);

            assert.ok(body.includes('🔴 Critical'), 'Should have red emoji for critical');
            assert.ok(body.includes('🟠 High'), 'Should have orange emoji for high');
            assert.ok(body.includes('🟡 Medium'), 'Should have yellow emoji for medium');
            assert.ok(body.includes('🟢 Low'), 'Should have green emoji for low');
        });
    });

    // Note: Testing createPR, getRepoInfo, getOpenPRs, etc. requires
    // mocking GitService and fetch/network calls.
    // TODO: Add integration tests with mocked GitService and network
});

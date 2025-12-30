import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { SecurityGateService, GateRunOptions } from '../../services/securityGateService';
import { GitService, FileChange } from '../../services/gitService';
import { DevignScanner, ScanResult } from '../../scanner';
import { GatePolicyService, GatePolicyConfig } from '../../services/gatePolicy';
import { GateStatusService } from '../../services/gateStatusService';

suite('SecurityGateService Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let gitServiceStub: sinon.SinonStubbedInstance<GitService>;
    let scannerStub: sinon.SinonStubbedInstance<DevignScanner>;
    let gateStatusServiceStub: sinon.SinonStubbedInstance<GateStatusService>;
    let service: SecurityGateService;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Mock GitService
        gitServiceStub = sandbox.createStubInstance(GitService);

        // Mock DevignScanner
        scannerStub = sandbox.createStubInstance(DevignScanner);
        scannerStub.scanFile = sandbox.stub();
        scannerStub.scanCode = sandbox.stub();
        scannerStub.scanWorkspace = sandbox.stub();

        // Mock GateStatusService
        gateStatusServiceStub = sandbox.createStubInstance(GateStatusService);

        // Stub getGateStatusService to return our mock
        const gateStatusModule = require('../../services/gateStatusService');
        sandbox.stub(gateStatusModule, 'getGateStatusService').returns(gateStatusServiceStub);

        // Mock vscode.languages.createDiagnosticCollection
        const diagnosticCollectionStub = {
            clear: sandbox.stub(),
            set: sandbox.stub(),
            delete: sandbox.stub(),
            dispose: sandbox.stub(),
            forEach: sandbox.stub(),
            get: sandbox.stub(),
            has: sandbox.stub()
        };
        sandbox.stub(vscode.languages, 'createDiagnosticCollection').returns(diagnosticCollectionStub as any);

        service = new SecurityGateService(gitServiceStub as any, scannerStub as any);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('isGateRunning returns false initially', () => {
        assert.strictEqual(service.isGateRunning(), false);
    });

    test('runGate throws if already running', async () => {
        // Fake running state
        (service as any).isRunning = true;

        const options: GateRunOptions = { scope: 'commit' };

        await assert.rejects(async () => {
            await service.runGate(options);
        }, /Security gate is already running/);
    });

    test('runGate handles empty staged files', async () => {
        // Mock policy
        const policyStub = sandbox.stub(GatePolicyService.prototype, 'loadPolicy').returns({
            enabled: true,
            scope: 'staged'
        } as GatePolicyConfig);

        // Mock git service to return empty list
        gitServiceStub.getStagedCppFiles.resolves([]);

        const options: GateRunOptions = { scope: 'commit' };
        const result = await service.runGate(options);

        assert.strictEqual(result.decision, 'PASS');
        assert.strictEqual(result.filesScanned, 0);
        assert.strictEqual(result.reasons[0], 'No C/C++ files to scan');
    });

    test('runGate scans files and returns results', async () => {
        // Mock policy
        sandbox.stub(GatePolicyService.prototype, 'loadPolicy').returns({
            enabled: true,
            scope: 'staged',
            blockOnRiskLevels: ['CRITICAL', 'HIGH']
        } as GatePolicyConfig);

        // Mock git service
        const mockFile: FileChange = {
            filePath: '/path/to/test.c',
            status: 1, // Modified
            statusLetter: 'M',
            uri: vscode.Uri.file('/path/to/test.c'),
            originalUri: vscode.Uri.file('/path/to/test.c')
        };
        gitServiceStub.getStagedCppFiles.resolves([mockFile]);

        // Mock scanner
        const mockScanResult: ScanResult = {
            file_path: '/path/to/test.c',
            risk_level: 'HIGH',
            probability: 0.85,
            vulnerable: true,
            dangerous_apis: ['strcpy'],
            dangerous_lines: [{
                line: 10,
                message: 'Buffer overflow',
                column_start: 0,
                column_end: 10,
                severity: 'ERROR',
                api: 'strcpy',
                code: 'strcpy(buf, src)'
            }]
        };
        scannerStub.scanFile.resolves(mockScanResult);

        // Mock policy evaluation
        sandbox.stub(GatePolicyService.prototype, 'evaluateResults').returns({
            decision: 'BLOCK',
            reasons: ['Found 1 blocking findings'],
            findings: [mockScanResult],
            blockedFindings: [mockScanResult],
            warnedFindings: [],
            scanDurationMs: 100,
            policyUsed: {} as any,
            disclaimer: ''
        });

        const options: GateRunOptions = { scope: 'commit' };
        const result = await service.runGate(options);

        assert.strictEqual(result.decision, 'BLOCK');
        assert.strictEqual(result.filesScanned, 1);
        assert.strictEqual(result.changedFiles.length, 1);
        assert.strictEqual(result.changedFiles[0].scanned, true);

        // Verify scanner was called
        assert.strictEqual(scannerStub.scanFile.calledOnce, true);
    });

    test('runGate handles scanner errors gracefully', async () => {
        // Mock policy
        sandbox.stub(GatePolicyService.prototype, 'loadPolicy').returns({
            enabled: true,
            scope: 'staged',
            fallbackMode: 'warn'
        } as GatePolicyConfig);

        // Mock git service
        const mockFile: FileChange = {
            filePath: '/path/to/test.c',
            status: 1,
            statusLetter: 'M',
            uri: vscode.Uri.file('/path/to/test.c'),
            originalUri: vscode.Uri.file('/path/to/test.c')
        };
        gitServiceStub.getStagedCppFiles.resolves([mockFile]);

        // Mock scanner error
        scannerStub.scanFile.rejects(new Error('Scanner failed'));

        const options: GateRunOptions = { scope: 'commit' };
        const result = await service.runGate(options);

        // Should still complete but with error in file result
        assert.strictEqual(result.changedFiles.length, 1);
        assert.strictEqual(result.changedFiles[0].scanned, false);
        assert.strictEqual(result.changedFiles[0].error, 'Scanner failed');
    });

    test('cancelCurrentRun cancels the token', async () => {
        // We need to start a run to have a cancellation token
        // This is tricky to test without async coordination, so we'll mock the internal state

        const tokenSource = new vscode.CancellationTokenSource();
        const cancelSpy = sandbox.spy(tokenSource, 'cancel');

        (service as any).currentCancellation = tokenSource;
        (service as any).isRunning = true;

        service.cancelCurrentRun();

        assert.strictEqual(cancelSpy.calledOnce, true);
        assert.strictEqual((service as any).currentCancellation, null);
    });
});
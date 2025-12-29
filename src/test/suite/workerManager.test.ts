import './vscode-mock'; // Must be first
import * as assert from 'assert';
// import * as vscode from 'vscode'; // Mocked by the file above
import { WorkerManager } from '../../services/workerManager';
import * as path from 'path';

suite('WorkerManager Test Suite', () => {
    let workerManager: WorkerManager;

    setup(() => {
        // We can't easily mock cp.spawn without a library like sinon or proxyquire in this setup.
        // However, we can test the class structure and initial state.
        workerManager = new WorkerManager(path.resolve(__dirname, '../../..'));
    });

    teardown(async () => {
        await workerManager.stop();
    });

    test('should be instantiated', () => {
        assert.ok(workerManager);
    });

    test('should not be healthy initially', () => {
        assert.strictEqual(workerManager.isHealthy(), false);
    });

    // Note: Testing start() requires a real Python environment or mocking cp.spawn.
    // Since we are in the extension host, we might be able to run it if python is available,
    // but it's flaky for unit tests.
    // We will skip the actual spawn test here and rely on integration tests or manual verification
    // until we add a mocking library.

    test('should throw error when requesting before start', async () => {
        try {
            await workerManager.request('test');
            assert.fail('Should have thrown error');
        } catch (e: any) {
            assert.strictEqual(e.message, 'Worker not started');
        }
    });
});
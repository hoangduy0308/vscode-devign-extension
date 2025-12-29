import * as assert from 'assert';
import { JsonRpc } from '../../services/jsonRpc';

suite('JsonRpc Test Suite', () => {
    test('should send request and handle response', async () => {
        let sentMessage = '';
        const jsonRpc = new JsonRpc((message) => {
            sentMessage = message;
            // Simulate response
            const request = JSON.parse(message);
            const response = {
                jsonrpc: '2.0',
                result: 'success',
                id: request.id
            };
            jsonRpc.handleMessage(JSON.stringify(response));
        });

        const result = await jsonRpc.sendRequest('testMethod', { param: 'value' });
        assert.strictEqual(result, 'success');
        assert.ok(sentMessage.includes('testMethod'));
    });

    test('should handle error response', async () => {
        const jsonRpc = new JsonRpc((message) => {
            const request = JSON.parse(message);
            const response = {
                jsonrpc: '2.0',
                error: {
                    code: -32600,
                    message: 'Invalid Request'
                },
                id: request.id
            };
            jsonRpc.handleMessage(JSON.stringify(response));
        });

        try {
            await jsonRpc.sendRequest('testMethod');
            assert.fail('Should have thrown error');
        } catch (e: any) {
            assert.strictEqual(e.code, -32600);
            assert.strictEqual(e.message, 'Invalid Request');
        }
    });

    test('should handle timeout', async () => {
        const jsonRpc = new JsonRpc((message) => {
            // Do nothing, let it timeout
        });

        try {
            await jsonRpc.sendRequest('testMethod', {}, { timeout: 100 });
            assert.fail('Should have timed out');
        } catch (e: any) {
            assert.ok(e.message.includes('timed out'));
        }
    });

    test('should send notification', () => {
        let sentMessage = '';
        const jsonRpc = new JsonRpc((message) => {
            sentMessage = message;
        });

        jsonRpc.sendNotification('notify', { data: 123 });
        const request = JSON.parse(sentMessage);
        assert.strictEqual(request.method, 'notify');
        assert.strictEqual(request.params.data, 123);
        assert.strictEqual(request.id, undefined);
    });
});
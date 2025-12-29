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
});
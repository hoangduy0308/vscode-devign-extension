import { v4 as uuidv4 } from 'uuid';

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params?: any;
    id?: string | number;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    result?: any;
    error?: JsonRpcError;
    id: string | number | null;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: any;
}

export class JsonRpc {
    private pendingRequests: Map<string | number, { resolve: (value: any) => void; reject: (reason?: any) => void }> = new Map();

    constructor(private sendCallback: (message: string) => void) { }

    public handleMessage(message: string): void {
        try {
            const response: JsonRpcResponse = JSON.parse(message);
            if (response.id !== undefined && response.id !== null) {
                const pending = this.pendingRequests.get(response.id);
                if (pending) {
                    if (response.error) {
                        pending.reject(response.error);
                    } else {
                        pending.resolve(response.result);
                    }
                    this.pendingRequests.delete(response.id);
                }
            }
        } catch (e) {
            console.error('Failed to parse JSON-RPC message:', e);
        }
    }

    public sendRequest(method: string, params?: any, options?: { timeout?: number; signal?: AbortSignal }): Promise<any> {
        const id = uuidv4();
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method,
            params,
            id
        };

        return new Promise((resolve, reject) => {
            let timeoutId: NodeJS.Timeout | undefined;

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                this.pendingRequests.delete(id);
            };

            const wrappedResolve = (value: any) => {
                cleanup();
                resolve(value);
            };

            const wrappedReject = (reason?: any) => {
                cleanup();
                reject(reason);
            };

            if (options?.signal) {
                if (options.signal.aborted) {
                    reject(new Error('Request cancelled'));
                    return;
                }
                options.signal.addEventListener('abort', () => {
                    wrappedReject(new Error('Request cancelled'));
                });
            }

            if (options?.timeout && options.timeout > 0) {
                timeoutId = setTimeout(() => {
                    wrappedReject(new Error(`Request timed out after ${options.timeout}ms`));
                }, options.timeout);
            }

            this.pendingRequests.set(id, { resolve: wrappedResolve, reject: wrappedReject });
            this.sendCallback(JSON.stringify(request));
        });
    }

    public sendNotification(method: string, params?: any): void {
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method,
            params
        };
        this.sendCallback(JSON.stringify(request));
    }
}
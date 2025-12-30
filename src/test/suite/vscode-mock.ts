// Simple mock for vscode module
class MockEventEmitter {
    private listeners: Function[] = [];
    
    get event() {
        return (listener: Function) => {
            this.listeners.push(listener);
            return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
        };
    }

    fire(data: any) {
        this.listeners.forEach(l => l(data));
    }

    dispose() {
        this.listeners = [];
    }
}

const vscodeMock = {
    window: {
        createOutputChannel: (name: string) => ({
            appendLine: (msg: string) => console.log(`[MockOutput] ${msg}`),
            showErrorMessage: (msg: string) => console.error(`[MockError] ${msg}`),
            dispose: () => { }
        }),
        showInformationMessage: () => Promise.resolve(undefined),
        showErrorMessage: () => Promise.resolve(undefined)
    },
    workspace: {
        getConfiguration: (section: string) => ({
            get: (key: string) => {
                if (key === 'pythonPath') return 'python';
                return undefined;
            }
        })
    },
    authentication: {
        getSession: () => Promise.resolve(null),
        onDidChangeSessions: (callback: Function) => ({ dispose: () => {} })
    },
    EventEmitter: MockEventEmitter,
    Disposable: class { dispose() {} }
};

// Hack to inject the mock
import * as Module from 'module';
const originalRequire = (Module.prototype as any).require;

(Module.prototype as any).require = function (path: string) {
    if (path === 'vscode') {
        return vscodeMock;
    }
    return originalRequire.apply(this, arguments as any);
};

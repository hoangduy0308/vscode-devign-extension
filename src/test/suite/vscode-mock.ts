// Simple mock for vscode module
const vscodeMock = {
    window: {
        createOutputChannel: (name: string) => ({
            appendLine: (msg: string) => console.log(`[MockOutput] ${msg}`),
            showErrorMessage: (msg: string) => console.error(`[MockError] ${msg}`),
            dispose: () => { }
        })
    },
    workspace: {
        getConfiguration: (section: string) => ({
            get: (key: string) => {
                if (key === 'pythonPath') return 'python';
                return undefined;
            }
        })
    }
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
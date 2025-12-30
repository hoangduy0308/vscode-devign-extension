import * as vscode from 'vscode';
import * as sinon from 'sinon';

export function mockVscode(sandbox: sinon.SinonSandbox) {
    const diagnosticCollectionStub = {
        clear: sandbox.stub(),
        set: sandbox.stub(),
        delete: sandbox.stub(),
        dispose: sandbox.stub(),
        forEach: sandbox.stub(),
        get: sandbox.stub(),
        has: sandbox.stub()
    };

    if (!vscode.languages) {
        (vscode as any).languages = {
            createDiagnosticCollection: sandbox.stub().returns(diagnosticCollectionStub as any)
        };
    } else {
        // Try to replace the property if it's not stubbable normally
        try {
            if (Object.getOwnPropertyDescriptor(vscode.languages, 'createDiagnosticCollection')?.configurable) {
                sandbox.stub(vscode.languages, 'createDiagnosticCollection').returns(diagnosticCollectionStub as any);
            } else {
                // If not configurable, just overwrite it on the object directly if allowed
                // This is risky but sometimes necessary in weird test envs
                (vscode.languages as any).createDiagnosticCollection = sandbox.stub().returns(diagnosticCollectionStub as any);
            }
        } catch (e) {
            console.log('Could not stub createDiagnosticCollection:', e);
            // Last resort: overwrite the whole languages object if possible
            (vscode as any).languages = {
                ...vscode.languages,
                createDiagnosticCollection: sandbox.stub().returns(diagnosticCollectionStub as any)
            };
        }
    }

    if (!vscode.Uri) {
        (vscode as any).Uri = {
            file: (path: string) => ({ fsPath: path, toString: () => path }),
            parse: (path: string) => ({ fsPath: path, toString: () => path })
        };
    }
}
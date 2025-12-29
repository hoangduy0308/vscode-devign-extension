import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { JsonRpc } from './jsonRpc';

export class WorkerManager {
    private process: cp.ChildProcess | null = null;
    private jsonRpc: JsonRpc | null = null;
    private isRestarting = false;
    private outputChannel: vscode.OutputChannel;

    constructor(private extensionPath: string) {
        this.outputChannel = vscode.window.createOutputChannel('Devign Worker');
    }

    public async start(): Promise<void> {
        if (this.process) {
            return;
        }

        const pythonPath = await this.getPythonPath();
        const scriptPath = path.join(this.extensionPath, 'python', 'vscode_scanner.py');

        this.outputChannel.appendLine(`Starting worker: ${pythonPath} ${scriptPath}`);

        this.process = cp.spawn(pythonPath, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        if (!this.process.pid) {
            this.outputChannel.appendLine('Failed to start worker process');
            throw new Error('Failed to start worker process');
        }

        this.jsonRpc = new JsonRpc((message) => {
            if (this.process && this.process.stdin) {
                this.process.stdin.write(message + '\n');
            }
        });

        this.process.stdout?.on('data', (data) => {
            const message = data.toString().trim();
            this.outputChannel.appendLine(`Received: ${message}`);
            this.jsonRpc?.handleMessage(message);
        });

        this.process.stderr?.on('data', (data) => {
            this.outputChannel.appendLine(`Worker Error: ${data.toString()}`);
        });

        this.process.on('exit', (code) => {
            this.outputChannel.appendLine(`Worker exited with code ${code}`);
            this.process = null;
            this.jsonRpc = null;
            if (!this.isRestarting) {
                // Handle unexpected exit
                vscode.window.showErrorMessage(`Devign worker exited unexpectedly with code ${code}`);
            }
        });
    }

    public spawn(): Promise<void> {
        return this.start();
    }

    public async stop(): Promise<void> {
        if (this.process) {
            this.process.kill();
            this.process = null;
            this.jsonRpc = null;
        }
    }

    public shutdown(): Promise<void> {
        return this.stop();
    }

    public async restart(): Promise<void> {
        this.isRestarting = true;
        await this.stop();
        this.isRestarting = false;
        await this.start();
    }

    public isHealthy(): boolean {
        return this.process !== null && !this.process.killed;
    }

    public async request(method: string, params?: any, options?: { timeout?: number; signal?: AbortSignal }): Promise<any> {
        if (!this.jsonRpc) {
            throw new Error('Worker not started');
        }
        const defaultTimeout = 30000;
        return this.jsonRpc.sendRequest(method, params, {
            timeout: options?.timeout ?? defaultTimeout,
            signal: options?.signal
        });
    }

    private async getPythonPath(): Promise<string> {
        const config = vscode.workspace.getConfiguration('devign');
        let pythonPath = config.get<string>('pythonPath');

        if (!pythonPath) {
            // Try to find python in path
            try {
                // Simple check, might need more robust logic for different OS
                cp.execSync('python3 --version');
                pythonPath = 'python3';
            } catch {
                try {
                    cp.execSync('python --version');
                    pythonPath = 'python';
                } catch {
                    throw new Error('Python not found. Please configure devign.pythonPath');
                }
            }
        }
        return pythonPath;
    }
}
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DangerousLine } from './decorations';

export interface ScanResult {
    file_path: string;
    vulnerable: boolean;
    probability: number;
    risk_level: string;
    dangerous_apis: string[];
    dangerous_lines: DangerousLine[];
    error?: string;
}

interface ScanResponse {
    summary: {
        files_scanned: number;
        vulnerabilities_found: number;
        errors: number;
    };
    results: ScanResult[];
}

export class DevignScanner {
    private context: vscode.ExtensionContext;
    private pythonPath: string = 'python';
    private scannerScript: string = '';
    private modelPath: string = '';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadConfiguration();

        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('devign')) {
                this.loadConfiguration();
            }
        });
    }

    private loadConfiguration() {
        const config = vscode.workspace.getConfiguration('devign');
        this.pythonPath = config.get<string>('pythonPath') || 'python';
        this.modelPath = config.get<string>('modelPath') || '';
        
        const customScriptPath = config.get<string>('scannerScript');
        if (customScriptPath) {
            this.scannerScript = customScriptPath;
        } else {
            const extensionPath = this.context.extensionPath;
            this.scannerScript = path.join(extensionPath, 'python', 'vscode_scanner.py');
        }
    }

    async scanFile(filePath: string, cancellationToken?: vscode.CancellationToken): Promise<ScanResult> {
        const results = await this.runScanner(['scan', filePath, '--format', 'json'], cancellationToken);
        
        if (results.length > 0) {
            return results[0];
        }

        return {
            file_path: filePath,
            vulnerable: false,
            probability: 0,
            risk_level: 'UNKNOWN',
            dangerous_apis: [],
            dangerous_lines: [],
            error: 'No results returned'
        };
    }

    async scanCode(code: string): Promise<ScanResult> {
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `devign_temp_${Date.now()}.c`);
        
        try {
            fs.writeFileSync(tempFile, code, 'utf8');
            const result = await this.scanFile(tempFile);
            result.file_path = 'selection';
            return result;
        } finally {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }

    async scanWorkspace(
        workspacePath: string,
        maxFiles: number,
        progressCallback?: (current: number, total: number, file: string) => void,
        cancellationToken?: vscode.CancellationToken
    ): Promise<ScanResult[]> {
        const files = await this.findCFiles(workspacePath, maxFiles);
        
        if (files.length === 0) {
            return [];
        }

        return this.runBatchScanner(files, progressCallback, cancellationToken);
    }

    private async runBatchScanner(
        files: string[],
        progressCallback?: (current: number, total: number, file: string) => void,
        cancellationToken?: vscode.CancellationToken
    ): Promise<ScanResult[]> {
        return new Promise((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('devign');
            const threshold = config.get<number>('threshold') || 0.36;
            const device = config.get<string>('device') || 'auto';
            const autoDownload = config.get<boolean>('autoDownloadModels') !== false;
            const timeout = (config.get<number>('scanTimeout') || 60) * 1000 * Math.max(files.length, 1);

            const fullArgs = [
                this.scannerScript,
                '--threshold', threshold.toString(),
                '--device', device,
                'scan-batch',
                '--progress'
            ];

            if (this.modelPath) {
                fullArgs.splice(1, 0, '--model-dir', this.modelPath);
            }
            
            if (!autoDownload) {
                fullArgs.splice(1, 0, '--no-auto-download');
            }

            console.log(`Devign: Running batch scan for ${files.length} files`);

            const childProcess = cp.spawn(this.pythonPath, fullArgs, {
                cwd: path.dirname(this.scannerScript),
                env: { ...process.env }
            });

            childProcess.stdin.write(JSON.stringify(files));
            childProcess.stdin.end();

            let stdout = '';
            let stderr = '';
            let killed = false;

            const cleanup = () => {
                if (!killed && !childProcess.killed) {
                    killed = true;
                    childProcess.kill('SIGTERM');
                }
            };

            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error(`Scanner timed out after ${timeout / 1000} seconds`));
            }, timeout);

            const cancellationListener = cancellationToken?.onCancellationRequested(() => {
                cleanup();
                reject(new Error('Scan cancelled by user'));
            });

            childProcess.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            childProcess.stderr.on('data', (data: Buffer) => {
                const chunk = data.toString();
                stderr += chunk;
                
                const lines = chunk.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    try {
                        const progress = JSON.parse(line);
                        if (progress.type === 'progress') {
                            progressCallback?.(progress.current, progress.total, path.basename(progress.file));
                        }
                    } catch {
                        // Not a progress message, ignore
                    }
                }
            });

            childProcess.on('close', (code: number | null) => {
                clearTimeout(timeoutId);
                cancellationListener?.dispose();

                if (killed) {
                    return;
                }

                if (code !== 0) {
                    console.error(`Devign Scanner stderr: ${stderr}`);
                    console.error(`Devign Scanner stdout: ${stdout}`);
                    reject(new Error(`Scanner exited with code ${code}: ${stderr || stdout}`));
                    return;
                }

                try {
                    const response: ScanResponse = JSON.parse(stdout);
                    resolve(response.results);
                } catch (error) {
                    console.error(`Devign Scanner parse error. stdout: ${stdout}`);
                    reject(new Error(`Failed to parse scanner output: ${stdout}`));
                }
            });

            childProcess.on('error', (error: Error) => {
                clearTimeout(timeoutId);
                cancellationListener?.dispose();
                reject(new Error(`Failed to start scanner: ${error.message}`));
            });
        });
    }

    private async findCFiles(dir: string, maxFiles: number): Promise<string[]> {
        const pattern = '**/*.{c,h,cpp,hpp,cc,cxx,hxx}';
        const exclude = '**/{node_modules,build,out,.git}/**';
        const files = await vscode.workspace.findFiles(pattern, exclude, maxFiles);
        return files.map(f => f.fsPath);
    }

    private async runScanner(args: string[], cancellationToken?: vscode.CancellationToken): Promise<ScanResult[]> {
        return new Promise((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('devign');
            const threshold = config.get<number>('threshold') || 0.36;
            const device = config.get<string>('device') || 'auto';
            const autoDownload = config.get<boolean>('autoDownloadModels') !== false;
            const timeout = (config.get<number>('scanTimeout') || 60) * 1000;

            const fullArgs = [
                this.scannerScript,
                '--threshold', threshold.toString(),
                '--device', device,
                ...args
            ];

            if (this.modelPath) {
                fullArgs.splice(1, 0, '--model-dir', this.modelPath);
            }
            
            if (!autoDownload) {
                fullArgs.splice(1, 0, '--no-auto-download');
            }

            console.log(`Devign: Running ${this.pythonPath} ${fullArgs.join(' ')}`);

            const childProcess = cp.spawn(this.pythonPath, fullArgs, {
                cwd: path.dirname(this.scannerScript),
                env: { ...process.env }
            });

            let stdout = '';
            let stderr = '';
            let killed = false;

            const cleanup = () => {
                if (!killed && !childProcess.killed) {
                    killed = true;
                    childProcess.kill('SIGTERM');
                }
            };

            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error(`Scanner timed out after ${timeout / 1000} seconds`));
            }, timeout);

            const cancellationListener = cancellationToken?.onCancellationRequested(() => {
                cleanup();
                reject(new Error('Scan cancelled by user'));
            });

            childProcess.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            childProcess.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            childProcess.on('close', (code: number | null) => {
                clearTimeout(timeoutId);
                cancellationListener?.dispose();

                if (killed) {
                    return;
                }

                if (code !== 0) {
                    console.error(`Devign Scanner stderr: ${stderr}`);
                    console.error(`Devign Scanner stdout: ${stdout}`);
                    reject(new Error(`Scanner exited with code ${code}: ${stderr || stdout}`));
                    return;
                }

                try {
                    const response: ScanResponse = JSON.parse(stdout);
                    resolve(response.results);
                } catch (error) {
                    console.error(`Devign Scanner parse error. stdout: ${stdout}`);
                    reject(new Error(`Failed to parse scanner output: ${stdout}`));
                }
            });

            childProcess.on('error', (error: Error) => {
                clearTimeout(timeoutId);
                cancellationListener?.dispose();
                reject(new Error(`Failed to start scanner: ${error.message}`));
            });
        });
    }
}

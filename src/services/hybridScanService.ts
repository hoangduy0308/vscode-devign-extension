import * as vscode from 'vscode';
import { DevignScanner, ScanResult } from '../scanner';
import { FunctionInfo, FunctionScanResult, FunctionScannerService } from './functionScanner';
import { extractFunctions, isCppFile } from '../parsers';
import { DiffAnalyzer } from './diffAnalyzer';
import { GitService } from './gitService';

/**
 * Trigger types for hybrid scanning
 */
export type ScanTrigger = 'typing' | 'save' | 'manual';

/**
 * Result of a hybrid scan operation
 */
export interface HybridScanResult {
    trigger: ScanTrigger;
    filePath: string;
    functions: FunctionScanResult[];
    totalScanned: number;
    vulnerableCount: number;
    scanDurationMs: number;
    timestamp: Date;
}

/**
 * Options for hybrid scan
 */
export interface HybridScanOptions {
    trigger: ScanTrigger;
    document: vscode.TextDocument;
    cursorPosition?: vscode.Position;
    cancellationToken?: vscode.CancellationToken;
}

/**
 * Hybrid Scan Service
 * 
 * Implements A+B scanning strategy:
 * - Typing → Scan only the current function (debounced)
 * - Save → Scan all changed functions in the file
 * - Diff scan for staged files
 */
export class HybridScanService {
    private scanner: DevignScanner;
    private functionScanner: FunctionScannerService;
    private diffAnalyzer: DiffAnalyzer;
    private gitService: GitService;
    
    private debouncedTimers: Map<string, NodeJS.Timeout> = new Map();
    private lastScanResults: Map<string, HybridScanResult> = new Map();
    private functionHashCache: Map<string, Map<string, string>> = new Map();
    
    private readonly TYPING_DEBOUNCE_MS = 800;
    private readonly _onScanComplete = new vscode.EventEmitter<HybridScanResult>();
    public readonly onScanComplete = this._onScanComplete.event;

    constructor(
        scanner: DevignScanner,
        gitService: GitService
    ) {
        this.scanner = scanner;
        this.gitService = gitService;
        this.functionScanner = new FunctionScannerService(scanner);
        this.diffAnalyzer = new DiffAnalyzer(gitService);
    }

    /**
     * Trigger scan based on typing (debounced).
     * Scans only the function at cursor position.
     */
    async scanOnTyping(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<void> {
        const key = document.uri.toString();
        
        const existingTimer = this.debouncedTimers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            this.debouncedTimers.delete(key);
            await this.scanCurrentFunction(document, position);
        }, this.TYPING_DEBOUNCE_MS);

        this.debouncedTimers.set(key, timer);
    }

    /**
     * Scan only the function at the current cursor position.
     */
    async scanCurrentFunction(
        document: vscode.TextDocument,
        position: vscode.Position,
        cancellationToken?: vscode.CancellationToken
    ): Promise<HybridScanResult | null> {
        if (!this.isSupportedFile(document)) {
            return null;
        }

        const startTime = Date.now();
        const content = document.getText();
        const filePath = document.uri.fsPath;
        
        const functions = extractFunctions(content, filePath);
        const currentFunction = this.findFunctionAtPosition(functions, position);
        
        if (!currentFunction) {
            return null;
        }

        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        const scanResults = await this.functionScanner.scanFunctions([currentFunction]);
        const endTime = Date.now();
        
        const result: HybridScanResult = {
            trigger: 'typing',
            filePath,
            functions: scanResults,
            totalScanned: 1,
            vulnerableCount: scanResults.filter(r => r.vulnerable).length,
            scanDurationMs: endTime - startTime,
            timestamp: new Date()
        };

        this.lastScanResults.set(filePath, result);
        this._onScanComplete.fire(result);
        
        return result;
    }

    /**
     * Trigger scan on save.
     * Scans all changed functions in the file.
     */
    async scanOnSave(
        document: vscode.TextDocument,
        cancellationToken?: vscode.CancellationToken
    ): Promise<HybridScanResult | null> {
        if (!this.isSupportedFile(document)) {
            return null;
        }

        const startTime = Date.now();
        const content = document.getText();
        const filePath = document.uri.fsPath;

        const allFunctions = extractFunctions(content, filePath);
        const changedFunctions = await this.getChangedFunctions(filePath, allFunctions);
        
        if (changedFunctions.length === 0) {
            return {
                trigger: 'save',
                filePath,
                functions: [],
                totalScanned: 0,
                vulnerableCount: 0,
                scanDurationMs: Date.now() - startTime,
                timestamp: new Date()
            };
        }

        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        const scanResults = await this.functionScanner.scanFunctions(changedFunctions);
        const endTime = Date.now();

        this.updateFunctionHashes(filePath, allFunctions);

        const result: HybridScanResult = {
            trigger: 'save',
            filePath,
            functions: scanResults,
            totalScanned: changedFunctions.length,
            vulnerableCount: scanResults.filter(r => r.vulnerable).length,
            scanDurationMs: endTime - startTime,
            timestamp: new Date()
        };

        this.lastScanResults.set(filePath, result);
        this._onScanComplete.fire(result);
        
        return result;
    }

    /**
     * Scan all staged C/C++ files for the security gate.
     */
    async scanStagedFiles(
        cancellationToken?: vscode.CancellationToken
    ): Promise<HybridScanResult[]> {
        const stagedFunctions = await this.diffAnalyzer.getStagedFunctions();
        
        if (stagedFunctions.length === 0) {
            return [];
        }

        const results: HybridScanResult[] = [];
        const functionsByFile = this.groupFunctionsByFile(stagedFunctions);

        for (const [filePath, functions] of functionsByFile) {
            if (cancellationToken?.isCancellationRequested) {
                break;
            }

            const startTime = Date.now();
            const scanResults = await this.functionScanner.scanFunctions(functions);
            const endTime = Date.now();

            const result: HybridScanResult = {
                trigger: 'manual',
                filePath,
                functions: scanResults,
                totalScanned: functions.length,
                vulnerableCount: scanResults.filter(r => r.vulnerable).length,
                scanDurationMs: endTime - startTime,
                timestamp: new Date()
            };

            results.push(result);
            this.lastScanResults.set(filePath, result);
            this._onScanComplete.fire(result);
        }

        return results;
    }

    /**
     * Get the last scan result for a file.
     */
    getLastResult(filePath: string): HybridScanResult | undefined {
        return this.lastScanResults.get(filePath);
    }

    /**
     * Clear all cached results and timers.
     */
    clearCache(): void {
        this.debouncedTimers.forEach(timer => clearTimeout(timer));
        this.debouncedTimers.clear();
        this.lastScanResults.clear();
        this.functionHashCache.clear();
        this.functionScanner.clearCache();
    }

    /**
     * Dispose resources.
     */
    dispose(): void {
        this.clearCache();
        this._onScanComplete.dispose();
    }

    private isSupportedFile(document: vscode.TextDocument): boolean {
        return isCppFile(document.uri.fsPath);
    }

    private findFunctionAtPosition(
        functions: FunctionInfo[],
        position: vscode.Position
    ): FunctionInfo | null {
        const line = position.line + 1; // Convert to 1-indexed
        
        for (const func of functions) {
            if (line >= func.startLine && line <= func.endLine) {
                return func;
            }
        }
        
        return null;
    }

    private async getChangedFunctions(
        filePath: string,
        currentFunctions: FunctionInfo[]
    ): Promise<FunctionInfo[]> {
        const previousHashes = this.functionHashCache.get(filePath);
        
        if (!previousHashes) {
            return currentFunctions;
        }

        const changedFunctions: FunctionInfo[] = [];
        
        for (const func of currentFunctions) {
            const currentHash = this.hashFunction(func);
            const previousHash = previousHashes.get(func.name);
            
            if (previousHash !== currentHash) {
                changedFunctions.push(func);
            }
        }

        return changedFunctions;
    }

    private updateFunctionHashes(filePath: string, functions: FunctionInfo[]): void {
        const hashes = new Map<string, string>();
        
        for (const func of functions) {
            hashes.set(func.name, this.hashFunction(func));
        }
        
        this.functionHashCache.set(filePath, hashes);
    }

    private hashFunction(func: FunctionInfo): string {
        let hash = 5381;
        const str = func.code;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    private groupFunctionsByFile(functions: FunctionInfo[]): Map<string, FunctionInfo[]> {
        const grouped = new Map<string, FunctionInfo[]>();
        
        for (const func of functions) {
            const existing = grouped.get(func.filePath) || [];
            existing.push(func);
            grouped.set(func.filePath, existing);
        }
        
        return grouped;
    }
}

let hybridScanServiceInstance: HybridScanService | null = null;

export function getHybridScanService(
    scanner: DevignScanner,
    gitService: GitService
): HybridScanService {
    if (!hybridScanServiceInstance) {
        hybridScanServiceInstance = new HybridScanService(scanner, gitService);
    }
    return hybridScanServiceInstance;
}

export function disposeHybridScanService(): void {
    if (hybridScanServiceInstance) {
        hybridScanServiceInstance.dispose();
        hybridScanServiceInstance = null;
    }
}

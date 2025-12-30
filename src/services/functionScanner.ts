import { DevignScanner, ScanResult } from '../scanner';
import { GateCacheService } from './gateCacheService';

export interface FunctionInfo {
    name: string;
    code: string;
    filePath: string;
    startLine: number;
    endLine: number;
}

export interface FunctionScanResult extends ScanResult {
    functionInfo: FunctionInfo;
    contentHash: string;
    cached: boolean;
}

function djb2Hash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
}

export class FunctionScannerService {
    private scanner: DevignScanner;
    private batchSize: number;
    private cacheService?: GateCacheService;

    constructor(
        scanner: DevignScanner,
        batchSize: number = 5,
        cacheService?: GateCacheService
    ) {
        this.scanner = scanner;
        this.batchSize = batchSize;
        this.cacheService = cacheService;
    }

    async scanFunctions(functions: FunctionInfo[]): Promise<FunctionScanResult[]> {
        const results: FunctionScanResult[] = [];

        for (let i = 0; i < functions.length; i += this.batchSize) {
            const batch = functions.slice(i, i + this.batchSize);
            const batchResults = await Promise.all(
                batch.map(fn => this.scanFunction(fn))
            );
            results.push(...batchResults);
        }

        return results;
    }

    private async scanFunction(functionInfo: FunctionInfo): Promise<FunctionScanResult> {
        const contentHash = djb2Hash(functionInfo.code);

        // Try global cache first
        if (this.cacheService) {
            const cachedResult = this.cacheService.get(contentHash);
            if (cachedResult) {
                return {
                    ...cachedResult,
                    functionInfo,
                    contentHash,
                    cached: true
                };
            }
        }

        const result = await this.scanner.scanCode(functionInfo.code);

        // Update global cache
        if (this.cacheService) {
            this.cacheService.set(contentHash, result);
        }

        return {
            ...result,
            functionInfo,
            contentHash,
            cached: false
        };
    }

    clearCache(): void {
        if (this.cacheService) {
            this.cacheService.clear();
        }
    }
}

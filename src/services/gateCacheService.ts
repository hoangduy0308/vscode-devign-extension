import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ScanResult } from '../scanner';

interface CacheEntry {
    hash: string;
    result: ScanResult;
    timestamp: number;
    lastAccessed: number;
}

interface CacheStorage {
    version: string;
    entries: { [hash: string]: CacheEntry };
}

export class GateCacheService {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly CACHE_VERSION = '1.0';
    private readonly MAX_CACHE_SIZE = 1000; // Max number of entries
    private readonly CACHE_FILE = 'devign-scan-cache.json';
    private storagePath: string;
    private isDirty: boolean = false;
    private saveInterval: NodeJS.Timeout | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.storagePath = path.join(context.globalStorageUri.fsPath, this.CACHE_FILE);
        this.loadCache();

        // Auto-save every 5 minutes if dirty
        this.saveInterval = setInterval(() => {
            if (this.isDirty) {
                this.saveCache();
            }
        }, 5 * 60 * 1000);
    }

    private ensureStorageDirectory() {
        const dir = path.dirname(this.storagePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private loadCache() {
        try {
            if (fs.existsSync(this.storagePath)) {
                const content = fs.readFileSync(this.storagePath, 'utf8');
                const storage: CacheStorage = JSON.parse(content);

                if (storage.version === this.CACHE_VERSION) {
                    for (const [hash, entry] of Object.entries(storage.entries)) {
                        this.cache.set(hash, entry);
                    }
                    console.log(`Devign: Loaded ${this.cache.size} cache entries`);
                } else {
                    console.log('Devign: Cache version mismatch, starting fresh');
                }
            }
        } catch (error) {
            console.error('Devign: Failed to load cache:', error);
        }
    }

    private saveCache() {
        try {
            this.ensureStorageDirectory();

            const entries: { [hash: string]: CacheEntry } = {};
            for (const [hash, entry] of this.cache.entries()) {
                entries[hash] = entry;
            }

            const storage: CacheStorage = {
                version: this.CACHE_VERSION,
                entries
            };

            fs.writeFileSync(this.storagePath, JSON.stringify(storage, null, 2));
            this.isDirty = false;
            console.log('Devign: Cache saved to disk');
        } catch (error) {
            console.error('Devign: Failed to save cache:', error);
        }
    }

    public get(hash: string): ScanResult | undefined {
        const entry = this.cache.get(hash);
        if (entry) {
            entry.lastAccessed = Date.now();
            return entry.result;
        }
        return undefined;
    }

    public set(hash: string, result: ScanResult) {
        // Evict if full
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            this.evictOldest();
        }

        this.cache.set(hash, {
            hash,
            result,
            timestamp: Date.now(),
            lastAccessed: Date.now()
        });
        this.isDirty = true;
    }

    private evictOldest() {
        let oldestHash: string | null = null;
        let oldestAccess = Infinity;

        for (const [hash, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestAccess) {
                oldestAccess = entry.lastAccessed;
                oldestHash = hash;
            }
        }

        if (oldestHash) {
            this.cache.delete(oldestHash);
        }
    }

    public clear() {
        this.cache.clear();
        this.isDirty = true;
        this.saveCache();
    }

    public dispose() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        if (this.isDirty) {
            this.saveCache();
        }
    }
}

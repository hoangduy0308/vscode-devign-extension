import * as vscode from 'vscode';
import { ScanResult } from '../scanner';

/**
 * Cached scan result with metadata
 */
export interface CachedScanResult {
    /** The actual scan result */
    result: ScanResult;
    /** Timestamp when the result was cached */
    timestamp: number;
    /** Number of cache hits for this entry */
    hits: number;
}

/**
 * Cache statistics for monitoring performance
 */
export interface CacheStats {
    /** Current number of entries in cache */
    size: number;
    /** Total cache hits */
    hits: number;
    /** Total cache misses */
    misses: number;
    /** Hit rate as a decimal (0.0 - 1.0) */
    hitRate: number;
}

/**
 * Configuration options for the cache service
 */
export interface GateCacheConfig {
    /** Time-to-live in milliseconds (default: 5 minutes) */
    ttlMs: number;
    /** Maximum number of cache entries (default: 1000) */
    maxEntries: number;
}

/**
 * Internal cache entry with access tracking for LRU eviction
 */
interface CacheEntry {
    /** The cached scan result with metadata */
    data: CachedScanResult;
    /** Last access timestamp for LRU eviction */
    lastAccess: number;
}

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: GateCacheConfig = {
    ttlMs: 5 * 60 * 1000, // 5 minutes
    maxEntries: 1000
};

/**
 * GateCacheService
 * 
 * Service to cache scan results and avoid redundant scanning.
 * Implements LRU eviction and TTL-based expiration.
 * 
 * Features:
 * - Cache key based on file path, content hash, and function range
 * - Configurable TTL (default 5 minutes)
 * - Configurable max entries (default 1000)
 * - LRU eviction when max entries reached
 * - Auto-expire entries after TTL
 * - File watcher integration for cache invalidation
 * - Singleton pattern
 * 
 * Usage:
 * ```typescript
 * const cacheService = getGateCacheService();
 * const key = cacheService.getCacheKey(filePath, contentHash, startLine, endLine);
 * 
 * if (cacheService.has(key)) {
 *     const cached = cacheService.get(key);
 *     // Use cached result
 * } else {
 *     const result = await scanner.scan(...);
 *     cacheService.set(key, result);
 * }
 * ```
 */
export class GateCacheService {
    private static instance: GateCacheService | undefined;
    
    /** Main cache storage */
    private cache: Map<string, CacheEntry> = new Map();
    
    /** Index of cache keys by file path for efficient invalidation */
    private fileIndex: Map<string, Set<string>> = new Map();
    
    /** Cache configuration */
    private config: GateCacheConfig;
    
    /** Statistics tracking */
    private stats = {
        hits: 0,
        misses: 0
    };
    
    /** Disposables for cleanup */
    private disposables: vscode.Disposable[] = [];
    
    /** File system watcher for automatic invalidation */
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    private constructor(config?: Partial<GateCacheConfig>) {
        this.config = {
            ...DEFAULT_CACHE_CONFIG,
            ...config
        };
        
        this.setupFileWatcher();
        
        // Listen for configuration changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('devign.gate.cache')) {
                    this.loadConfigFromSettings();
                }
            })
        );
        
        // Load initial configuration from settings
        this.loadConfigFromSettings();
    }

    /**
     * Get the singleton instance of GateCacheService
     */
    public static getInstance(): GateCacheService {
        if (!GateCacheService.instance) {
            GateCacheService.instance = new GateCacheService();
        }
        return GateCacheService.instance;
    }

    /**
     * Reset the singleton instance.
     * Useful for testing or when a fresh instance is needed.
     */
    public static resetInstance(): void {
        if (GateCacheService.instance) {
            GateCacheService.instance.dispose();
            GateCacheService.instance = undefined;
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.fileWatcher?.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.cache.clear();
        this.fileIndex.clear();
        this.stats = { hits: 0, misses: 0 };
    }

    /**
     * Load cache configuration from VS Code settings
     */
    private loadConfigFromSettings(): void {
        const config = vscode.workspace.getConfiguration('devign.gate.cache');
        const ttlSeconds = config.get<number>('ttlSeconds');
        const maxEntries = config.get<number>('maxEntries');
        
        if (ttlSeconds !== undefined) {
            this.config.ttlMs = ttlSeconds * 1000;
        }
        if (maxEntries !== undefined) {
            this.config.maxEntries = maxEntries;
        }
    }

    /**
     * Setup file system watcher for automatic cache invalidation
     */
    private setupFileWatcher(): void {
        // Watch for changes to C/C++ files
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            '**/*.{c,h,cpp,hpp,cc,cxx,hxx}'
        );
        
        // Invalidate cache when files change
        this.fileWatcher.onDidChange((uri) => {
            this.invalidateFile(uri.fsPath);
        });
        
        this.fileWatcher.onDidDelete((uri) => {
            this.invalidateFile(uri.fsPath);
        });
        
        this.disposables.push(this.fileWatcher);
    }

    /**
     * Generate a cache key from file path, content hash, and function range
     * 
     * @param filePath Path to the file
     * @param contentHash Hash of the file content
     * @param startLine Start line of the function
     * @param endLine End line of the function
     * @returns Unique cache key string
     */
    public getCacheKey(filePath: string, contentHash: string, startLine: number, endLine: number): string {
        // Normalize file path for consistent keys across platforms
        const normalizedPath = filePath.replace(/\\/g, '/');
        return `${normalizedPath}:${contentHash}:${startLine}-${endLine}`;
    }

    /**
     * Compute a simple hash of content string
     * Uses a fast non-cryptographic hash suitable for cache keys
     * 
     * @param content The content to hash
     * @returns Hash string
     */
    public computeContentHash(content: string): string {
        // Simple djb2 hash algorithm - fast and good distribution
        let hash = 5381;
        for (let i = 0; i < content.length; i++) {
            hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
        }
        // Convert to unsigned 32-bit integer and then to hex string
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    /**
     * Get a cached scan result
     * 
     * @param key Cache key
     * @returns Cached result if found and not expired, undefined otherwise
     */
    public get(key: string): CachedScanResult | undefined {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return undefined;
        }
        
        // Check if entry has expired
        const now = Date.now();
        if (now - entry.data.timestamp > this.config.ttlMs) {
            // Entry expired, remove it
            this.removeEntry(key);
            this.stats.misses++;
            return undefined;
        }
        
        // Update access time and hit count
        entry.lastAccess = now;
        entry.data.hits++;
        this.stats.hits++;
        
        return entry.data;
    }

    /**
     * Store a scan result in the cache
     * 
     * @param key Cache key
     * @param result Scan result to cache
     */
    public set(key: string, result: ScanResult): void {
        // Evict entries if at capacity
        this.evictIfNeeded();
        
        const now = Date.now();
        const cachedResult: CachedScanResult = {
            result,
            timestamp: now,
            hits: 0
        };
        
        const entry: CacheEntry = {
            data: cachedResult,
            lastAccess: now
        };
        
        // Add to main cache
        this.cache.set(key, entry);
        
        // Update file index for efficient invalidation
        const filePath = this.extractFilePathFromKey(key);
        if (filePath) {
            if (!this.fileIndex.has(filePath)) {
                this.fileIndex.set(filePath, new Set());
            }
            this.fileIndex.get(filePath)!.add(key);
        }
    }

    /**
     * Check if a key exists in the cache and is not expired
     * 
     * @param key Cache key
     * @returns true if key exists and is not expired
     */
    public has(key: string): boolean {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return false;
        }
        
        // Check if entry has expired
        const now = Date.now();
        if (now - entry.data.timestamp > this.config.ttlMs) {
            // Entry expired, remove it
            this.removeEntry(key);
            return false;
        }
        
        return true;
    }

    /**
     * Invalidate all cache entries for a specific file
     * 
     * @param filePath Path to the file
     */
    public invalidateFile(filePath: string): void {
        // Normalize file path
        const normalizedPath = filePath.replace(/\\/g, '/');
        
        const keys = this.fileIndex.get(normalizedPath);
        if (keys) {
            for (const key of keys) {
                this.cache.delete(key);
            }
            this.fileIndex.delete(normalizedPath);
        }
        
        // Also check with original path in case of different normalization
        const originalKeys = this.fileIndex.get(filePath);
        if (originalKeys) {
            for (const key of originalKeys) {
                this.cache.delete(key);
            }
            this.fileIndex.delete(filePath);
        }
    }

    /**
     * Clear the entire cache
     */
    public invalidateAll(): void {
        this.cache.clear();
        this.fileIndex.clear();
        // Reset stats on full invalidation
        this.stats = { hits: 0, misses: 0 };
    }

    /**
     * Get cache statistics
     * 
     * @returns Cache statistics including size, hits, misses, and hit rate
     */
    public getStats(): CacheStats {
        // Clean up expired entries before reporting stats
        this.cleanupExpired();
        
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? this.stats.hits / total : 0;
        
        return {
            size: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate
        };
    }

    /**
     * Get current cache configuration
     * 
     * @returns Current cache configuration
     */
    public getConfig(): GateCacheConfig {
        return { ...this.config };
    }

    /**
     * Update cache configuration
     * 
     * @param config Partial configuration to update
     */
    public updateConfig(config: Partial<GateCacheConfig>): void {
        this.config = {
            ...this.config,
            ...config
        };
        
        // If max entries reduced, evict excess entries
        this.evictIfNeeded();
    }

    /**
     * Extract file path from cache key
     */
    private extractFilePathFromKey(key: string): string | undefined {
        // Key format: filePath:contentHash:startLine-endLine
        const lastColonIndex = key.lastIndexOf(':');
        if (lastColonIndex === -1) {
            return undefined;
        }
        
        const secondLastColonIndex = key.lastIndexOf(':', lastColonIndex - 1);
        if (secondLastColonIndex === -1) {
            return undefined;
        }
        
        return key.substring(0, secondLastColonIndex);
    }

    /**
     * Remove a single entry from cache and file index
     */
    private removeEntry(key: string): void {
        this.cache.delete(key);
        
        const filePath = this.extractFilePathFromKey(key);
        if (filePath) {
            const keys = this.fileIndex.get(filePath);
            if (keys) {
                keys.delete(key);
                if (keys.size === 0) {
                    this.fileIndex.delete(filePath);
                }
            }
        }
    }

    /**
     * Evict least recently used entries if cache is at capacity
     */
    private evictIfNeeded(): void {
        while (this.cache.size >= this.config.maxEntries) {
            // Find the least recently used entry
            let oldestKey: string | undefined;
            let oldestAccess = Infinity;
            
            for (const [key, entry] of this.cache) {
                if (entry.lastAccess < oldestAccess) {
                    oldestAccess = entry.lastAccess;
                    oldestKey = key;
                }
            }
            
            if (oldestKey) {
                this.removeEntry(oldestKey);
            } else {
                break;
            }
        }
    }

    /**
     * Clean up expired entries
     */
    private cleanupExpired(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];
        
        for (const [key, entry] of this.cache) {
            if (now - entry.data.timestamp > this.config.ttlMs) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            this.removeEntry(key);
        }
    }
}

/**
 * Get the singleton instance of GateCacheService
 * 
 * @returns GateCacheService singleton instance
 */
export function getGateCacheService(): GateCacheService {
    return GateCacheService.getInstance();
}

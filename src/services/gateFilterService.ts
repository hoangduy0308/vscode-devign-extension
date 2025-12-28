import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Configuration for gate file filtering
 */
export interface GateFilterConfig {
    /** Glob patterns to include in gate scanning (applied first) */
    includeGlobs: string[];
    /** Glob patterns to exclude from gate scanning (applied after include) */
    excludeGlobs: string[];
}

/**
 * Default configuration values
 */
const DEFAULT_INCLUDE_GLOBS = ['**/*.c', '**/*.cpp', '**/*.h', '**/*.hpp'];
const DEFAULT_EXCLUDE_GLOBS = ['**/third_party/**', '**/vendor/**', '**/node_modules/**', '**/*.min.*'];

/**
 * GateFilterService
 * 
 * Provides file filtering for the security gate based on include/exclude glob patterns.
 * Include patterns are applied first, then exclude patterns filter out unwanted files.
 * 
 * Configuration:
 * - devign.gate.includeGlobs: Glob patterns to include (default: C/C++ files)
 * - devign.gate.excludeGlobs: Glob patterns to exclude (default: third_party, vendor, node_modules, minified)
 */
export class GateFilterService {
    private config: GateFilterConfig;
    private workspaceRoot: string | undefined;

    constructor() {
        this.config = this.loadConfig();
        this.workspaceRoot = this.getWorkspaceRoot();
    }

    /**
     * Load filter configuration from VS Code settings
     */
    private loadConfig(): GateFilterConfig {
        const config = vscode.workspace.getConfiguration('devign.gate');
        
        return {
            includeGlobs: config.get<string[]>('includeGlobs', DEFAULT_INCLUDE_GLOBS),
            excludeGlobs: config.get<string[]>('excludeGlobs', DEFAULT_EXCLUDE_GLOBS)
        };
    }

    /**
     * Get the workspace root path
     */
    private getWorkspaceRoot(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri.fsPath;
        }
        return undefined;
    }

    /**
     * Reload configuration from VS Code settings.
     * Call this when settings may have changed.
     */
    public reloadConfig(): void {
        this.config = this.loadConfig();
        this.workspaceRoot = this.getWorkspaceRoot();
    }

    /**
     * Get the current filter configuration
     */
    public getConfig(): GateFilterConfig {
        return { ...this.config };
    }

    /**
     * Normalize a file path for consistent matching.
     * Converts backslashes to forward slashes and makes path relative to workspace.
     */
    private normalizePath(filePath: string): string {
        // Convert to forward slashes for consistent matching
        let normalized = filePath.replace(/\\/g, '/');
        
        // Make path relative to workspace root if possible
        if (this.workspaceRoot) {
            const workspaceNormalized = this.workspaceRoot.replace(/\\/g, '/');
            if (normalized.startsWith(workspaceNormalized)) {
                normalized = normalized.substring(workspaceNormalized.length);
                // Remove leading slash
                if (normalized.startsWith('/')) {
                    normalized = normalized.substring(1);
                }
            }
        }
        
        return normalized;
    }

    /**
     * Check if a path matches a glob pattern.
     * Uses simple glob matching with support for:
     * - ** (matches any path segments)
     * - * (matches any characters except /)
     * - ? (matches single character)
     */
    private matchesGlob(filePath: string, pattern: string): boolean {
        // Normalize both path and pattern
        const normalizedPath = filePath.replace(/\\/g, '/');
        const normalizedPattern = pattern.replace(/\\/g, '/');
        
        // Convert glob pattern to regex
        const regexPattern = this.globToRegex(normalizedPattern);
        
        try {
            const regex = new RegExp(regexPattern, 'i');
            return regex.test(normalizedPath);
        } catch {
            console.warn(`GateFilterService: Invalid glob pattern: ${pattern}`);
            return false;
        }
    }

    /**
     * Convert a glob pattern to a regular expression string.
     */
    private globToRegex(glob: string): string {
        let regex = '';
        let i = 0;
        
        while (i < glob.length) {
            const char = glob[i];
            
            if (char === '*') {
                if (glob[i + 1] === '*') {
                    // ** matches any path segments
                    if (glob[i + 2] === '/') {
                        // **/  matches zero or more directories
                        regex += '(?:.*\\/)?';
                        i += 3;
                    } else {
                        // ** at end or before non-slash matches anything
                        regex += '.*';
                        i += 2;
                    }
                } else {
                    // * matches any characters except /
                    regex += '[^/]*';
                    i++;
                }
            } else if (char === '?') {
                // ? matches single character except /
                regex += '[^/]';
                i++;
            } else if (char === '.') {
                // Escape dots
                regex += '\\.';
                i++;
            } else if (char === '/') {
                regex += '\\/';
                i++;
            } else if ('[{()^$|+\\'.includes(char)) {
                // Escape other regex special characters
                regex += '\\' + char;
                i++;
            } else {
                regex += char;
                i++;
            }
        }
        
        // Anchor the pattern
        return '^' + regex + '$';
    }

    /**
     * Check if a file matches any of the include patterns.
     */
    private matchesIncludePatterns(filePath: string): boolean {
        const normalized = this.normalizePath(filePath);
        
        // If no include patterns, include everything
        if (this.config.includeGlobs.length === 0) {
            return true;
        }
        
        // Check if file matches any include pattern
        return this.config.includeGlobs.some(pattern => 
            this.matchesGlob(normalized, pattern) || 
            this.matchesGlob(filePath, pattern)
        );
    }

    /**
     * Check if a file matches any of the exclude patterns.
     */
    private matchesExcludePatterns(filePath: string): boolean {
        const normalized = this.normalizePath(filePath);
        
        // If no exclude patterns, exclude nothing
        if (this.config.excludeGlobs.length === 0) {
            return false;
        }
        
        // Check if file matches any exclude pattern
        return this.config.excludeGlobs.some(pattern => 
            this.matchesGlob(normalized, pattern) || 
            this.matchesGlob(filePath, pattern)
        );
    }

    /**
     * Determine if a file should be scanned by the security gate.
     * 
     * Logic:
     * 1. Check if file matches any include pattern (if no patterns, all files included)
     * 2. Check if file matches any exclude pattern
     * 3. File is scanned if: included AND NOT excluded
     * 
     * @param filePath Absolute or relative path to the file
     * @returns true if the file should be scanned, false if it should be skipped
     */
    public shouldScanFile(filePath: string): boolean {
        // First check include patterns
        if (!this.matchesIncludePatterns(filePath)) {
            return false;
        }
        
        // Then check exclude patterns
        if (this.matchesExcludePatterns(filePath)) {
            return false;
        }
        
        return true;
    }

    /**
     * Filter an array of file paths, returning only those that should be scanned.
     * 
     * @param filePaths Array of file paths to filter
     * @returns Array of file paths that should be scanned
     */
    public filterFiles(filePaths: string[]): string[] {
        return filePaths.filter(filePath => this.shouldScanFile(filePath));
    }

    /**
     * Get a summary of why a file was included or excluded.
     * Useful for debugging and logging.
     * 
     * @param filePath Path to the file
     * @returns Object with inclusion status and reason
     */
    public getFilterReason(filePath: string): { included: boolean; reason: string } {
        const normalized = this.normalizePath(filePath);
        
        // Check include patterns
        if (!this.matchesIncludePatterns(filePath)) {
            return {
                included: false,
                reason: `File does not match any include pattern: ${this.config.includeGlobs.join(', ')}`
            };
        }
        
        // Check exclude patterns
        for (const pattern of this.config.excludeGlobs) {
            if (this.matchesGlob(normalized, pattern) || this.matchesGlob(filePath, pattern)) {
                return {
                    included: false,
                    reason: `File matches exclude pattern: ${pattern}`
                };
            }
        }
        
        return {
            included: true,
            reason: 'File matches include patterns and does not match any exclude pattern'
        };
    }
}

// Singleton instance for convenience
let gateFilterServiceInstance: GateFilterService | undefined;

/**
 * Get the singleton GateFilterService instance.
 * Creates a new instance if one doesn't exist.
 */
export function getGateFilterService(): GateFilterService {
    if (!gateFilterServiceInstance) {
        gateFilterServiceInstance = new GateFilterService();
    }
    return gateFilterServiceInstance;
}

/**
 * Reset the singleton instance.
 * Useful for testing or when configuration changes significantly.
 */
export function resetGateFilterService(): void {
    gateFilterServiceInstance = undefined;
}

/**
 * Parse Fallback Service
 * 
 * Handles fallback strategies when tree-sitter or regex parsing fails.
 * Provides configurable behavior for graceful degradation during code analysis.
 * 
 * Fallback Modes:
 * - 'scanFile': Treat the entire file as a single function and scan it
 * - 'skip': Skip the file entirely, log warning, don't block flow
 * - 'warn': Log warning and skip file (same behavior as 'skip')
 */

import * as vscode from 'vscode';
import { FunctionInfo } from './functionScanner';
import { GateLoggingService, LogContext, getGateLoggingService } from './gateLoggingService';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Available fallback modes when parsing fails
 */
export type FallbackMode = 'scanFile' | 'skip' | 'warn';

/**
 * Result of handling a parse failure
 */
export interface FallbackResult {
    /** The action taken: 'scanFile' to scan whole file, 'skip' to skip the file */
    action: 'scanFile' | 'skip';
    /** Function info if action is 'scanFile', representing the whole file */
    functionInfo?: FunctionInfo;
    /** Whether the fallback was logged */
    logged: boolean;
}

/**
 * Configuration for the fallback service
 */
interface ParseFallbackConfig {
    fallbackMode: FallbackMode;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FALLBACK_MODE: FallbackMode = 'warn';
const CONFIG_SECTION = 'devign.gate';
const CONFIG_KEY_FALLBACK_MODE = 'fallbackMode';

// ============================================================================
// ParseFallbackService Class
// ============================================================================

/**
 * Service to handle fallback strategies when parsing fails.
 * 
 * This service is called from DiffAnalyzer when extractFunctions fails
 * and from FunctionScanner when scan fails.
 */
export class ParseFallbackService {
    private static instance: ParseFallbackService | undefined;
    private logger: GateLoggingService;
    private config: ParseFallbackConfig;

    private constructor() {
        this.logger = getGateLoggingService();
        this.config = this.loadConfig();
    }

    /**
     * Gets the singleton instance of ParseFallbackService
     */
    static getInstance(): ParseFallbackService {
        if (!ParseFallbackService.instance) {
            ParseFallbackService.instance = new ParseFallbackService();
        }
        return ParseFallbackService.instance;
    }

    /**
     * Resets the singleton instance (useful for testing)
     */
    static resetInstance(): void {
        ParseFallbackService.instance = undefined;
    }

    // ========================================================================
    // Configuration
    // ========================================================================

    /**
     * Loads configuration from VS Code settings
     */
    private loadConfig(): ParseFallbackConfig {
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const fallbackMode = config.get<FallbackMode>(CONFIG_KEY_FALLBACK_MODE);
        
        // Validate fallback mode
        const validModes: FallbackMode[] = ['scanFile', 'skip', 'warn'];
        const mode = fallbackMode && validModes.includes(fallbackMode) 
            ? fallbackMode 
            : DEFAULT_FALLBACK_MODE;

        return {
            fallbackMode: mode
        };
    }

    /**
     * Reloads configuration from VS Code settings
     */
    reloadConfig(): void {
        this.config = this.loadConfig();
    }

    /**
     * Gets the current fallback mode
     */
    getFallbackMode(): FallbackMode {
        return this.config.fallbackMode;
    }

    // ========================================================================
    // Public Methods
    // ========================================================================

    /**
     * Handles a parse failure for a file.
     * 
     * Called from DiffAnalyzer when extractFunctions fails or from
     * FunctionScanner when scan fails.
     * 
     * @param filePath Path to the file that failed to parse
     * @param error The error that occurred during parsing
     * @returns FallbackResult indicating what action was taken
     */
    handleParseFail(filePath: string, error: Error): FallbackResult {
        // Reload config to get latest settings
        this.reloadConfig();
        
        const mode = this.config.fallbackMode;
        const errorMessage = error.message || 'Unknown parsing error';

        switch (mode) {
            case 'scanFile':
                this.logFallback(
                    filePath, 
                    errorMessage, 
                    'Treating entire file as single function for scanning'
                );
                // Note: functionInfo will be populated by the caller using createWholeFileFunctionInfo
                return {
                    action: 'scanFile',
                    logged: true
                };

            case 'skip':
            case 'warn':
            default:
                this.logFallback(
                    filePath, 
                    errorMessage, 
                    'Skipping file'
                );
                return {
                    action: 'skip',
                    logged: true
                };
        }
    }

    /**
     * Checks if the current configuration indicates whole file scanning on parse failure
     * @returns true if fallback mode is 'scanFile'
     */
    shouldScanWholeFile(): boolean {
        this.reloadConfig();
        return this.config.fallbackMode === 'scanFile';
    }

    /**
     * Checks if the current configuration indicates skipping files on parse failure
     * @returns true if fallback mode is 'skip' or 'warn'
     */
    shouldSkipFile(): boolean {
        this.reloadConfig();
        return this.config.fallbackMode === 'skip' || this.config.fallbackMode === 'warn';
    }

    /**
     * Creates a FunctionInfo representing the entire file content.
     * Used when fallback mode is 'scanFile' to treat the whole file as a single function.
     * 
     * @param filePath Path to the file
     * @param content The full content of the file
     * @returns FunctionInfo representing the whole file
     */
    createWholeFileFunctionInfo(filePath: string, content: string): FunctionInfo {
        const lines = content.split('\n');
        const lineCount = lines.length;
        
        // Extract filename for the function name
        const fileName = this.extractFileName(filePath);
        
        return {
            name: `[whole-file] ${fileName}`,
            code: content,
            filePath: filePath,
            startLine: 1,
            endLine: lineCount
        };
    }

    /**
     * Logs a fallback event to the GateLoggingService.
     * 
     * @param filePath Path to the file where fallback occurred
     * @param reason The reason for the fallback (e.g., error message)
     * @param action The action being taken (e.g., 'Skipping file', 'Scanning whole file')
     */
    logFallback(filePath: string, reason: string, action: string): void {
        const fileName = this.extractFileName(filePath);
        const mode = this.config.fallbackMode;
        
        this.logger.logWarning(
            `Parse fallback triggered for "${fileName}" [mode: ${mode}]`,
            LogContext.FunctionExtractor
        );
        this.logger.logDebug(
            `  Reason: ${reason}`,
            LogContext.FunctionExtractor
        );
        this.logger.logDebug(
            `  Action: ${action}`,
            LogContext.FunctionExtractor
        );
        this.logger.logDebug(
            `  Full path: ${filePath}`,
            LogContext.FunctionExtractor
        );
    }

    // ========================================================================
    // Private Helper Methods
    // ========================================================================

    /**
     * Extracts the filename from a file path
     */
    private extractFileName(filePath: string): string {
        const parts = filePath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || filePath;
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Gets the singleton instance of ParseFallbackService
 */
export function getParseFallbackService(): ParseFallbackService {
    return ParseFallbackService.getInstance();
}

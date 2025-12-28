import * as vscode from 'vscode';

/**
 * Action to take when limits are exceeded
 */
export type LimitAction = 'continue' | 'warn' | 'block';

/**
 * Result of checking limits against current counts
 */
export interface LimitCheckResult {
    /** Whether any limit was exceeded */
    exceeded: boolean;
    /** Human-readable reason if exceeded */
    reason?: string;
    /** Action to take based on fallbackMode policy */
    action: LimitAction;
    /** Details about which specific limits were exceeded */
    details?: {
        filesExceeded: boolean;
        functionsExceeded: boolean;
        filesCount: number;
        functionsCount: number;
        maxFiles: number;
        maxFunctions: number;
    };
}

/**
 * Configuration for gate limits
 */
export interface GateLimitsConfig {
    /** Maximum files to scan in a single gate run */
    maxFilesToScan: number;
    /** Maximum functions to scan in a single gate run */
    maxFunctionsToScan: number;
    /** Number of concurrent file scans */
    concurrentScans: number;
    /** Fallback mode from gate policy (determines action when limits exceeded) */
    fallbackMode: 'allow' | 'warn' | 'block';
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: GateLimitsConfig = {
    maxFilesToScan: 50,
    maxFunctionsToScan: 200,
    concurrentScans: 4,
    fallbackMode: 'warn'
};

/**
 * GateLimitsService
 * 
 * Provides timeout and concurrency controls for the security gate.
 * Prevents the gate from hanging on large repositories by enforcing
 * limits on files and functions to scan.
 * 
 * Configuration:
 * - devign.gate.maxFilesToScan: Maximum files to scan (default: 50, range: 1-500)
 * - devign.gate.maxFunctionsToScan: Maximum functions to scan (default: 200, range: 1-2000)
 * - devign.gate.concurrentScans: Number of concurrent file scans (default: 4, range: 1-10)
 * 
 * When limits are exceeded, the action taken depends on devign.gate.fallbackMode:
 * - 'allow': Continue scanning (action: 'continue') - logs warning but proceeds
 * - 'warn': Warn user but allow (action: 'warn') - shows warning, proceeds with truncated scan
 * - 'block': Block the operation (action: 'block') - stops the gate and blocks commit/push
 */
export class GateLimitsService {
    private config: GateLimitsConfig;

    constructor() {
        this.config = this.loadConfig();
    }

    /**
     * Load limits configuration from VS Code settings
     */
    private loadConfig(): GateLimitsConfig {
        const gateConfig = vscode.workspace.getConfiguration('devign.gate');
        
        return {
            maxFilesToScan: this.clampValue(
                gateConfig.get<number>('maxFilesToScan', DEFAULT_CONFIG.maxFilesToScan),
                1,
                500
            ),
            maxFunctionsToScan: this.clampValue(
                gateConfig.get<number>('maxFunctionsToScan', DEFAULT_CONFIG.maxFunctionsToScan),
                1,
                2000
            ),
            concurrentScans: this.clampValue(
                gateConfig.get<number>('concurrentScans', DEFAULT_CONFIG.concurrentScans),
                1,
                10
            ),
            fallbackMode: gateConfig.get<'allow' | 'warn' | 'block'>('fallbackMode', DEFAULT_CONFIG.fallbackMode)
        };
    }

    /**
     * Clamp a value between min and max
     */
    private clampValue(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Reload configuration from VS Code settings.
     * Call this when settings may have changed.
     */
    public reloadConfig(): void {
        this.config = this.loadConfig();
    }

    /**
     * Get the current limits configuration
     */
    public getConfig(): GateLimitsConfig {
        return { ...this.config };
    }

    /**
     * Check if the given counts exceed configured limits.
     * 
     * @param filesCount Number of files to be scanned
     * @param functionsCount Number of functions to be scanned
     * @returns LimitCheckResult with exceeded status, reason, and recommended action
     */
    public checkLimits(filesCount: number, functionsCount: number): LimitCheckResult {
        const filesExceeded = filesCount > this.config.maxFilesToScan;
        const functionsExceeded = functionsCount > this.config.maxFunctionsToScan;
        const exceeded = filesExceeded || functionsExceeded;

        if (!exceeded) {
            return {
                exceeded: false,
                action: 'continue'
            };
        }

        // Build reason message
        const reasons: string[] = [];
        if (filesExceeded) {
            reasons.push(`files (${filesCount}/${this.config.maxFilesToScan})`);
        }
        if (functionsExceeded) {
            reasons.push(`functions (${functionsCount}/${this.config.maxFunctionsToScan})`);
        }

        const reason = `Gate limits exceeded: ${reasons.join(', ')}`;
        const action = this.fallbackModeToAction(this.config.fallbackMode);

        return {
            exceeded: true,
            reason,
            action,
            details: {
                filesExceeded,
                functionsExceeded,
                filesCount,
                functionsCount,
                maxFiles: this.config.maxFilesToScan,
                maxFunctions: this.config.maxFunctionsToScan
            }
        };
    }

    /**
     * Check if files count exceeds the limit
     * 
     * @param filesCount Number of files to be scanned
     * @returns LimitCheckResult for files only
     */
    public checkFilesLimit(filesCount: number): LimitCheckResult {
        return this.checkLimits(filesCount, 0);
    }

    /**
     * Check if functions count exceeds the limit
     * 
     * @param functionsCount Number of functions to be scanned
     * @returns LimitCheckResult for functions only
     */
    public checkFunctionsLimit(functionsCount: number): LimitCheckResult {
        return this.checkLimits(0, functionsCount);
    }

    /**
     * Get the maximum number of files that should be scanned
     */
    public getMaxFiles(): number {
        return this.config.maxFilesToScan;
    }

    /**
     * Get the maximum number of functions that should be scanned
     */
    public getMaxFunctions(): number {
        return this.config.maxFunctionsToScan;
    }

    /**
     * Get the number of concurrent scans allowed
     */
    public getConcurrentScans(): number {
        return this.config.concurrentScans;
    }

    /**
     * Truncate a list of files to the maximum allowed
     * 
     * @param files Array of file paths
     * @returns Truncated array and whether truncation occurred
     */
    public truncateFiles<T>(files: T[]): { files: T[]; truncated: boolean; originalCount: number } {
        const originalCount = files.length;
        const truncated = originalCount > this.config.maxFilesToScan;
        
        return {
            files: truncated ? files.slice(0, this.config.maxFilesToScan) : files,
            truncated,
            originalCount
        };
    }

    /**
     * Truncate a list of functions to the maximum allowed
     * 
     * @param functions Array of functions
     * @returns Truncated array and whether truncation occurred
     */
    public truncateFunctions<T>(functions: T[]): { functions: T[]; truncated: boolean; originalCount: number } {
        const originalCount = functions.length;
        const truncated = originalCount > this.config.maxFunctionsToScan;
        
        return {
            functions: truncated ? functions.slice(0, this.config.maxFunctionsToScan) : functions,
            truncated,
            originalCount
        };
    }

    /**
     * Convert fallback mode to limit action
     */
    private fallbackModeToAction(mode: 'allow' | 'warn' | 'block'): LimitAction {
        switch (mode) {
            case 'allow':
                return 'continue';
            case 'warn':
                return 'warn';
            case 'block':
                return 'block';
        }
    }

    /**
     * Format a limit check result as a user-friendly message
     */
    public formatLimitMessage(result: LimitCheckResult): string {
        if (!result.exceeded) {
            return 'All limits within bounds';
        }

        const actionText = result.action === 'block' 
            ? 'Gate will be blocked'
            : result.action === 'warn'
                ? 'Proceeding with warning'
                : 'Continuing scan';

        return `${result.reason}. ${actionText}.`;
    }
}

// Singleton instance for convenience
let gateLimitsServiceInstance: GateLimitsService | undefined;

/**
 * Get the singleton GateLimitsService instance.
 * Creates a new instance if one doesn't exist.
 */
export function getGateLimitsService(): GateLimitsService {
    if (!gateLimitsServiceInstance) {
        gateLimitsServiceInstance = new GateLimitsService();
    }
    return gateLimitsServiceInstance;
}

/**
 * Reset the singleton instance.
 * Useful for testing or when configuration changes significantly.
 */
export function resetGateLimitsService(): void {
    gateLimitsServiceInstance = undefined;
}

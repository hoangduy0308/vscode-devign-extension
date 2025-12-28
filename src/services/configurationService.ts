import * as vscode from 'vscode';

/**
 * Scope of files to scan during gate operations
 */
export type GateScanScope = 'staged' | 'staged+unstaged';

/**
 * Risk levels for vulnerability findings
 */
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Fallback mode when scan fails or times out
 */
export type FallbackMode = 'allow' | 'warn' | 'block';

/**
 * Complete typed interface for all gate configuration settings
 * Maps to devign.gate.* settings in package.json
 */
export interface GateConfig {
    /** Enable git gate policy to block/warn on vulnerabilities */
    enabled: boolean;
    
    /** Run security gate before git commit */
    onCommit: boolean;
    
    /** Run security gate before git push */
    onPush: boolean;
    
    /** Which files to include in security gate scan */
    scope: GateScanScope;
    
    /** Risk levels that will block commit/push */
    blockOnRiskLevels: RiskLevel[];
    
    /** Vulnerability probability threshold for blocking (0.0 - 1.0) */
    blockThreshold: number;
    
    /** Vulnerability probability threshold for warnings (0.0 - 1.0) */
    warnThreshold: number;
    
    /** Maximum critical findings before blocking (-1 to disable) */
    maxCriticalFindings: number;
    
    /** Maximum high severity findings before blocking (-1 to disable) */
    maxHighFindings: number;
    
    /** Action when scan fails or times out */
    fallbackMode: FallbackMode;
    
    /** Gate scan timeout in seconds */
    timeoutSeconds: number;
    
    /** Glob patterns for files to skip during gate scanning */
    allowedFilePatterns: string[];
    
    /** Glob patterns to exclude from gate scanning */
    excludeGlobs: string[];
    
    /** Glob patterns to include in gate scanning */
    includeGlobs: string[];
    
    /** Maximum files to scan in a single gate run */
    maxFilesToScan: number;
    
    /** Maximum functions to scan in a single gate run */
    maxFunctionsToScan: number;
    
    /** Number of concurrent file scans during gate execution */
    concurrentScans: number;
}

/**
 * File patterns configuration for gate scanning
 */
export interface FilePatterns {
    /** Glob patterns to include in scanning */
    include: string[];
    
    /** Glob patterns to exclude from scanning */
    exclude: string[];
}

/**
 * Default configuration values matching package.json defaults
 */
const DEFAULT_GATE_CONFIG: GateConfig = {
    enabled: false,
    onCommit: true,
    onPush: false,
    scope: 'staged',
    blockOnRiskLevels: ['CRITICAL', 'HIGH'],
    blockThreshold: 0.8,
    warnThreshold: 0.5,
    maxCriticalFindings: 0,
    maxHighFindings: 3,
    fallbackMode: 'warn',
    timeoutSeconds: 120,
    allowedFilePatterns: [],
    excludeGlobs: ['**/third_party/**', '**/vendor/**', '**/node_modules/**', '**/*.min.*'],
    includeGlobs: ['**/*.c', '**/*.cpp', '**/*.h', '**/*.hpp'],
    maxFilesToScan: 50,
    maxFunctionsToScan: 200,
    concurrentScans: 4
};

/**
 * ConfigurationService
 * 
 * Centralized service for managing all Security Gate configuration.
 * Reads configuration from vscode.workspace.getConfiguration('devign')
 * and provides typed access to all gate settings.
 * 
 * Usage:
 * ```typescript
 * const configService = ConfigurationService.getInstance();
 * const gateConfig = configService.getGateConfig();
 * 
 * if (configService.isGateEnabled()) {
 *     const patterns = configService.getFilePatterns();
 *     // ... use configuration
 * }
 * ```
 */
export class ConfigurationService {
    private static instance: ConfigurationService | undefined;
    private cachedConfig: GateConfig | undefined;
    private disposables: vscode.Disposable[] = [];

    private constructor() {
        // Listen for configuration changes to invalidate cache
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('devign.gate')) {
                    this.invalidateCache();
                }
            })
        );
    }

    /**
     * Get the singleton instance of ConfigurationService
     */
    public static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    /**
     * Reset the singleton instance.
     * Useful for testing or when a fresh instance is needed.
     */
    public static resetInstance(): void {
        if (ConfigurationService.instance) {
            ConfigurationService.instance.dispose();
            ConfigurationService.instance = undefined;
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.cachedConfig = undefined;
    }

    /**
     * Invalidate the cached configuration.
     * Called automatically when configuration changes.
     */
    public invalidateCache(): void {
        this.cachedConfig = undefined;
    }

    /**
     * Get the complete gate configuration with all typed properties.
     * Configuration is cached and automatically invalidated when settings change.
     * 
     * @returns Complete GateConfig object with all settings
     */
    public getGateConfig(): GateConfig {
        if (this.cachedConfig) {
            return { ...this.cachedConfig };
        }

        const config = vscode.workspace.getConfiguration('devign.gate');

        this.cachedConfig = {
            enabled: config.get<boolean>('enabled') ?? DEFAULT_GATE_CONFIG.enabled,
            onCommit: config.get<boolean>('onCommit') ?? DEFAULT_GATE_CONFIG.onCommit,
            onPush: config.get<boolean>('onPush') ?? DEFAULT_GATE_CONFIG.onPush,
            scope: config.get<GateScanScope>('scope') ?? DEFAULT_GATE_CONFIG.scope,
            blockOnRiskLevels: config.get<RiskLevel[]>('blockOnRiskLevels') ?? DEFAULT_GATE_CONFIG.blockOnRiskLevels,
            blockThreshold: this.clampValue(
                config.get<number>('blockThreshold') ?? DEFAULT_GATE_CONFIG.blockThreshold,
                0,
                1
            ),
            warnThreshold: this.clampValue(
                config.get<number>('warnThreshold') ?? DEFAULT_GATE_CONFIG.warnThreshold,
                0,
                1
            ),
            maxCriticalFindings: config.get<number>('maxCriticalFindings') ?? DEFAULT_GATE_CONFIG.maxCriticalFindings,
            maxHighFindings: config.get<number>('maxHighFindings') ?? DEFAULT_GATE_CONFIG.maxHighFindings,
            fallbackMode: config.get<FallbackMode>('fallbackMode') ?? DEFAULT_GATE_CONFIG.fallbackMode,
            timeoutSeconds: this.clampValue(
                config.get<number>('timeoutSeconds') ?? DEFAULT_GATE_CONFIG.timeoutSeconds,
                10,
                600
            ),
            allowedFilePatterns: config.get<string[]>('allowedFilePatterns') ?? DEFAULT_GATE_CONFIG.allowedFilePatterns,
            excludeGlobs: config.get<string[]>('excludeGlobs') ?? DEFAULT_GATE_CONFIG.excludeGlobs,
            includeGlobs: config.get<string[]>('includeGlobs') ?? DEFAULT_GATE_CONFIG.includeGlobs,
            maxFilesToScan: this.clampValue(
                config.get<number>('maxFilesToScan') ?? DEFAULT_GATE_CONFIG.maxFilesToScan,
                1,
                500
            ),
            maxFunctionsToScan: this.clampValue(
                config.get<number>('maxFunctionsToScan') ?? DEFAULT_GATE_CONFIG.maxFunctionsToScan,
                1,
                2000
            ),
            concurrentScans: this.clampValue(
                config.get<number>('concurrentScans') ?? DEFAULT_GATE_CONFIG.concurrentScans,
                1,
                10
            )
        };

        return { ...this.cachedConfig };
    }

    /**
     * Check if the security gate is enabled.
     * 
     * @returns true if gate.enabled is true
     */
    public isGateEnabled(): boolean {
        const config = this.getGateConfig();
        return config.enabled;
    }

    /**
     * Check if a given risk level should block the gate.
     * 
     * @param level The risk level to check (case-insensitive)
     * @returns true if the risk level is in blockOnRiskLevels
     */
    public shouldBlockOnRiskLevel(level: string): boolean {
        const config = this.getGateConfig();
        const normalizedLevel = level.toUpperCase() as RiskLevel;
        return config.blockOnRiskLevels.includes(normalizedLevel);
    }

    /**
     * Get the file patterns for gate scanning.
     * Combines includeGlobs and excludeGlobs into a single object.
     * 
     * @returns FilePatterns object with include and exclude arrays
     */
    public getFilePatterns(): FilePatterns {
        const config = this.getGateConfig();
        return {
            include: [...config.includeGlobs],
            exclude: [...config.excludeGlobs]
        };
    }

    /**
     * Check if the gate should run on commit.
     * 
     * @returns true if gate is enabled and onCommit is true
     */
    public shouldRunOnCommit(): boolean {
        const config = this.getGateConfig();
        return config.enabled && config.onCommit;
    }

    /**
     * Check if the gate should run on push.
     * 
     * @returns true if gate is enabled and onPush is true
     */
    public shouldRunOnPush(): boolean {
        const config = this.getGateConfig();
        return config.enabled && config.onPush;
    }

    /**
     * Get the scan scope (staged only or staged+unstaged).
     * 
     * @returns The configured scan scope
     */
    public getScanScope(): GateScanScope {
        const config = this.getGateConfig();
        return config.scope;
    }

    /**
     * Get the timeout in milliseconds.
     * 
     * @returns Timeout in milliseconds
     */
    public getTimeoutMs(): number {
        const config = this.getGateConfig();
        return config.timeoutSeconds * 1000;
    }

    /**
     * Get the default configuration values.
     * Useful for resetting or comparing against current config.
     * 
     * @returns Default GateConfig object
     */
    public getDefaultConfig(): GateConfig {
        return { ...DEFAULT_GATE_CONFIG };
    }

    /**
     * Clamp a value between min and max bounds.
     * 
     * @param value The value to clamp
     * @param min Minimum allowed value
     * @param max Maximum allowed value
     * @returns Clamped value
     */
    private clampValue(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}

// Convenience function for getting the singleton instance
export function getConfigurationService(): ConfigurationService {
    return ConfigurationService.getInstance();
}

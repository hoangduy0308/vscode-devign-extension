/**
 * Hybrid Severity Service
 * 
 * Combines regex-based dangerous API detection with Devign ML model results
 * to provide more accurate severity assessments for C/C++ code vulnerabilities.
 * 
 * Logic:
 * - Dangerous API + Devign vulnerable → CRITICAL or HIGH (based on probability)
 * - Only dangerous API (no Devign flag) → MEDIUM (warning)
 * - Only Devign flags (no dangerous API) → severity based on probability
 * - Neither → LOW or PASS
 */

/**
 * Severity levels for hybrid analysis results
 */
export type HybridSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Result of hybrid severity calculation
 */
export interface HybridSeverityResult {
    /** Calculated severity level */
    severity: HybridSeverity;
    /** Confidence score (0-1) */
    confidence: number;
    /** Human-readable reasons for the severity assignment */
    reasons: string[];
    /** List of dangerous APIs found in the code */
    dangerousApis: string[];
}

/**
 * Categories of dangerous C/C++ APIs
 */
export interface DangerousApiCategory {
    name: string;
    description: string;
    apis: string[];
}

/**
 * Dangerous C/C++ APIs organized by category.
 * These are functions known to be prone to security vulnerabilities
 * such as buffer overflows, format string attacks, and memory corruption.
 */
export const DANGEROUS_API_CATEGORIES: DangerousApiCategory[] = [
    {
        name: 'Memory Management',
        description: 'Functions that can lead to memory corruption, use-after-free, or double-free vulnerabilities',
        apis: ['malloc', 'free', 'realloc', 'calloc', 'alloca']
    },
    {
        name: 'Unsafe String Copy',
        description: 'String copy functions without bounds checking - prone to buffer overflows',
        apis: ['strcpy', 'strcat', 'wcscpy', 'wcscat', 'lstrcpy', 'lstrcpyA', 'lstrcpyW', 'lstrcat', 'lstrcatA', 'lstrcatW']
    },
    {
        name: 'Bounded String Copy (Still Risky)',
        description: 'Bounded string functions that can still be misused',
        apis: ['strncpy', 'strncat', 'wcsncpy', 'wcsncat']
    },
    {
        name: 'Format String',
        description: 'Functions vulnerable to format string attacks when user input is passed directly',
        apis: ['sprintf', 'vsprintf', 'printf', 'fprintf', 'vprintf', 'vfprintf', 'swprintf', 'vswprintf', 'wprintf', 'fwprintf']
    },
    {
        name: 'Unsafe Input',
        description: 'Input functions that do not limit input size - extremely dangerous',
        apis: ['gets', 'scanf', 'fscanf', 'sscanf', 'vscanf', 'vfscanf', 'vsscanf', 'wscanf', 'fwscanf', 'swscanf']
    },
    {
        name: 'Memory Operations',
        description: 'Memory manipulation functions that can cause buffer overflows if sizes are incorrect',
        apis: ['memcpy', 'memmove', 'memset', 'wmemcpy', 'wmemmove', 'wmemset', 'bcopy', 'bzero']
    },
    {
        name: 'Exec Functions',
        description: 'Command execution functions - dangerous with user-controlled input',
        apis: ['system', 'popen', 'exec', 'execl', 'execle', 'execlp', 'execv', 'execve', 'execvp', 'execvpe', 'ShellExecute', 'ShellExecuteA', 'ShellExecuteW', 'WinExec', 'CreateProcess', 'CreateProcessA', 'CreateProcessW']
    },
    {
        name: 'File Operations',
        description: 'File operations that can be exploited for path traversal or race conditions',
        apis: ['fopen', 'freopen', 'open', 'creat', 'access', 'chmod', 'chown', 'mktemp', 'tmpnam', 'tempnam']
    },
    {
        name: 'Network',
        description: 'Network functions that may be vulnerable to various attacks',
        apis: ['recv', 'recvfrom', 'recvmsg', 'read', 'readv', 'pread']
    },
    {
        name: 'Deprecated/Banned',
        description: 'Functions that are deprecated or banned in secure coding standards',
        apis: ['getwd', 'realpath', 'getpass', 'crypt', 'getlogin', 'cuserid']
    }
];

/**
 * Flattened list of all dangerous APIs for quick lookup
 */
export const ALL_DANGEROUS_APIS: string[] = DANGEROUS_API_CATEGORIES.flatMap(cat => cat.apis);

/**
 * Set for O(1) lookup of dangerous APIs
 */
const DANGEROUS_API_SET: Set<string> = new Set(ALL_DANGEROUS_APIS);

/**
 * Regex pattern to match function calls in C/C++ code.
 * Matches: functionName( or functionName (
 * Uses word boundaries to avoid partial matches.
 */
function createApiDetectionRegex(apis: string[]): RegExp {
    // API names are simple identifiers (alphanumeric), no special regex chars to escape
    // Match function name followed by optional whitespace and opening parenthesis
    // Use word boundary to avoid matching substrings (e.g., 'malloc' shouldn't match 'xmalloc')
    const pattern = '\\b(' + apis.join('|') + ')\\s*\\(';
    return new RegExp(pattern, 'g');
}

/**
 * Cached regex for detecting all dangerous APIs
 */
const DANGEROUS_API_REGEX = createApiDetectionRegex(ALL_DANGEROUS_APIS);

/**
 * Service for calculating hybrid severity based on dangerous API presence and Devign results
 */
export class HybridSeverityService {
    /**
     * Detects dangerous APIs present in the given code
     * @param code - C/C++ source code to analyze
     * @returns Array of unique dangerous API names found in the code
     */
    detectDangerousApis(code: string): string[] {
        // Reset regex lastIndex for fresh search
        DANGEROUS_API_REGEX.lastIndex = 0;
        
        const foundApis = new Set<string>();
        let match: RegExpExecArray | null;
        
        while ((match = DANGEROUS_API_REGEX.exec(code)) !== null) {
            const apiName = match[1];
            if (DANGEROUS_API_SET.has(apiName)) {
                foundApis.add(apiName);
            }
        }
        
        return Array.from(foundApis).sort();
    }

    /**
     * Quick check if code contains any dangerous APIs
     * @param code - C/C++ source code to analyze
     * @returns true if any dangerous API is found
     */
    hasDangerousApis(code: string): boolean {
        // Reset regex lastIndex for fresh search
        DANGEROUS_API_REGEX.lastIndex = 0;
        return DANGEROUS_API_REGEX.test(code);
    }

    /**
     * Calculates hybrid severity combining dangerous API detection with Devign results
     * 
     * @param functionCode - The C/C++ function code to analyze
     * @param devignProbability - Probability from Devign model (0-1)
     * @param devignVulnerable - Whether Devign flagged this as vulnerable
     * @returns HybridSeverityResult with severity, confidence, reasons, and found APIs
     */
    calculateHybridSeverity(
        functionCode: string,
        devignProbability: number,
        devignVulnerable: boolean
    ): HybridSeverityResult {
        const dangerousApis = this.detectDangerousApis(functionCode);
        const hasDangerousApi = dangerousApis.length > 0;
        const reasons: string[] = [];

        // Case 1: Both dangerous API and Devign flags vulnerable
        if (hasDangerousApi && devignVulnerable) {
            const severity = this.getSeverityFromProbability(devignProbability, true);
            const confidence = this.calculateConfidence(devignProbability, hasDangerousApi, devignVulnerable);
            
            reasons.push('Dangerous API(s) detected: ' + dangerousApis.join(', '));
            reasons.push('Devign model flagged as vulnerable with ' + (devignProbability * 100).toFixed(1) + '% probability');
            reasons.push('High confidence: Both static analysis and ML model agree on potential vulnerability');
            
            return {
                severity,
                confidence,
                reasons,
                dangerousApis
            };
        }

        // Case 2: Only dangerous API present (no Devign flag)
        if (hasDangerousApi && !devignVulnerable) {
            const confidence = this.calculateConfidence(devignProbability, hasDangerousApi, devignVulnerable);
            
            reasons.push('Dangerous API(s) detected: ' + dangerousApis.join(', '));
            reasons.push('Devign model did not flag as vulnerable');
            reasons.push('Medium severity: Dangerous APIs present but ML model suggests safe usage pattern');
            
            return {
                severity: 'MEDIUM',
                confidence,
                reasons,
                dangerousApis
            };
        }

        // Case 3: Only Devign flags (no dangerous API)
        if (!hasDangerousApi && devignVulnerable) {
            const severity = this.getSeverityFromProbabilityOnly(devignProbability);
            const confidence = this.calculateConfidence(devignProbability, hasDangerousApi, devignVulnerable);
            
            reasons.push('No known dangerous APIs detected');
            reasons.push('Devign model flagged as vulnerable with ' + (devignProbability * 100).toFixed(1) + '% probability');
            reasons.push('Severity based on Devign confidence: ' + severity);
            
            return {
                severity,
                confidence,
                reasons,
                dangerousApis
            };
        }

        // Case 4: Neither dangerous API nor Devign flag
        const confidence = 1 - devignProbability; // Higher confidence when probability is low
        
        reasons.push('No known dangerous APIs detected');
        reasons.push('Devign model did not flag as vulnerable');
        reasons.push('Low risk: No indicators of vulnerability found');
        
        return {
            severity: 'LOW',
            confidence,
            reasons,
            dangerousApis
        };
    }

    /**
     * Gets severity when both dangerous API and Devign agree on vulnerability
     */
    private getSeverityFromProbability(probability: number, hasDangerousApi: boolean): HybridSeverity {
        if (probability >= 0.8) {
            return 'CRITICAL';
        }
        if (probability >= 0.6 || hasDangerousApi) {
            return 'HIGH';
        }
        return 'HIGH'; // Default to HIGH when both indicators present
    }

    /**
     * Gets severity based only on Devign probability (no dangerous API)
     */
    private getSeverityFromProbabilityOnly(probability: number): HybridSeverity {
        if (probability >= 0.8) {
            return 'HIGH';
        }
        if (probability >= 0.6) {
            return 'MEDIUM';
        }
        return 'LOW';
    }

    /**
     * Calculates confidence score based on agreement between indicators
     */
    private calculateConfidence(
        devignProbability: number,
        hasDangerousApi: boolean,
        devignVulnerable: boolean
    ): number {
        // Both agree on vulnerability - highest confidence
        if (hasDangerousApi && devignVulnerable) {
            // Base confidence from Devign, boosted by API presence
            return Math.min(0.95, devignProbability + 0.15);
        }

        // Only dangerous API - moderate confidence
        if (hasDangerousApi && !devignVulnerable) {
            // Lower confidence since ML model disagrees
            return 0.5;
        }

        // Only Devign - confidence based on probability
        if (!hasDangerousApi && devignVulnerable) {
            // Slightly reduced confidence without API confirmation
            return devignProbability * 0.9;
        }

        // Neither - high confidence in safety
        return Math.max(0.7, 1 - devignProbability);
    }

    /**
     * Gets the category information for a dangerous API
     * @param apiName - Name of the API to look up
     * @returns Category information or undefined if not found
     */
    getApiCategory(apiName: string): DangerousApiCategory | undefined {
        return DANGEROUS_API_CATEGORIES.find(cat => cat.apis.includes(apiName));
    }

    /**
     * Gets detailed information about all dangerous APIs found in code
     * @param code - C/C++ source code to analyze
     * @returns Map of API names to their categories
     */
    getDetailedApiInfo(code: string): Map<string, DangerousApiCategory> {
        const apis = this.detectDangerousApis(code);
        const result = new Map<string, DangerousApiCategory>();
        
        for (const api of apis) {
            const category = this.getApiCategory(api);
            if (category) {
                result.set(api, category);
            }
        }
        
        return result;
    }

    /**
     * Gets all dangerous API categories
     */
    getAllCategories(): DangerousApiCategory[] {
        return DANGEROUS_API_CATEGORIES;
    }

    /**
     * Gets all dangerous APIs as a flat list
     */
    getAllDangerousApis(): string[] {
        return ALL_DANGEROUS_APIS;
    }
}

/**
 * Singleton instance for convenience
 */
let hybridSeverityServiceInstance: HybridSeverityService | null = null;

/**
 * Gets the singleton instance of HybridSeverityService
 */
export function getHybridSeverityService(): HybridSeverityService {
    if (!hybridSeverityServiceInstance) {
        hybridSeverityServiceInstance = new HybridSeverityService();
    }
    return hybridSeverityServiceInstance;
}

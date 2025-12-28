/**
 * Gate Error Taxonomy
 * 
 * Defines error codes, error classes, and action buttons for user-friendly
 * error handling in the Devign security gate system.
 * 
 * Error categories:
 * - SCANNER_MISSING: Python scanner script not found
 * - PYTHON_MISCONFIG: Python interpreter issues (not found, wrong version, missing packages)
 * - TIMEOUT: Scan operation timed out
 * - PARSE_FAIL: Failed to parse scanner output or source code
 * - GIT_API_FAIL: Git extension or repository issues
 * - UNKNOWN: Unclassified errors
 */

/**
 * Error codes for categorizing gate errors
 */
export enum GateErrorCode {
    /** Python scanner script not found or inaccessible */
    SCANNER_MISSING = 'SCANNER_MISSING',
    
    /** Python interpreter misconfiguration (not found, wrong version, missing packages) */
    PYTHON_MISCONFIG = 'PYTHON_MISCONFIG',
    
    /** Scan operation timed out */
    TIMEOUT = 'TIMEOUT',
    
    /** Failed to parse scanner output or source code */
    PARSE_FAIL = 'PARSE_FAIL',
    
    /** Git extension or repository operation failed */
    GIT_API_FAIL = 'GIT_API_FAIL',
    
    /** Unclassified or unknown error */
    UNKNOWN = 'UNKNOWN'
}

/**
 * Action button definition for error messages
 */
export interface ErrorAction {
    /** Button label displayed to user */
    label: string;
    
    /** VS Code command to execute when clicked */
    command: string;
    
    /** Optional arguments to pass to the command */
    args?: unknown[];
}

/**
 * Predefined action buttons for common error recovery actions
 */
export const ErrorActions = {
    /** Opens the Devign output channel for detailed logs */
    OPEN_OUTPUT: {
        label: 'Open Output',
        command: 'devign.openOutput'
    } as ErrorAction,
    
    /** Opens Python configuration dialog */
    CONFIGURE_PYTHON: {
        label: 'Configure Python',
        command: 'devign.configurePython'
    } as ErrorAction,
    
    /** Runs the doctor command to diagnose issues */
    RUN_DOCTOR: {
        label: 'Run Doctor',
        command: 'devign.doctor'
    } as ErrorAction,
    
    /** Downloads required model files */
    DOWNLOAD_MODELS: {
        label: 'Download Models',
        command: 'devign.downloadModels'
    } as ErrorAction,
    
    /** Installs required Python dependencies */
    INSTALL_DEPENDENCIES: {
        label: 'Install Dependencies',
        command: 'devign.installDependencies'
    } as ErrorAction,
    
    /** Clears cache and re-downloads models */
    CLEAR_CACHE: {
        label: 'Clear Cache & Update',
        command: 'devign.clearCacheAndUpdate'
    } as ErrorAction,
    
    /** Opens VS Code settings */
    OPEN_SETTINGS: {
        label: 'Open Settings',
        command: 'workbench.action.openSettings',
        args: ['devign']
    } as ErrorAction,
    
    /** Focuses the Problems panel */
    SHOW_PROBLEMS: {
        label: 'Show Problems',
        command: 'workbench.action.problems.focus'
    } as ErrorAction
} as const;

/**
 * Custom error class for gate-related errors with user-friendly messaging
 * and actionable recovery options.
 */
export class GateError extends Error {
    /** Error category code */
    public readonly code: GateErrorCode;
    
    /** User-friendly error message */
    public readonly userMessage: string;
    
    /** Available recovery actions */
    public readonly actions: ErrorAction[];
    
    /** Original error that caused this gate error */
    public readonly originalError?: Error;
    
    /** Timestamp when the error occurred */
    public readonly timestamp: Date;
    
    /** Additional context for debugging */
    public readonly context?: Record<string, unknown>;

    constructor(options: {
        code: GateErrorCode;
        message: string;
        userMessage: string;
        actions?: ErrorAction[];
        originalError?: Error;
        context?: Record<string, unknown>;
    }) {
        super(options.message);
        this.name = 'GateError';
        this.code = options.code;
        this.userMessage = options.userMessage;
        this.actions = options.actions || [];
        this.originalError = options.originalError;
        this.timestamp = new Date();
        this.context = options.context;

        // Maintain proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, GateError);
        }
    }

    /**
     * Creates a string representation of the error for logging
     */
    public toLogString(): string {
        const parts = [
            `[${this.code}] ${this.message}`,
            `User Message: ${this.userMessage}`,
            `Timestamp: ${this.timestamp.toISOString()}`
        ];

        if (this.context) {
            parts.push(`Context: ${JSON.stringify(this.context)}`);
        }

        if (this.originalError) {
            parts.push(`Original Error: ${this.originalError.message}`);
            if (this.originalError.stack) {
                parts.push(`Original Stack: ${this.originalError.stack}`);
            }
        }

        return parts.join('\n');
    }

    /**
     * Checks if this error is recoverable (has actions)
     */
    public isRecoverable(): boolean {
        return this.actions.length > 0;
    }

    /**
     * Gets the primary recovery action (first action)
     */
    public getPrimaryAction(): ErrorAction | undefined {
        return this.actions[0];
    }
}

/**
 * Factory functions for creating common gate errors
 */
export const GateErrors = {
    /**
     * Creates a scanner missing error
     */
    scannerMissing(scriptPath: string, originalError?: Error): GateError {
        return new GateError({
            code: GateErrorCode.SCANNER_MISSING,
            message: `Scanner script not found at: ${scriptPath}`,
            userMessage: 'The vulnerability scanner is not installed or cannot be found. Please run the doctor command to diagnose the issue.',
            actions: [
                ErrorActions.RUN_DOCTOR,
                ErrorActions.DOWNLOAD_MODELS,
                ErrorActions.OPEN_OUTPUT
            ],
            originalError,
            context: { scriptPath }
        });
    },

    /**
     * Creates a Python not found error
     */
    pythonNotFound(pythonPath: string, originalError?: Error): GateError {
        return new GateError({
            code: GateErrorCode.PYTHON_MISCONFIG,
            message: `Python not found at: ${pythonPath}`,
            userMessage: 'Python interpreter not found. Please configure the correct Python path or install Python.',
            actions: [
                ErrorActions.CONFIGURE_PYTHON,
                ErrorActions.RUN_DOCTOR,
                ErrorActions.OPEN_OUTPUT
            ],
            originalError,
            context: { pythonPath }
        });
    },

    /**
     * Creates a Python package missing error
     */
    pythonPackageMissing(packages: string[], originalError?: Error): GateError {
        const packageList = packages.join(', ');
        return new GateError({
            code: GateErrorCode.PYTHON_MISCONFIG,
            message: `Required Python packages missing: ${packageList}`,
            userMessage: `Missing required packages: ${packageList}. Click "Install Dependencies" to install them automatically.`,
            actions: [
                ErrorActions.INSTALL_DEPENDENCIES,
                ErrorActions.RUN_DOCTOR,
                ErrorActions.OPEN_OUTPUT
            ],
            originalError,
            context: { missingPackages: packages }
        });
    },

    /**
     * Creates a Python version error
     */
    pythonVersionError(requiredVersion: string, actualVersion: string, originalError?: Error): GateError {
        return new GateError({
            code: GateErrorCode.PYTHON_MISCONFIG,
            message: `Python version ${actualVersion} does not meet requirement ${requiredVersion}`,
            userMessage: `Python ${requiredVersion} or higher is required. Current version: ${actualVersion}. Please update Python or configure a different interpreter.`,
            actions: [
                ErrorActions.CONFIGURE_PYTHON,
                ErrorActions.RUN_DOCTOR,
                ErrorActions.OPEN_OUTPUT
            ],
            originalError,
            context: { requiredVersion, actualVersion }
        });
    },

    /**
     * Creates a general Python misconfiguration error
     */
    pythonMisconfig(details: string, originalError?: Error): GateError {
        return new GateError({
            code: GateErrorCode.PYTHON_MISCONFIG,
            message: `Python misconfiguration: ${details}`,
            userMessage: 'There is a problem with the Python configuration. Run the doctor command to diagnose the issue.',
            actions: [
                ErrorActions.RUN_DOCTOR,
                ErrorActions.CONFIGURE_PYTHON,
                ErrorActions.OPEN_OUTPUT
            ],
            originalError,
            context: { details }
        });
    },

    /**
     * Creates a timeout error
     */
    timeout(operation: string, timeoutMs: number, originalError?: Error): GateError {
        const timeoutSec = Math.round(timeoutMs / 1000);
        return new GateError({
            code: GateErrorCode.TIMEOUT,
            message: `Operation "${operation}" timed out after ${timeoutSec}s`,
            userMessage: `The scan timed out after ${timeoutSec} seconds. This may happen with large files or slow systems. Try increasing the timeout in settings or scanning fewer files.`,
            actions: [
                ErrorActions.OPEN_SETTINGS,
                ErrorActions.OPEN_OUTPUT
            ],
            originalError,
            context: { operation, timeoutMs }
        });
    },

    /**
     * Creates a parse failure error for scanner output
     */
    parseFailOutput(output: string, originalError?: Error): GateError {
        // Truncate output for context
        const truncatedOutput = output.length > 200 
            ? output.substring(0, 200) + '...' 
            : output;
        
        return new GateError({
            code: GateErrorCode.PARSE_FAIL,
            message: `Failed to parse scanner output`,
            userMessage: 'The scanner returned invalid output. This may indicate a scanner bug or incompatible version. Check the output log for details.',
            actions: [
                ErrorActions.OPEN_OUTPUT,
                ErrorActions.CLEAR_CACHE,
                ErrorActions.RUN_DOCTOR
            ],
            originalError,
            context: { outputPreview: truncatedOutput }
        });
    },

    /**
     * Creates a parse failure error for source code
     */
    parseFailSource(filePath: string, originalError?: Error): GateError {
        return new GateError({
            code: GateErrorCode.PARSE_FAIL,
            message: `Failed to parse source file: ${filePath}`,
            userMessage: 'Failed to parse the source file. The file may contain syntax errors or unsupported constructs.',
            actions: [
                ErrorActions.SHOW_PROBLEMS,
                ErrorActions.OPEN_OUTPUT
            ],
            originalError,
            context: { filePath }
        });
    },

    /**
     * Creates a Git extension not available error
     */
    gitExtensionNotAvailable(originalError?: Error): GateError {
        return new GateError({
            code: GateErrorCode.GIT_API_FAIL,
            message: 'Git extension not available',
            userMessage: 'The VS Code Git extension is not installed or disabled. Please enable the Git extension to use security gate features.',
            actions: [
                ErrorActions.OPEN_OUTPUT
            ],
            originalError
        });
    },

    /**
     * Creates a Git repository not found error
     */
    gitRepositoryNotFound(originalError?: Error): GateError {
        return new GateError({
            code: GateErrorCode.GIT_API_FAIL,
            message: 'No Git repository found in workspace',
            userMessage: 'No Git repository found. Please open a folder that contains a Git repository to use security gate features.',
            actions: [
                ErrorActions.OPEN_OUTPUT
            ],
            originalError
        });
    },

    /**
     * Creates a Git operation failed error
     */
    gitOperationFailed(operation: string, details: string, originalError?: Error): GateError {
        return new GateError({
            code: GateErrorCode.GIT_API_FAIL,
            message: `Git operation "${operation}" failed: ${details}`,
            userMessage: `Git operation failed: ${details}. Please check your Git configuration and try again.`,
            actions: [
                ErrorActions.OPEN_OUTPUT
            ],
            originalError,
            context: { operation, details }
        });
    },

    /**
     * Creates a model files missing error
     */
    modelsMissing(modelPath: string, originalError?: Error): GateError {
        return new GateError({
            code: GateErrorCode.SCANNER_MISSING,
            message: `Model files not found at: ${modelPath}`,
            userMessage: 'The vulnerability detection models are not downloaded. Click "Download Models" to download them automatically.',
            actions: [
                ErrorActions.DOWNLOAD_MODELS,
                ErrorActions.CLEAR_CACHE,
                ErrorActions.OPEN_OUTPUT
            ],
            originalError,
            context: { modelPath }
        });
    },

    /**
     * Creates an unknown/generic error
     */
    unknown(message: string, originalError?: Error): GateError {
        return new GateError({
            code: GateErrorCode.UNKNOWN,
            message: message,
            userMessage: 'An unexpected error occurred. Check the output log for details and try running the doctor command.',
            actions: [
                ErrorActions.OPEN_OUTPUT,
                ErrorActions.RUN_DOCTOR
            ],
            originalError
        });
    }
};

/**
 * Type guard to check if an error is a GateError
 */
export function isGateError(error: unknown): error is GateError {
    return error instanceof GateError;
}

/**
 * Wraps any error as a GateError if it isn't already
 */
export function ensureGateError(error: unknown): GateError {
    if (isGateError(error)) {
        return error;
    }

    if (error instanceof Error) {
        return GateErrors.unknown(error.message, error);
    }

    return GateErrors.unknown(String(error));
}

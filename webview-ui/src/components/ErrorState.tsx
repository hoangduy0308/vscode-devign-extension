import React from 'react';

export type ErrorType = 
  | 'scan-failed'
  | 'engine-missing'
  | 'no-workspace'
  | 'permission-denied'
  | 'network'
  | 'timeout';

interface ErrorStateProps {
  type: ErrorType;
  message?: string;
  onRetry?: () => void;
  onOpenSettings?: () => void;
  onDismiss?: () => void;
}

interface ErrorConfig {
  icon: string;
  title: string;
  description: string;
  primaryAction: {
    label: string;
    action: 'retry' | 'settings';
  };
  secondaryAction?: {
    label: string;
    action: 'dismiss' | 'settings' | 'retry';
  };
}

const errorConfigs: Record<ErrorType, ErrorConfig> = {
  'scan-failed': {
    icon: 'codicon-error',
    title: 'Scan Failed',
    description: 'The vulnerability scan encountered an error and could not complete.',
    primaryAction: { label: 'Retry Scan', action: 'retry' },
    secondaryAction: { label: 'View Settings', action: 'settings' }
  },
  'engine-missing': {
    icon: 'codicon-warning',
    title: 'Analysis Engine Not Found',
    description: 'The ONNX inference engine is not available. Please check your installation.',
    primaryAction: { label: 'Open Settings', action: 'settings' },
    secondaryAction: { label: 'Retry', action: 'retry' }
  },
  'no-workspace': {
    icon: 'codicon-folder',
    title: 'No Workspace Open',
    description: 'Please open a folder or workspace to scan for vulnerabilities.',
    primaryAction: { label: 'Open Folder', action: 'settings' }
  },
  'permission-denied': {
    icon: 'codicon-lock',
    title: 'Permission Denied',
    description: 'Unable to access one or more files. Check file permissions and try again.',
    primaryAction: { label: 'Retry', action: 'retry' },
    secondaryAction: { label: 'View Settings', action: 'settings' }
  },
  'network': {
    icon: 'codicon-cloud-offline',
    title: 'Network Error',
    description: 'Unable to connect to the required services. Check your network connection.',
    primaryAction: { label: 'Retry', action: 'retry' }
  },
  'timeout': {
    icon: 'codicon-watch',
    title: 'Operation Timed Out',
    description: 'The scan took too long to complete. Try scanning fewer files or increase the timeout.',
    primaryAction: { label: 'Retry', action: 'retry' },
    secondaryAction: { label: 'View Settings', action: 'settings' }
  }
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  type,
  message,
  onRetry,
  onOpenSettings,
  onDismiss
}) => {
  const config = errorConfigs[type];

  const handlePrimaryAction = () => {
    if (config.primaryAction.action === 'retry') {
      onRetry?.();
    } else {
      onOpenSettings?.();
    }
  };

  const handleSecondaryAction = () => {
    if (!config.secondaryAction) return;
    
    if (config.secondaryAction.action === 'dismiss') {
      onDismiss?.();
    } else if (config.secondaryAction.action === 'settings') {
      onOpenSettings?.();
    } else {
      onRetry?.();
    }
  };

  return (
    <div 
      className="flex flex-col items-center justify-center p-[var(--space-8)] text-center"
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div 
        className="w-16 h-16 rounded-full flex items-center justify-center mb-[var(--space-4)]"
        style={{
          background: 'var(--severity-critical-bg)',
          border: '1px solid var(--severity-critical-border)'
        }}
      >
        <span 
          className={`codicon ${config.icon}`}
          style={{ 
            color: 'var(--severity-critical-icon)',
            fontSize: 'var(--font-size-3xl)'
          }}
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <h3 
        className="font-semibold mb-[var(--space-2)]"
        style={{ 
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)'
        }}
      >
        {config.title}
      </h3>

      {/* Description */}
      <p 
        className="mb-[var(--space-4)] max-w-md"
        style={{ 
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
          lineHeight: 'var(--line-height-base)'
        }}
      >
        {message || config.description}
      </p>

      {/* Actions */}
      <div className="flex gap-[var(--space-3)]">
        <button
          onClick={handlePrimaryAction}
          className="px-[var(--space-4)] py-[var(--space-2)] rounded text-sm font-medium flex items-center gap-[var(--space-2)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
          style={{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            borderRadius: 'var(--radius-md)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'var(--vscode-button-hoverBackground)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'var(--vscode-button-background)';
          }}
        >
          <span 
            className={`codicon ${config.primaryAction.action === 'retry' ? 'codicon-refresh' : 'codicon-settings-gear'}`} 
            aria-hidden="true" 
          />
          {config.primaryAction.label}
        </button>

        {config.secondaryAction && (
          <button
            onClick={handleSecondaryAction}
            className="px-[var(--space-4)] py-[var(--space-2)] rounded text-sm font-medium flex items-center gap-[var(--space-2)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              borderRadius: 'var(--radius-md)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--vscode-button-secondaryHoverBackground)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--vscode-button-secondaryBackground)';
            }}
          >
            {config.secondaryAction.label}
          </button>
        )}
      </div>

      {/* Dismiss button (if onDismiss provided) */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="mt-[var(--space-4)] underline transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
          style={{ 
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-xs)'
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
};

export default ErrorState;

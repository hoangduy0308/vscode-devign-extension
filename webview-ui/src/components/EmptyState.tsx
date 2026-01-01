import React from 'react';

interface EmptyStateProps {
  icon: string;  // codicon class name (e.g., 'codicon-shield')
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg"
      style={{
        borderColor: 'var(--color-border-default)',
        background: 'var(--color-bg-primary)'
      }}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      <div 
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{
          background: 'var(--severity-info-bg)',
          border: '1px solid var(--severity-info-border)'
        }}
      >
        <span 
          className={`codicon ${icon}`}
          style={{ 
            color: 'var(--severity-info-icon)',
            fontSize: 'var(--font-size-3xl)'
          }}
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <h3 
        className="font-semibold mb-2"
        style={{ 
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-lg)'
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p 
        className="mb-4 max-w-md"
        style={{ 
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)'
        }}
      >
        {description}
      </p>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="flex gap-3">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
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
              aria-label={primaryAction.label}
            >
              {primaryAction.icon && (
                <span className={`codicon ${primaryAction.icon}`} aria-hidden="true" />
              )}
              {primaryAction.label}
            </button>
          )}

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 rounded text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
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
              aria-label={secondaryAction.label}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;

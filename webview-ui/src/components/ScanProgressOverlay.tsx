import React, { useEffect, useRef, useCallback } from 'react';
import { messages, type ScanStatusPayload } from '../utilities/messages';

export type ScanState = 'idle' | 'scanning' | 'completed' | 'error';

interface ScanProgressOverlayProps {
  status: ScanStatusPayload;
  onClose?: () => void;
}

const StateIcons: Record<ScanState, React.ReactNode> = {
  idle: (
    <svg className="w-12 h-12 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  scanning: (
    <svg className="w-12 h-12 text-[var(--color-interactive-primary)] animate-spin-slow" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
  completed: (
    <svg className="w-12 h-12 text-[var(--severity-success-text)] animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-12 h-12 text-[var(--severity-critical-text)] animate-shake" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
};

const StateMessages: Record<ScanState, { title: string; description: string }> = {
  idle: {
    title: 'Ready to Scan',
    description: 'Click "Run Scan" to analyze your code for vulnerabilities.'
  },
  scanning: {
    title: 'Scanning in Progress',
    description: 'Analyzing your code for potential security vulnerabilities...'
  },
  completed: {
    title: 'Scan Complete',
    description: 'Analysis finished. Review the results below.'
  },
  error: {
    title: 'Scan Failed',
    description: 'An error occurred during the scan. Please try again.'
  }
};

export const ScanProgressOverlay: React.FC<ScanProgressOverlayProps> = ({ status, onClose }) => {
  const state = status.status;
  const progress = status.progress ?? 0;
  const filesScanned = status.filesScanned ?? 0;
  const totalFiles = status.totalFiles ?? 0;
  const message = status.message;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleCancel = () => {
    messages.cancelScan();
  };

  const handleRetry = () => {
    messages.runScan();
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onClose) {
      e.preventDefault();
      onClose();
    }
    
    // Trap focus within dialog
    if (e.key === 'Tab') {
      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements || focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, [onClose]);

  // Focus management for modal
  useEffect(() => {
    if (state !== 'idle') {
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus first button in dialog
      const firstButton = dialogRef.current?.querySelector<HTMLElement>('button');
      firstButton?.focus();
      
      return () => {
        previousActiveElement.current?.focus();
      };
    }
  }, [state]);

  // Don't show overlay for idle state unless explicitly needed
  if (state === 'idle') {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-progress-title"
      aria-describedby="scan-progress-description"
      onKeyDown={handleKeyDown}
    >
      <div 
        ref={dialogRef}
        className="glass-heavy rounded-lg p-6 max-w-md w-full mx-4 animate-scale-in shadow-2xl"
      >
        {/* Close button for completed/error states */}
        {(state === 'completed' || state === 'error') && onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded hover:bg-[var(--color-bg-hover)] transition-colors hover:scale-110"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Icon */}
        <div className="flex justify-center mb-4">
          {StateIcons[state]}
        </div>

        {/* Title */}
        <h2 
          id="scan-progress-title"
          className="text-lg font-semibold text-center text-[var(--color-text-primary)] mb-2 animate-fade-in-up"
        >
          {StateMessages[state].title}
        </h2>

        {/* Description */}
        <p 
          id="scan-progress-description"
          className="text-sm text-center text-[var(--color-text-secondary)] mb-4 animate-fade-in-up animation-delay-100 animation-fill-both"
        >
          {message || StateMessages[state].description}
        </p>

        {/* Progress bar (only for scanning state) */}
        {state === 'scanning' && (
          <div className="mb-4 animate-fade-in-up animation-delay-200 animation-fill-both">
            <div 
              className="w-full bg-[var(--vscode-progressBar-background)] rounded-full h-2 overflow-hidden"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Scan progress"
            >
              <div 
                className="h-full bg-[var(--color-interactive-primary)] transition-all duration-300 ease-out animate-shimmer"
                style={{ width: `${progress}%`, backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)' }}
              />
            </div>
            
            {/* Progress details */}
            <div className="flex justify-between mt-2 text-xs text-[var(--color-text-secondary)]">
              <span>{progress}% complete</span>
              {totalFiles > 0 && (
                <span>{filesScanned} / {totalFiles} files</span>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-center animate-fade-in-up animation-delay-300 animation-fill-both">
          {state === 'scanning' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded text-sm font-medium bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
            >
              Cancel Scan
            </button>
          )}

          {state === 'error' && (
            <>
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded text-sm font-medium bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
              >
                Retry Scan
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded text-sm font-medium bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
                >
                  Dismiss
                </button>
              )}
            </>
          )}

          {state === 'completed' && onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-sm font-medium bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
            >
              View Results
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanProgressOverlay;

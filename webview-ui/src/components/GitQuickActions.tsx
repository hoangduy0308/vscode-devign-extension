import React, { useState, useCallback } from 'react';
import { Icon, CODICONS } from './ui/Icon';

export interface GitQuickActionsProps {
  branch: string;
  stagedCount: number;
  unstagedCount: number;
  isCommitting: boolean;
  isPushing: boolean;
  isPulling: boolean;
  onCommit: () => void;
  onPush: () => void;
  onPull: () => void;
}

export const GitQuickActions: React.FC<GitQuickActionsProps> = ({
  branch,
  stagedCount,
  unstagedCount,
  isCommitting,
  isPushing,
  isPulling,
  onCommit,
  onPush,
  onPull,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const isAnyActionInProgress = isCommitting || isPushing || isPulling;
  
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }, []);

  return (
    <div
      className="git-quick-actions"
      role="region"
      aria-label="Git Quick Actions"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--card-radius)',
        padding: 'var(--git-bar-padding)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      {/* Header Row: Branch info, file counts, and collapse toggle */}
      <div
        className="git-quick-actions__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          minHeight: 'var(--button-height-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Branch indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              color: 'var(--vscode-foreground)',
            }}
          >
            <Icon name={CODICONS.git.branch} size="sm" />
            <span
              style={{
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={branch}
            >
              {branch}
            </span>
          </div>

          {/* Separator */}
          <div
            style={{
              width: '1px',
              height: '16px',
              background: 'var(--card-border)',
            }}
            aria-hidden="true"
          />

          {/* File counts */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--vscode-descriptionForeground)',
            }}
          >
            <span>
              Staged:{' '}
              <strong style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>
                {stagedCount}
              </strong>
            </span>
            <span aria-hidden="true">|</span>
            <span>
              Unstaged:{' '}
              <strong style={{ color: 'var(--vscode-gitDecoration-modifiedResourceForeground)' }}>
                {unstagedCount}
              </strong>
            </span>
          </div>
        </div>

        {/* Collapse/Expand toggle */}
        <button
          onClick={toggleExpanded}
          onKeyDown={(e) => handleKeyDown(e, toggleExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse git actions' : 'Expand git actions'}
          title={isExpanded ? 'Collapse' : 'Expand'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--vscode-foreground)',
            cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            transition: 'var(--transition-colors)',
          }}
        >
          <Icon
            name={isExpanded ? CODICONS.ui.chevronUp : CODICONS.ui.chevronDown}
            size="sm"
          />
        </button>
      </div>

      {/* Actions Row */}
      {isExpanded && (
        <div
          className="git-quick-actions__buttons"
          role="group"
          aria-label="Git action buttons"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {/* Commit Button */}
          <button
            onClick={onCommit}
            onKeyDown={(e) => handleKeyDown(e, onCommit)}
            disabled={isAnyActionInProgress || stagedCount === 0}
            aria-label="Commit with security gate check"
            title="Commit with security gate check"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-1)',
              height: 'var(--button-height-sm)',
              padding: 'var(--button-padding-sm)',
              border: 'none',
              borderRadius: 'var(--button-radius)',
              background: 'var(--button-secondary-bg)',
              color: 'var(--button-secondary-text)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              cursor: isAnyActionInProgress || stagedCount === 0 ? 'not-allowed' : 'pointer',
              opacity: isAnyActionInProgress || stagedCount === 0 ? 0.5 : 1,
              transition: 'var(--transition-colors)',
              flex: 1,
            }}
          >
            {isCommitting ? (
              <Icon name="sync" size="sm" spin />
            ) : (
              <Icon name={CODICONS.git.commit} size="sm" />
            )}
            <span>{isCommitting ? 'Committing...' : 'Commit'}</span>
          </button>

          {/* Push Button */}
          <button
            onClick={onPush}
            onKeyDown={(e) => handleKeyDown(e, onPush)}
            disabled={isAnyActionInProgress}
            aria-label="Push to remote"
            title="Push to remote"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-1)',
              height: 'var(--button-height-sm)',
              padding: 'var(--button-padding-sm)',
              border: 'none',
              borderRadius: 'var(--button-radius)',
              background: 'var(--button-secondary-bg)',
              color: 'var(--button-secondary-text)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              cursor: isAnyActionInProgress ? 'not-allowed' : 'pointer',
              opacity: isAnyActionInProgress ? 0.5 : 1,
              transition: 'var(--transition-colors)',
              flex: 1,
            }}
          >
            {isPushing ? (
              <Icon name="sync" size="sm" spin />
            ) : (
              <Icon name={CODICONS.git.push} size="sm" />
            )}
            <span>{isPushing ? 'Pushing...' : 'Push'}</span>
          </button>

          {/* Pull Button */}
          <button
            onClick={onPull}
            onKeyDown={(e) => handleKeyDown(e, onPull)}
            disabled={isAnyActionInProgress}
            aria-label="Pull from remote"
            title="Pull from remote"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-1)',
              height: 'var(--button-height-sm)',
              padding: 'var(--button-padding-sm)',
              border: 'none',
              borderRadius: 'var(--button-radius)',
              background: 'var(--button-secondary-bg)',
              color: 'var(--button-secondary-text)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              cursor: isAnyActionInProgress ? 'not-allowed' : 'pointer',
              opacity: isAnyActionInProgress ? 0.5 : 1,
              transition: 'var(--transition-colors)',
              flex: 1,
            }}
          >
            {isPulling ? (
              <Icon name="sync" size="sm" spin />
            ) : (
              <Icon name={CODICONS.git.pull} size="sm" />
            )}
            <span>{isPulling ? 'Pulling...' : 'Pull'}</span>
          </button>
        </div>
      )}

      {/* Hover styles injected via CSS-in-JS would go here in production */}
      <style>{`
        .git-quick-actions__buttons button:not(:disabled):hover {
          background: var(--button-secondary-bg-hover) !important;
        }
        .git-quick-actions__buttons button:focus-visible {
          outline: 2px solid var(--vscode-focusBorder);
          outline-offset: 1px;
        }
        .git-quick-actions__header button:not(:disabled):hover {
          background: var(--vscode-list-hoverBackground) !important;
        }
        .git-quick-actions__header button:focus-visible {
          outline: 2px solid var(--vscode-focusBorder);
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
};

export default GitQuickActions;

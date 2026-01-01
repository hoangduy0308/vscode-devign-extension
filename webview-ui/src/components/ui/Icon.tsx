import React from 'react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type SeverityVariant = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success';

export interface IconProps {
  name: string;
  size?: IconSize;
  className?: string;
  spin?: boolean;
  color?: string;
  severity?: SeverityVariant;
  title?: string;
  onClick?: () => void;
}

const sizeMap: Record<IconSize, string> = {
  xs: 'var(--icon-size-xs)',
  sm: 'var(--icon-size-sm)',
  md: 'var(--icon-size-md)',
  lg: 'var(--icon-size-lg)',
  xl: 'var(--icon-size-xl)',
};

const severityColorMap: Record<SeverityVariant, string> = {
  critical: 'var(--severity-critical-icon)',
  high: 'var(--severity-high-icon)',
  medium: 'var(--severity-medium-icon)',
  low: 'var(--severity-low-icon)',
  info: 'var(--severity-info-icon)',
  success: 'var(--severity-success-icon)',
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 'sm',
  className = '',
  spin = false,
  color,
  severity,
  title,
  onClick,
}) => {
  const computedColor = severity 
    ? severityColorMap[severity] 
    : color || 'currentColor';

  const isInteractive = !!onClick;
  
  const styles: React.CSSProperties = {
    fontSize: sizeMap[size],
    color: computedColor,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',
    lineHeight: 1,
    ...(isInteractive && {
      cursor: 'pointer',
      transition: 'var(--transition-colors)',
    }),
  };

  const spinClass = spin ? 'devign-icon-spin' : '';
  const interactiveClass = isInteractive ? 'devign-icon-interactive' : '';
  
  const combinedClassName = [
    'codicon',
    `codicon-${name}`,
    spinClass,
    interactiveClass,
    className,
  ].filter(Boolean).join(' ');

  return (
    <i
      className={combinedClassName}
      style={styles}
      aria-hidden={!title}
      aria-label={title}
      role={title ? 'img' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isInteractive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
    />
  );
};

export const CODICONS = {
  severity: {
    critical: 'flame',
    high: 'warning',
    medium: 'info',
    low: 'circle-outline',
  },
  status: {
    passed: 'pass',
    failed: 'error',
    warning: 'warning',
    scanning: 'sync',
    idle: 'circle-outline',
  },
  git: {
    branch: 'git-branch',
    commit: 'git-commit',
    push: 'cloud-upload',
    pull: 'cloud-download',
    merge: 'git-merge',
    stash: 'git-stash',
  },
  ui: {
    settings: 'gear',
    search: 'search',
    filter: 'filter',
    close: 'close',
    check: 'check',
    plus: 'plus',
    minus: 'dash',
    chevronRight: 'chevron-right',
    chevronDown: 'chevron-down',
    chevronUp: 'chevron-up',
    file: 'file-code',
    folder: 'folder',
    refresh: 'refresh',
    play: 'play',
    stop: 'stop',
    copy: 'copy',
    link: 'link-external',
    eye: 'eye',
    eyeClosed: 'eye-closed',
  },
  security: {
    shield: 'shield',
    lock: 'lock',
    unlock: 'unlock',
    key: 'key',
  },
} as const;

export type CodiconName = typeof CODICONS[keyof typeof CODICONS][keyof typeof CODICONS[keyof typeof CODICONS]];

export default Icon;

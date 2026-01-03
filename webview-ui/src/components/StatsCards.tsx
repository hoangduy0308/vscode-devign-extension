import React from 'react';
import { Icon, CODICONS } from './ui/Icon';

type SeverityType = 'critical' | 'high' | 'medium' | 'low';

export interface StatsCardsProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
  activeFilter?: SeverityType | null;
  onCardClick?: (severity: SeverityType) => void;
  onClearFilter?: () => void;
}

interface CardConfig {
  severity: SeverityType;
  label: string;
  icon: string;
}

const CARD_CONFIGS: CardConfig[] = [
  { severity: 'critical', label: 'Critical', icon: CODICONS.severity.critical },
  { severity: 'high', label: 'High', icon: CODICONS.severity.high },
  { severity: 'medium', label: 'Medium', icon: CODICONS.severity.medium },
  { severity: 'low', label: 'Low', icon: CODICONS.severity.low },
];

const cardStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--card-padding)',
  borderRadius: 'var(--card-radius)',
  border: '1px solid',
  cursor: 'pointer',
  transition: 'var(--transition-all)',
  minWidth: 'var(--stats-card-min-width)',
  outline: 'none',
};

const getSeverityStyles = (severity: SeverityType): React.CSSProperties => ({
  backgroundColor: `var(--severity-${severity}-bg)`,
  borderColor: `var(--severity-${severity}-border)`,
});

const getHoverStyles = (severity: SeverityType): React.CSSProperties => ({
  backgroundColor: `var(--severity-${severity}-bg-hover)`,
  boxShadow: 'var(--card-shadow-hover)',
  transform: 'translateY(-1px)',
});

const getActiveStyles = (severity: SeverityType): React.CSSProperties => ({
  boxShadow: `0 0 0 2px var(--severity-${severity}-text), var(--card-shadow-hover)`,
  transform: 'translateY(-2px)',
});

const countStyles: React.CSSProperties = {
  fontSize: 'var(--font-size-2xl)',
  fontWeight: 'var(--font-weight-bold)',
  lineHeight: 'var(--line-height-tight)',
};

const labelStyles: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--letter-spacing-wide)',
};

const gridStyles: React.CSSProperties = {
  width: '100%',
};

interface StatCardProps {
  config: CardConfig;
  count: number;
  isActive: boolean;
  onClick?: () => void;
  index: number;
}

const StatCard: React.FC<StatCardProps> = ({ config, count, isActive, onClick, index }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  const combinedStyles: React.CSSProperties = {
    ...cardStyles,
    ...getSeverityStyles(config.severity),
    ...(isActive ? getActiveStyles(config.severity) : {}),
    ...((isHovered || isFocused) && !isActive ? getHoverStyles(config.severity) : {}),
    animationDelay: `${index * 100}ms`,
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`animate-fade-in-up animation-fill-both ${isActive ? 'ring-2 ring-offset-1' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${count} ${config.label} severity vulnerabilities. ${isActive ? 'Filter active. ' : ''}Click to ${isActive ? 'clear' : 'apply'} filter.`}
      aria-pressed={isActive}
      style={combinedStyles}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Icon 
          name={config.icon} 
          severity={config.severity} 
          size="md" 
          className={count > 0 && config.severity === 'critical' ? 'animate-pulse-subtle' : ''} 
        />
        <span style={{ ...countStyles, color: `var(--severity-${config.severity}-text)` }}>
          {count}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <span style={labelStyles}>{config.label}</span>
        {isActive && (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: `var(--severity-${config.severity}-text)`,
              color: 'var(--vscode-editor-background)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-bold)',
            }}
            aria-hidden="true"
          >
            ✓
          </span>
        )}
      </div>
    </div>
  );
};

export const StatsCards: React.FC<StatsCardsProps> = ({
  critical,
  high,
  medium,
  low,
  activeFilter,
  onCardClick,
  onClearFilter,
}) => {
  const counts: Record<SeverityType, number> = { critical, high, medium, low };

  return (
    <div
      className="stats-grid-wrapper"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}
    >
      {/* Clear Filter Button */}
      {activeFilter && onClearFilter && (
        <button
          onClick={onClearFilter}
          className="animate-fade-in"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-1) var(--space-2)',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: '1px solid var(--vscode-button-border, transparent)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
            alignSelf: 'flex-end',
            transition: 'var(--transition-colors)',
          }}
          aria-label={`Clear ${activeFilter} severity filter`}
        >
          <span style={{ fontSize: '10px' }}>✕</span>
          Clear {activeFilter} filter
        </button>
      )}
      
      {/* Stats Grid */}
      <div
        className="stats-grid"
        style={gridStyles}
        role="group"
        aria-label="Vulnerability severity statistics"
      >
        {CARD_CONFIGS.map((config, index) => (
          <StatCard
            key={config.severity}
            config={config}
            count={counts[config.severity]}
            isActive={activeFilter === config.severity}
            onClick={onCardClick ? () => onCardClick(config.severity) : undefined}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default StatsCards;

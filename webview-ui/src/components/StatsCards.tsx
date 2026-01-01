import React from 'react';
import { Icon, CODICONS } from './ui/Icon';

type SeverityType = 'critical' | 'high' | 'medium' | 'low';

export interface StatsCardsProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
  onCardClick?: (severity: SeverityType) => void;
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
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ config, count, onClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  const combinedStyles: React.CSSProperties = {
    ...cardStyles,
    ...getSeverityStyles(config.severity),
    ...((isHovered || isFocused) ? getHoverStyles(config.severity) : {}),
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${count} ${config.label} severity vulnerabilities. Click to filter.`}
      style={combinedStyles}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Icon name={config.icon} severity={config.severity} size="md" />
        <span style={{ ...countStyles, color: `var(--severity-${config.severity}-text)` }}>
          {count}
        </span>
      </div>
      <span style={labelStyles}>{config.label}</span>
    </div>
  );
};

export const StatsCards: React.FC<StatsCardsProps> = ({
  critical,
  high,
  medium,
  low,
  onCardClick,
}) => {
  const counts: Record<SeverityType, number> = { critical, high, medium, low };

  return (
    <div
      className="stats-grid"
      style={gridStyles}
      role="group"
      aria-label="Vulnerability severity statistics"
    >
      {CARD_CONFIGS.map((config) => (
        <StatCard
          key={config.severity}
          config={config}
          count={counts[config.severity]}
          onClick={onCardClick ? () => onCardClick(config.severity) : undefined}
        />
      ))}
    </div>
  );
};

export default StatsCards;

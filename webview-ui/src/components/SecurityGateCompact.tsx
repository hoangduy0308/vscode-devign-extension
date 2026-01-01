import React from 'react';
import { Icon, CODICONS } from './ui/Icon';

export type GateStatus = 'PASSED' | 'FAILED' | 'WARNING' | 'SCANNING' | 'IDLE';

export interface SecurityGateCompactProps {
  status: GateStatus;
  progress: number;
  message: string;
  blockedBy?: string[];
}

const statusConfig: Record<GateStatus, { 
  color: string; 
  icon: string; 
  spin?: boolean;
  animation?: string;
}> = {
  PASSED: { color: 'var(--status-passed)', icon: CODICONS.status.passed, animation: 'animate-scale-in' },
  FAILED: { color: 'var(--status-failed)', icon: CODICONS.status.failed, animation: 'animate-critical-pulse' },
  WARNING: { color: 'var(--status-warning)', icon: CODICONS.status.warning, animation: 'animate-pulse-subtle' },
  SCANNING: { color: 'var(--status-scanning)', icon: CODICONS.status.scanning, spin: true, animation: 'animate-pulse' },
  IDLE: { color: 'var(--status-idle)', icon: CODICONS.status.idle },
};

export const SecurityGateCompact: React.FC<SecurityGateCompactProps> = ({
  status,
  progress,
  message,
  blockedBy,
}) => {
  const config = statusConfig[status];
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      className="security-gate-compact transition-all duration-300"
      role="region"
      aria-label="Security gate status"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--card-radius)',
        padding: 'var(--card-padding)',
        ...(status === 'FAILED' ? { boxShadow: '0 0 0 2px var(--status-failed-bg)' } : {}),
      }}
    >
      {/* Row 1: Status + Progress Bar + Percentage */}
      <div
        className="security-gate-compact__row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        {/* Status Indicator */}
        <div
          className="security-gate-compact__status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexShrink: 0,
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={config.animation}>
            <Icon
              name={config.icon}
              size="sm"
              color={config.color}
              spin={config.spin}
              title={`Status: ${status}`}
            />
          </div>
          <span
            style={{
              color: config.color,
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--letter-spacing-wide)',
            }}
          >
            {status}
          </span>
        </div>

        {/* Progress Bar */}
        <div
          className="security-gate-compact__progress"
          style={{
            flex: 1,
            height: 'var(--progress-height)',
            background: 'var(--progress-bg)',
            borderRadius: 'var(--progress-radius)',
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={clampedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Security gate progress: ${clampedProgress}%`}
        >
          <div
            className="security-gate-compact__progress-fill"
            style={{
              width: `${clampedProgress}%`,
              height: '100%',
              background: config.color,
              borderRadius: 'var(--progress-radius)',
              transition: 'width var(--duration-normal) var(--ease-out)',
            }}
          />
        </div>

        {/* Percentage */}
        <span
          className="security-gate-compact__percentage"
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-primary)',
            minWidth: '2.5rem',
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {clampedProgress}%
        </span>
      </div>

      {/* Row 2: Message + Blocked By Tags */}
      <div
        className="security-gate-compact__info"
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-2)',
        }}
      >
        <span
          className="security-gate-compact__message"
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {message}
        </span>

        {blockedBy && blockedBy.length > 0 && (
          <div
            className="security-gate-compact__blocked"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              marginLeft: 'auto',
            }}
          >
            {blockedBy.map((item, index) => (
              <span
                key={index}
                className="security-gate-compact__badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 'var(--badge-height)',
                  padding: 'var(--badge-padding)',
                  fontSize: 'var(--badge-font-size)',
                  fontWeight: 'var(--badge-font-weight)',
                  color: 'var(--status-failed)',
                  background: 'var(--status-failed-bg)',
                  border: '1px solid var(--status-failed-border)',
                  borderRadius: 'var(--badge-radius)',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityGateCompact;

import React from 'react';
import { Icon, CODICONS } from './ui/Icon';

export type ScanState = 'SCANNING' | 'COMPLETE' | 'IDLE';
export type GateResult = 'PASSED' | 'FAILED' | 'WARNING' | 'PENDING';

export interface SecurityGateCompactProps {
  scanState: ScanState;
  gateResult: GateResult;
  progress: number;
  message: string;
  blockedBy?: string[];
}

const scanStateConfig: Record<ScanState, { 
  color: string; 
  icon: string; 
  spin?: boolean;
  label: string;
}> = {
  SCANNING: { color: 'var(--status-scanning)', icon: CODICONS.status.scanning, spin: true, label: 'Scanning' },
  COMPLETE: { color: 'var(--status-passed)', icon: CODICONS.status.passed, label: 'Complete' },
  IDLE: { color: 'var(--status-idle)', icon: CODICONS.status.idle, label: 'Ready' },
};

const gateResultConfig: Record<GateResult, { 
  color: string; 
  icon: string; 
  animation?: string;
  label: string;
}> = {
  PASSED: { color: 'var(--status-passed)', icon: CODICONS.status.passed, animation: 'animate-scale-in', label: 'Pass' },
  FAILED: { color: 'var(--status-failed)', icon: CODICONS.status.failed, animation: 'animate-critical-pulse', label: 'Fail' },
  WARNING: { color: 'var(--status-warning)', icon: CODICONS.status.warning, animation: 'animate-pulse-subtle', label: 'Warning' },
  PENDING: { color: 'var(--status-idle)', icon: CODICONS.status.idle, label: 'Pending' },
};

export const SecurityGateCompact: React.FC<SecurityGateCompactProps> = ({
  scanState,
  gateResult,
  progress,
  message,
  blockedBy,
}) => {
  const scanConfig = scanStateConfig[scanState];
  const gateConfig = gateResultConfig[gateResult];
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const isScanning = scanState === 'SCANNING';

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
        ...(gateResult === 'FAILED' ? { boxShadow: '0 0 0 2px var(--status-failed-bg)' } : {}),
      }}
    >
      {/* Row 1: Scan Status + Security Gate + Progress Bar + Percentage */}
      <div
        className="security-gate-compact__row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        {/* Scan Status Indicator */}
        <div
          className="security-gate-compact__scan-status"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '2px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-2xs, 10px)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--letter-spacing-wide)',
            }}
          >
            Scan Status
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            <Icon
              name={scanConfig.icon}
              size="sm"
              color={scanConfig.color}
              spin={scanConfig.spin}
              title={`Scan: ${scanConfig.label}`}
            />
            <span
              style={{
                color: scanConfig.color,
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              {scanConfig.label}
            </span>
          </div>
        </div>

        {/* Security Gate Indicator */}
        <div
          className="security-gate-compact__gate-result"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '2px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-2xs, 10px)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--letter-spacing-wide)',
            }}
          >
            Security Gate
          </span>
          <div
            className={gateConfig.animation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            <Icon
              name={gateConfig.icon}
              size="sm"
              color={gateConfig.color}
              title={`Gate: ${gateConfig.label}`}
            />
            <span
              style={{
                color: gateConfig.color,
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              {gateConfig.label}
            </span>
          </div>
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
              background: isScanning ? scanConfig.color : gateConfig.color,
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

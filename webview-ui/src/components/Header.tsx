import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon, CODICONS } from './ui/Icon';

export type ScanStatus = 'PASSED' | 'FAILED' | 'WARNING' | 'SCANNING' | 'IDLE';
export type ScanScope = 'file' | 'workspace' | 'selection';

export interface HeaderProps {
  status: ScanStatus;
  scanScope: ScanScope;
  currentFile?: string;
  onScan: (scope: ScanScope) => void;
  onSettings: () => void;
  onCancel: () => void;
}

interface StatusConfig {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  spin?: boolean;
}

const STATUS_CONFIG: Record<ScanStatus, StatusConfig> = {
  PASSED: {
    icon: CODICONS.status.passed,
    color: 'var(--status-passed)',
    bgColor: 'var(--status-passed-bg)',
    borderColor: 'var(--status-passed-border)',
    label: 'Passed',
  },
  FAILED: {
    icon: CODICONS.status.failed,
    color: 'var(--status-failed)',
    bgColor: 'var(--status-failed-bg)',
    borderColor: 'var(--status-failed-border)',
    label: 'Failed',
  },
  WARNING: {
    icon: CODICONS.status.warning,
    color: 'var(--status-warning)',
    bgColor: 'var(--status-warning-bg)',
    borderColor: 'var(--status-warning-border)',
    label: 'Warning',
  },
  SCANNING: {
    icon: CODICONS.status.scanning,
    color: 'var(--status-scanning)',
    bgColor: 'var(--status-scanning-bg)',
    borderColor: 'var(--status-scanning-border)',
    label: 'Scanning',
    spin: true,
  },
  IDLE: {
    icon: CODICONS.status.idle,
    color: 'var(--status-idle)',
    bgColor: 'var(--status-idle-bg)',
    borderColor: 'var(--status-idle-border)',
    label: 'Idle',
  },
};

const SCAN_OPTIONS: { scope: ScanScope; label: string; icon: string }[] = [
  { scope: 'file', label: 'Scan Current File', icon: CODICONS.ui.file },
  { scope: 'workspace', label: 'Scan Workspace', icon: CODICONS.ui.folder },
  { scope: 'selection', label: 'Scan Selection', icon: 'selection' },
];

const styles = {
  header: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 'var(--z-sticky)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    height: 'var(--header-height)',
    padding: 'var(--header-padding)',
    background: 'var(--header-bg)',
    borderBottom: '1px solid var(--header-border)',
    fontFamily: 'var(--font-family-base)',
    fontSize: 'var(--header-font-size)',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--font-weight-semibold)',
    fontSize: 'var(--font-size-sm)',
    lineHeight: 1,
    whiteSpace: 'nowrap' as const,
    transition: 'var(--transition-colors)',
  },
  scopeIndicator: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: 'var(--color-text-secondary)',
    fontSize: 'var(--font-size-xs)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginLeft: 'auto',
  },
  dropdownContainer: {
    position: 'relative' as const,
  },
  scanButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    height: 'var(--button-height-sm)',
    padding: 'var(--space-1) var(--space-3)',
    background: 'var(--button-primary-bg)',
    color: 'var(--button-primary-text)',
    border: 'none',
    borderRadius: 'var(--button-radius)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: 'pointer',
    transition: 'var(--transition-colors)',
    whiteSpace: 'nowrap' as const,
  },
  scanButtonHover: {
    background: 'var(--button-primary-bg-hover)',
  },
  cancelButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    height: 'var(--button-height-sm)',
    padding: 'var(--space-1) var(--space-3)',
    background: 'var(--button-secondary-bg)',
    color: 'var(--button-secondary-text)',
    border: 'none',
    borderRadius: 'var(--button-radius)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: 'pointer',
    transition: 'var(--transition-colors)',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'var(--button-height-sm)',
    height: 'var(--button-height-sm)',
    padding: 0,
    background: 'var(--button-ghost-bg)',
    color: 'var(--color-text-primary)',
    border: 'none',
    borderRadius: 'var(--button-radius)',
    cursor: 'pointer',
    transition: 'var(--transition-colors)',
  },
  iconButtonHover: {
    background: 'var(--button-ghost-bg-hover)',
  },
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    marginTop: 'var(--space-1)',
    minWidth: '180px',
    background: 'var(--dropdown-bg)',
    border: '1px solid var(--dropdown-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 'var(--z-dropdown)',
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    background: 'transparent',
    color: 'var(--dropdown-text)',
    border: 'none',
    fontSize: 'var(--font-size-sm)',
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: 'var(--transition-colors)',
  },
  dropdownItemHover: {
    background: 'var(--dropdown-item-hover-bg)',
  },
  dropdownItemFocused: {
    background: 'var(--dropdown-item-active-bg)',
    outline: 'none',
  },
  focusRing: {
    outline: '1px solid var(--focus-ring-color)',
    outlineOffset: 'var(--focus-ring-offset)',
  },
};

export const Header: React.FC<HeaderProps> = ({
  status,
  scanScope,
  currentFile,
  onScan,
  onSettings,
  onCancel,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const statusConfig = STATUS_CONFIG[status];
  const isScanning = status === 'SCANNING';

  const getScopeLabel = useCallback(() => {
    if (!isScanning) return null;
    const scopeLabels: Record<ScanScope, string> = {
      file: currentFile ? `Scanning: ${currentFile}` : 'Scanning file...',
      workspace: 'Scanning workspace...',
      selection: 'Scanning selection...',
    };
    return scopeLabels[scanScope];
  }, [isScanning, scanScope, currentFile]);

  const handleDropdownToggle = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
    setFocusedIndex(-1);
  }, []);

  const handleScanSelect = useCallback(
    (scope: ScanScope) => {
      onScan(scope);
      setIsDropdownOpen(false);
      buttonRef.current?.focus();
    },
    [onScan]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isDropdownOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsDropdownOpen(true);
          setFocusedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < SCAN_OPTIONS.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : SCAN_OPTIONS.length - 1
          );
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0) {
            handleScanSelect(SCAN_OPTIONS[focusedIndex].scope);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsDropdownOpen(false);
          buttonRef.current?.focus();
          break;
        case 'Tab':
          setIsDropdownOpen(false);
          break;
      }
    },
    [isDropdownOpen, focusedIndex, handleScanSelect]
  );

  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const scopeLabel = getScopeLabel();

  return (
    <header style={styles.header} role="banner">
      {/* Status Badge */}
      <div
        style={{
          ...styles.statusBadge,
          color: statusConfig.color,
          background: statusConfig.bgColor,
          border: `1px solid ${statusConfig.borderColor}`,
        }}
        role="status"
        aria-live="polite"
        aria-label={`Status: ${statusConfig.label}`}
      >
        <Icon
          name={statusConfig.icon}
          size="sm"
          color={statusConfig.color}
          spin={statusConfig.spin}
          title={statusConfig.label}
        />
        <span>{statusConfig.label}</span>
      </div>

      {/* Scope Indicator */}
      {scopeLabel && (
        <span style={styles.scopeIndicator} title={scopeLabel}>
          {scopeLabel}
        </span>
      )}

      {/* Actions */}
      <div style={styles.actions} className="header-actions">
        {/* Scan Dropdown */}
        {!isScanning && (
          <div
            style={styles.dropdownContainer}
            ref={dropdownRef}
            onKeyDown={handleKeyDown}
          >
            <button
              ref={buttonRef}
              style={{
                ...styles.scanButton,
                ...(hoveredButton === 'scan' ? styles.scanButtonHover : {}),
              }}
              className="hover:shadow-token-md active:scale-[0.98] transition-all"
              onClick={handleDropdownToggle}
              onMouseEnter={() => setHoveredButton('scan')}
              onMouseLeave={() => setHoveredButton(null)}
              onFocus={() => setHoveredButton('scan')}
              onBlur={() => setHoveredButton(null)}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              aria-label="Scan options"
            >
              <Icon name={CODICONS.ui.play} size="sm" />
              <span>Scan</span>
              <Icon
                name={isDropdownOpen ? CODICONS.ui.chevronUp : CODICONS.ui.chevronDown}
                size="xs"
              />
            </button>

            {isDropdownOpen && (
              <div
                style={styles.dropdown}
                className="animate-fade-in-down origin-top-left"
                role="listbox"
                aria-label="Select scan scope"
              >
                {SCAN_OPTIONS.map((option, index) => (
                  <button
                    key={option.scope}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    style={{
                      ...styles.dropdownItem,
                      ...(focusedIndex === index
                        ? styles.dropdownItemFocused
                        : hoveredButton === option.scope
                        ? styles.dropdownItemHover
                        : {}),
                    }}
                    className="active:bg-[var(--dropdown-item-active-bg)]"
                    onClick={() => handleScanSelect(option.scope)}
                    onMouseEnter={() => {
                      setHoveredButton(option.scope);
                      setFocusedIndex(index);
                    }}
                    onMouseLeave={() => setHoveredButton(null)}
                    role="option"
                    aria-selected={focusedIndex === index}
                    tabIndex={focusedIndex === index ? 0 : -1}
                  >
                    <Icon name={option.icon} size="sm" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cancel Button */}
        {isScanning && (
          <button
            style={{
              ...styles.cancelButton,
              ...(hoveredButton === 'cancel'
                ? { background: 'var(--button-secondary-bg-hover)' }
                : {}),
            }}
            className="hover:scale-[1.02] active:scale-[0.98] transition-all"
            onClick={onCancel}
            onMouseEnter={() => setHoveredButton('cancel')}
            onMouseLeave={() => setHoveredButton(null)}
            aria-label="Cancel scan"
          >
            <Icon name={CODICONS.ui.stop} size="sm" />
            <span>Cancel</span>
          </button>
        )}

        {/* Settings Button */}
        <button
          style={{
            ...styles.iconButton,
            ...(hoveredButton === 'settings' ? styles.iconButtonHover : {}),
          }}
          className="hover:rotate-45 transition-transform duration-300"
          onClick={onSettings}
          onMouseEnter={() => setHoveredButton('settings')}
          onMouseLeave={() => setHoveredButton(null)}
          onFocus={() => setHoveredButton('settings')}
          onBlur={() => setHoveredButton(null)}
          aria-label="Open settings"
          title="Settings"
        >
          <Icon name={CODICONS.ui.settings} size="sm" />
        </button>
      </div>
    </header>
  );
};

export default Header;

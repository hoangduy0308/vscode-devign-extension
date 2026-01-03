import React from 'react';
import { Icon, CODICONS } from './ui/Icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';

export type ScanScope = 'file' | 'workspace' | 'selection';

export interface ScanSplitButtonProps {
  onScan: (scope: ScanScope) => void;
  disabled?: boolean;
  defaultScope?: ScanScope;
}

interface ScanOption {
  scope: ScanScope;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

const SCAN_OPTIONS: ScanOption[] = [
  {
    scope: 'file',
    label: 'Scan Current File',
    shortLabel: 'Full Scan',
    icon: CODICONS.ui.file,
    description: 'Scan the currently open file',
  },
  {
    scope: 'workspace',
    label: 'Scan Workspace',
    shortLabel: 'Quick Scan',
    icon: CODICONS.ui.folder,
    description: 'Scan all files in workspace',
  },
  {
    scope: 'selection',
    label: 'Scan Selection',
    shortLabel: 'Scan Selection',
    icon: 'selection',
    description: 'Scan selected code only',
  },
];

const styles = {
  container: {
    display: 'inline-flex',
    alignItems: 'stretch',
    borderRadius: 'var(--button-radius)',
    overflow: 'hidden',
  } as React.CSSProperties,
  mainButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    height: 'var(--button-height-sm)',
    padding: 'var(--space-1) var(--space-3)',
    background: 'var(--button-primary-bg)',
    color: 'var(--button-primary-text)',
    border: 'none',
    borderRight: '1px solid var(--vscode-button-separator, rgba(255,255,255,0.2))',
    borderRadius: 'var(--button-radius) 0 0 var(--button-radius)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: 'pointer',
    transition: 'var(--transition-colors)',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  dropdownTrigger: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'var(--button-height-sm)',
    padding: '0 var(--space-2)',
    background: 'var(--button-primary-bg)',
    color: 'var(--button-primary-text)',
    border: 'none',
    borderRadius: '0 var(--button-radius) var(--button-radius) 0',
    cursor: 'pointer',
    transition: 'var(--transition-colors)',
  } as React.CSSProperties,
  menuContent: {
    minWidth: '200px',
  } as React.CSSProperties,
  menuItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: '2px',
    padding: 'var(--space-2) var(--space-3)',
    cursor: 'pointer',
  } as React.CSSProperties,
  menuItemLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
  } as React.CSSProperties,
  menuItemDescription: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    marginLeft: 'calc(16px + var(--space-2))',
  } as React.CSSProperties,
};

export const ScanSplitButton: React.FC<ScanSplitButtonProps> = ({
  onScan,
  disabled = false,
  defaultScope = 'file',
}) => {
  const [isHoveredMain, setIsHoveredMain] = React.useState(false);
  const [isHoveredDropdown, setIsHoveredDropdown] = React.useState(false);
  const [lastUsedScope, setLastUsedScope] = React.useState<ScanScope>(defaultScope);

  const handleMainClick = () => {
    onScan(lastUsedScope);
  };

  const handleOptionClick = (scope: ScanScope) => {
    setLastUsedScope(scope);
    onScan(scope);
  };

  const currentOption = SCAN_OPTIONS.find((opt) => opt.scope === lastUsedScope) || SCAN_OPTIONS[0];

  return (
    <div style={styles.container} className="scan-split-button">
      {/* Main Scan Button */}
      <button
        style={{
          ...styles.mainButton,
          ...(isHoveredMain && !disabled
            ? { background: 'var(--button-primary-bg-hover)' }
            : {}),
          ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        }}
        className="hover:shadow-token-md active:scale-[0.98] transition-all"
        onClick={handleMainClick}
        onMouseEnter={() => setIsHoveredMain(true)}
        onMouseLeave={() => setIsHoveredMain(false)}
        disabled={disabled}
        aria-label={`Scan: ${currentOption.label}`}
      >
        <Icon name={CODICONS.ui.play} size="sm" />
        <span>Scan</span>
      </button>

      {/* Dropdown Trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            style={{
              ...styles.dropdownTrigger,
              ...(isHoveredDropdown && !disabled
                ? { background: 'var(--button-primary-bg-hover)' }
                : {}),
              ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
            }}
            className="hover:shadow-token-md active:scale-[0.98] transition-all"
            onMouseEnter={() => setIsHoveredDropdown(true)}
            onMouseLeave={() => setIsHoveredDropdown(false)}
            disabled={disabled}
            aria-label="Scan options"
            aria-haspopup="menu"
          >
            <Icon name={CODICONS.ui.chevronDown} size="xs" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={4}
          className="animate-fade-in-down origin-top-right"
          style={styles.menuContent}
        >
          {SCAN_OPTIONS.map((option, index) => (
            <React.Fragment key={option.scope}>
              <DropdownMenuItem
                onClick={() => handleOptionClick(option.scope)}
                className={`flex flex-col items-start gap-1 py-2 px-3 cursor-pointer ${
                  lastUsedScope === option.scope ? 'bg-accent' : ''
                }`}
              >
                <div style={styles.menuItemLabel}>
                  <Icon name={option.icon} size="sm" />
                  <span>{option.label}</span>
                  {lastUsedScope === option.scope && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      Default
                    </span>
                  )}
                </div>
                <span style={styles.menuItemDescription}>{option.description}</span>
              </DropdownMenuItem>
              {index < SCAN_OPTIONS.length - 1 && <DropdownMenuSeparator />}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ScanSplitButton;

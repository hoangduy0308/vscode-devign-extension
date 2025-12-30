import React, { memo, useCallback } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { type Vulnerability, type Range, Severity, MessageType } from '../types';
import { vscode } from '../utilities/vscode';

interface VirtualizedVulnListProps {
  vulnerabilities: Vulnerability[];
  height: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onCopy: (vuln: Vulnerability) => void;
}

// Helper to get severity class suffix
const getSeverityClass = (severity: Severity): string => {
  return severity.toLowerCase();
};

// Memoized vulnerability card component
const VulnerabilityRow = memo(({ 
  vuln, 
  index, 
  isSelected, 
  onSelect, 
  onCopy,
  onOpenFile 
}: {
  vuln: Vulnerability;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onCopy: (vuln: Vulnerability) => void;
  onOpenFile: (file: string, range: Range) => void;
}) => {
  const handleClick = () => {
    onSelect(index);
    onOpenFile(vuln.file, vuln.range);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(vuln);
  };

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={`vuln-card vuln-card--${getSeverityClass(vuln.severity)} cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] ${isSelected ? 'ring-2 ring-[var(--vscode-focusBorder)]' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${vuln.severity} vulnerability: ${vuln.description}`}
      aria-selected={isSelected}
      style={{ margin: '0 0 12px 0' }}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          <span className={`severity-badge severity-badge--${getSeverityClass(vuln.severity)}`}>
            {vuln.severity}
          </span>
          <span className="font-mono text-xs text-[var(--color-text-secondary)]">
            {vuln.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {(vuln.confidence * 100).toFixed(0)}%
          </span>
          <button
            onClick={handleCopyClick}
            className="p-1 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]"
            title="Copy to clipboard (c)"
            aria-label="Copy vulnerability details"
          >
            <span className="codicon codicon-copy text-xs" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="text-sm mb-2 font-medium text-[var(--color-text-primary)]">{vuln.description}</p>

      <div className="text-xs text-[var(--color-text-link)] font-mono truncate" title={vuln.file}>
        {vuln.file}:{vuln.range.startLine}
      </div>

      {vuln.snippet && (
        <pre className="mt-2 p-2 bg-[var(--vscode-textBlockQuote-background)] border border-[var(--vscode-textBlockQuote-border)] rounded text-xs overflow-x-auto font-mono text-[var(--color-text-primary)]">
          {vuln.snippet}
        </pre>
      )}
    </div>
  );
});

VulnerabilityRow.displayName = 'VulnerabilityRow';

// Estimated item height (adjust based on your card design)
const ITEM_HEIGHT = 140;
const ITEM_HEIGHT_WITH_SNIPPET = 200;

export const VirtualizedVulnList: React.FC<VirtualizedVulnListProps> = ({
  vulnerabilities,
  height,
  selectedIndex,
  onSelect,
  onCopy
}) => {
  const handleOpenFile = useCallback((file: string, range: Range) => {
    vscode.postMessage({
      type: MessageType.OPEN_FILE,
      payload: { path: file, range }
    });
  }, []);

  // Calculate average item height based on whether items have snippets
  const hasSnippets = vulnerabilities.some(v => v.snippet);
  const itemHeight = hasSnippets ? ITEM_HEIGHT_WITH_SNIPPET : ITEM_HEIGHT;

  const Row = useCallback(({ index, style }: ListChildComponentProps) => {
    const vuln = vulnerabilities[index];
    return (
      <div style={style}>
        <VulnerabilityRow
          vuln={vuln}
          index={index}
          isSelected={index === selectedIndex}
          onSelect={onSelect}
          onCopy={onCopy}
          onOpenFile={handleOpenFile}
        />
      </div>
    );
  }, [vulnerabilities, selectedIndex, onSelect, onCopy, handleOpenFile]);

  if (vulnerabilities.length === 0) {
    return (
      <div className="text-center text-[var(--vscode-descriptionForeground)] py-8 flex flex-col items-center gap-2 animate-fade-in" role="status">
        <i className="codicon codicon-check text-2xl text-[var(--vscode-charts-green)]" aria-hidden="true"></i>
        No vulnerabilities found matching filters.
      </div>
    );
  }

  // For small lists, don't virtualize
  if (vulnerabilities.length < 50) {
    return (
      <div className="flex flex-col gap-3 stagger-children" role="list">
        {vulnerabilities.map((vuln, index) => (
          <VulnerabilityRow
            key={vuln.id}
            vuln={vuln}
            index={index}
            isSelected={index === selectedIndex}
            onSelect={onSelect}
            onCopy={onCopy}
            onOpenFile={handleOpenFile}
          />
        ))}
      </div>
    );
  }

  // For large lists, use virtualization
  return (
    <List
      height={height}
      itemCount={vulnerabilities.length}
      itemSize={itemHeight}
      width="100%"
      className="scrollbar-thin"
      role="list"
    >
      {Row}
    </List>
  );
};

export default VirtualizedVulnList;

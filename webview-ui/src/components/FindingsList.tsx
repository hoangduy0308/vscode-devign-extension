import React, { useMemo, useState, useCallback, memo, type CSSProperties } from 'react';
import { List } from 'react-window';
import { Icon, CODICONS } from './ui/Icon';

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description?: string;
  file: string;
  line: number;
  cwe?: string;
  functionName?: string;
}

export type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
export type GroupBy = 'none' | 'file' | 'severity' | 'cwe';
export type SortBy = 'severity' | 'file' | 'line';

export interface FindingsListProps {
  findings: Finding[];
  filter: SeverityFilter;
  groupBy: GroupBy;
  sortBy: SortBy;
  searchQuery: string;
  onFilterChange: (filter: SeverityFilter) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  onSortByChange: (sortBy: SortBy) => void;
  onSearchChange: (query: string) => void;
  onFindingClick: (finding: Finding) => void;
  onViewCode: (finding: Finding) => void;
}

const SEVERITY_ORDER: Record<Finding['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEVERITY_LABELS: Record<Finding['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

interface GroupedFindings {
  key: string;
  label: string;
  findings: Finding[];
  severity?: Finding['severity'];
}

interface FindingCardProps {
  finding: Finding;
  onFindingClick: (finding: Finding) => void;
  onViewCode: (finding: Finding) => void;
  onCopy: (finding: Finding) => void;
  index?: number;
}

const FindingCard = memo<FindingCardProps>(({ finding, onFindingClick, onViewCode, onCopy, index = 0 }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFindingClick(finding);
    }
  };

  const handleViewCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewCode(finding);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(finding);
  };

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={`vuln-card vuln-card--${finding.severity} cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] animate-fade-in-up animation-fill-both`}
      onClick={() => onFindingClick(finding)}
      onKeyDown={handleKeyDown}
      aria-label={`${finding.severity} severity finding: ${finding.title}`}
      style={{
        padding: 'var(--finding-item-padding)',
        borderRadius: 'var(--finding-item-radius)',
        marginBottom: 'var(--finding-item-gap)',
        animationDelay: `${Math.min(index * 50, 500)}ms`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: `var(--severity-${finding.severity}-bg)`,
            border: `1px solid var(--severity-${finding.severity}-border)`,
          }}
        >
          <Icon
            name={CODICONS.severity[finding.severity]}
            size="sm"
            severity={finding.severity}
            title={`${SEVERITY_LABELS[finding.severity]} severity`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`severity-badge severity-badge--${finding.severity}`}
              style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {SEVERITY_LABELS[finding.severity]}
            </span>
            {finding.cwe && (
              <span
                className="px-2 py-0.5 rounded text-xs font-mono"
                style={{
                  background: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                {finding.cwe}
              </span>
            )}
          </div>

          <h4
            className="font-semibold mt-2 mb-1 truncate"
            style={{
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-md)',
            }}
            title={finding.title}
          >
            {finding.title}
          </h4>

          {finding.description && (
            <p
              className="text-sm line-clamp-2 mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {finding.description}
            </p>
          )}

          <button
            className="font-mono text-xs hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] rounded px-1 -ml-1"
            style={{ color: 'var(--color-text-link)' }}
            onClick={handleViewCode}
            title="Jump to code location"
            aria-label={`Open ${finding.file} at line ${finding.line}`}
          >
            {finding.file}:{finding.line}
            {finding.functionName && (
              <span style={{ color: 'var(--color-text-muted)' }}> · {finding.functionName}</span>
            )}
          </button>

          <div className="flex items-center gap-2 mt-3">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
              style={{
                background: 'var(--button-primary-bg)',
                color: 'var(--button-primary-text)',
                borderRadius: 'var(--button-radius)',
              }}
              onClick={handleViewCode}
              aria-label="View code for this finding"
            >
              <Icon name={CODICONS.ui.eye} size="xs" />
              View Code
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
              style={{
                background: 'var(--button-ghost-bg)',
                color: 'var(--button-ghost-text)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--button-radius)',
              }}
              onClick={handleCopy}
              aria-label="Copy finding details"
            >
              <Icon name={CODICONS.ui.copy} size="xs" />
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

FindingCard.displayName = 'FindingCard';

interface CollapsibleGroupProps {
  group: GroupedFindings;
  isExpanded: boolean;
  onToggle: () => void;
  onFindingClick: (finding: Finding) => void;
  onViewCode: (finding: Finding) => void;
  onCopy: (finding: Finding) => void;
}

const CollapsibleGroup = memo<CollapsibleGroupProps>(
  ({ group, isExpanded, onToggle, onFindingClick, onViewCode, onCopy }) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
    };

    return (
      <div className="mb-4">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
          }}
          onClick={onToggle}
          onKeyDown={handleKeyDown}
          aria-expanded={isExpanded}
          aria-controls={`group-${group.key}`}
        >
          <Icon
            name={CODICONS.ui.chevronRight}
            size="sm"
            color="var(--color-text-secondary)"
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          />
          {group.severity && (
            <Icon
              name={CODICONS.severity[group.severity]}
              size="sm"
              severity={group.severity}
            />
          )}
          <span
            className="font-medium flex-1 truncate"
            style={{
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {group.label}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {group.findings.length}
          </span>
        </button>

        {isExpanded && (
          <div
            id={`group-${group.key}`}
            className="mt-2 pl-4 animate-accordion-down overflow-hidden"
            role="list"
            aria-label={`${group.label} findings`}
          >
            {group.findings.map((finding, index) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onFindingClick={onFindingClick}
                onViewCode={onViewCode}
                onCopy={onCopy}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);

CollapsibleGroup.displayName = 'CollapsibleGroup';

const ITEM_HEIGHT = 180;
const VIRTUALIZATION_THRESHOLD = 50;

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  filter,
  groupBy,
  sortBy,
  searchQuery,
  onFilterChange,
  onGroupByChange,
  onSortByChange,
  onSearchChange,
  onFindingClick,
  onViewCode,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [listHeight, setListHeight] = useState(400);

  const handleCopy = useCallback((finding: Finding) => {
    const text = [
      `[${finding.severity.toUpperCase()}] ${finding.title}`,
      finding.description,
      `Location: ${finding.file}:${finding.line}`,
      finding.cwe ? `CWE: ${finding.cwe}` : null,
      finding.functionName ? `Function: ${finding.functionName}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(text);
  }, []);

  const filteredFindings = useMemo(() => {
    let result = [...findings];

    if (filter !== 'all') {
      result = result.filter((f) => f.severity === filter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.title.toLowerCase().includes(query) ||
          f.description?.toLowerCase().includes(query) ||
          f.file.toLowerCase().includes(query) ||
          f.cwe?.toLowerCase().includes(query) ||
          f.functionName?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [findings, filter, searchQuery]);

  const sortedFindings = useMemo(() => {
    const result = [...filteredFindings];

    switch (sortBy) {
      case 'severity':
        result.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
        break;
      case 'file':
        result.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
        break;
      case 'line':
        result.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
        break;
    }

    return result;
  }, [filteredFindings, sortBy]);

  const groupedFindings = useMemo((): GroupedFindings[] => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All Findings', findings: sortedFindings }];
    }

    const groups = new Map<string, Finding[]>();

    for (const finding of sortedFindings) {
      let key: string;
      switch (groupBy) {
        case 'file':
          key = finding.file;
          break;
        case 'severity':
          key = finding.severity;
          break;
        case 'cwe':
          key = finding.cwe || 'Unknown';
          break;
        default:
          key = 'all';
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(finding);
    }

    const result: GroupedFindings[] = [];
    for (const [key, findings] of groups) {
      let label: string;
      let severity: Finding['severity'] | undefined;

      switch (groupBy) {
        case 'file':
          label = key;
          break;
        case 'severity':
          label = SEVERITY_LABELS[key as Finding['severity']];
          severity = key as Finding['severity'];
          break;
        case 'cwe':
          label = key;
          break;
        default:
          label = key;
      }

      result.push({ key, label, findings, severity });
    }

    if (groupBy === 'severity') {
      result.sort((a, b) => SEVERITY_ORDER[a.severity!] - SEVERITY_ORDER[b.severity!]);
    } else {
      result.sort((a, b) => a.label.localeCompare(b.label));
    }

    return result;
  }, [sortedFindings, groupBy]);

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const VirtualizedRowComponent = useCallback(
    ({ index, style }: { index: number; style: CSSProperties }) => {
      const finding = sortedFindings[index];
      return (
        <div style={{ ...style, paddingRight: 8 }}>
          <FindingCard
            finding={finding}
            onFindingClick={onFindingClick}
            onViewCode={onViewCode}
            onCopy={handleCopy}
          />
        </div>
      );
    },
    [sortedFindings, onFindingClick, onViewCode, handleCopy]
  );

  const renderContent = () => {
    if (sortedFindings.length === 0) {
      return (
        <div
          className="flex flex-col items-center justify-center py-12 text-center"
          role="status"
          aria-live="polite"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{
              background: 'var(--severity-success-bg)',
              border: '1px solid var(--severity-success-border)',
            }}
          >
            <Icon name="check" size="xl" color="var(--severity-success-icon)" />
          </div>
          <h3
            className="font-semibold mb-2"
            style={{
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-lg)',
            }}
          >
            No findings found
          </h3>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {searchQuery || filter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Your code looks clean!'}
          </p>
        </div>
      );
    }

    if (groupBy !== 'none') {
      return (
        <div className="space-y-2">
          {groupedFindings.map((group) => (
            <CollapsibleGroup
              key={group.key}
              group={group}
              isExpanded={expandedGroups.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
              onFindingClick={onFindingClick}
              onViewCode={onViewCode}
              onCopy={handleCopy}
            />
          ))}
        </div>
      );
    }

    if (sortedFindings.length >= VIRTUALIZATION_THRESHOLD) {
      return (
        <List
          rowCount={sortedFindings.length}
          rowHeight={ITEM_HEIGHT}
          rowComponent={VirtualizedRowComponent as any}
          rowProps={{}}
          className="scrollbar-thin"
          role="list"
          aria-label="Security findings"
        />
      );
    }

    return (
      <div className="" role="list" aria-label="Security findings">
        {sortedFindings.map((finding, index) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            onFindingClick={onFindingClick}
            onViewCode={onViewCode}
            onCopy={handleCopy}
            index={index}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex flex-col gap-3 pb-4 mb-4"
        style={{ borderBottom: '1px solid var(--color-border-default)' }}
      >
        <div
          className="flex items-center gap-2 px-3 rounded"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            height: 'var(--input-height)',
            borderRadius: 'var(--input-radius)',
          }}
        >
          <Icon name={CODICONS.ui.search} size="sm" color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search findings..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm"
            style={{
              color: 'var(--input-text)',
              fontSize: 'var(--font-size-sm)',
            }}
            aria-label="Search findings"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="p-1 rounded hover:bg-[var(--color-bg-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
              aria-label="Clear search"
            >
              <Icon name={CODICONS.ui.close} size="xs" color="var(--color-text-muted)" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="severity-filter"
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Filter:
            </label>
            <select
              id="severity-filter"
              value={filter}
              onChange={(e) => onFilterChange(e.target.value as SeverityFilter)}
              className="px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
              style={{
                background: 'var(--dropdown-bg)',
                border: '1px solid var(--dropdown-border)',
                color: 'var(--dropdown-text)',
                borderRadius: 'var(--radius-md)',
              }}
              aria-label="Filter by severity"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="group-by"
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Group:
            </label>
            <select
              id="group-by"
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
              className="px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
              style={{
                background: 'var(--dropdown-bg)',
                border: '1px solid var(--dropdown-border)',
                color: 'var(--dropdown-text)',
                borderRadius: 'var(--radius-md)',
              }}
              aria-label="Group findings by"
            >
              <option value="none">None</option>
              <option value="file">File</option>
              <option value="severity">Severity</option>
              <option value="cwe">CWE</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="sort-by"
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Sort:
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as SortBy)}
              className="px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
              style={{
                background: 'var(--dropdown-bg)',
                border: '1px solid var(--dropdown-border)',
                color: 'var(--dropdown-text)',
                borderRadius: 'var(--radius-md)',
              }}
              aria-label="Sort findings by"
            >
              <option value="severity">Severity</option>
              <option value="file">File</option>
              <option value="line">Line</option>
            </select>
          </div>

          <span
            className="ml-auto text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            aria-live="polite"
          >
            {sortedFindings.length} finding{sortedFindings.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto scrollbar-thin"
        ref={(el) => {
          if (el) {
            const height = el.clientHeight || 400;
            if (height !== listHeight) {
              setListHeight(height);
            }
          }
        }}
      >
        {renderContent()}
      </div>
    </div>
  );
};

export default FindingsList;

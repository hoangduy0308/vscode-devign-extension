import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { type ScanResultPayload, Severity, MessageType, type Vulnerability, type Range } from '../types';
import { vscode } from '../utilities/vscode';
import { state } from '../utilities/messages';

interface ScanResultsProps {
    results: ScanResultPayload;
}

type SortBy = 'severity' | 'file' | 'confidence';
type GroupBy = 'none' | 'file';

// Helper to get severity class suffix
const getSeverityClass = (severity: Severity): string => {
    return severity.toLowerCase();
};

// Severity order for sorting
const severityOrder: Record<Severity, number> = {
    [Severity.CRITICAL]: 0,
    [Severity.HIGH]: 1,
    [Severity.MEDIUM]: 2,
    [Severity.LOW]: 3
};

export const ScanResults: React.FC<ScanResultsProps> = ({ results }) => {
    // State
    const [filters, setFilters] = useState<Set<Severity>>(() => {
        const savedState = state.get();
        if (savedState?.scanResultsFilters && savedState.scanResultsFilters.length > 0) {
            return new Set(savedState.scanResultsFilters as Severity[]);
        }
        return new Set(Object.values(Severity));
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortBy>('severity');
    const [groupBy, setGroupBy] = useState<GroupBy>('none');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [selectedIndex, setSelectedIndex] = useState(-1);
    
    // Refs
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Persist filters when they change
    useEffect(() => {
        state.update({ scanResultsFilters: Array.from(filters) });
    }, [filters]);

    const toggleFilter = (severity: Severity) => {
        const newFilters = new Set(filters);
        if (newFilters.has(severity)) {
            newFilters.delete(severity);
        } else {
            newFilters.add(severity);
        }
        setFilters(newFilters);
    };

    // Filter, search, and sort vulnerabilities
    const processedVulnerabilities = useMemo(() => {
        let vulns = results.vulnerabilities.filter(v => filters.has(v.severity));
        
        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            vulns = vulns.filter(v => 
                v.description.toLowerCase().includes(query) ||
                v.file.toLowerCase().includes(query) ||
                v.type.toLowerCase().includes(query)
            );
        }
        
        // Sort
        vulns = [...vulns].sort((a, b) => {
            switch (sortBy) {
                case 'severity':
                    return severityOrder[a.severity] - severityOrder[b.severity];
                case 'file':
                    return a.file.localeCompare(b.file);
                case 'confidence':
                    return b.confidence - a.confidence;
                default:
                    return 0;
            }
        });
        
        return vulns;
    }, [results.vulnerabilities, filters, searchQuery, sortBy]);

    // Group vulnerabilities by file
    const groupedVulnerabilities = useMemo(() => {
        if (groupBy === 'none') {
            return null;
        }
        
        const groups = new Map<string, Vulnerability[]>();
        processedVulnerabilities.forEach(vuln => {
            const key = vuln.file;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(vuln);
        });
        
        return groups;
    }, [processedVulnerabilities, groupBy]);

    const toggleGroup = (groupKey: string) => {
        const newCollapsed = new Set(collapsedGroups);
        if (newCollapsed.has(groupKey)) {
            newCollapsed.delete(groupKey);
        } else {
            newCollapsed.add(groupKey);
        }
        setCollapsedGroups(newCollapsed);
    };

    const handleOpenFile = (file: string, range: Range) => {
        vscode.postMessage({
            type: MessageType.OPEN_FILE,
            payload: { path: file, range }
        });
    };

    const copyToClipboard = async (vuln: Vulnerability) => {
        const text = `[${vuln.severity}] ${vuln.type}\n${vuln.description}\nFile: ${vuln.file}:${vuln.range.startLine}\nConfidence: ${(vuln.confidence * 100).toFixed(0)}%`;
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const vulns = processedVulnerabilities;
        if (vulns.length === 0) return;

        switch (e.key) {
            case 'j':
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, vulns.length - 1));
                break;
            case 'k':
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                if (selectedIndex >= 0 && selectedIndex < vulns.length) {
                    const vuln = vulns[selectedIndex];
                    handleOpenFile(vuln.file, vuln.range);
                }
                break;
            case 'c':
                if (selectedIndex >= 0 && selectedIndex < vulns.length) {
                    copyToClipboard(vulns[selectedIndex]);
                }
                break;
        }
    }, [processedVulnerabilities, selectedIndex]);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedIndex >= 0 && processedVulnerabilities[selectedIndex]) {
            const vuln = processedVulnerabilities[selectedIndex];
            const element = itemRefs.current.get(vuln.id);
            element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedIndex, processedVulnerabilities]);

    const renderVulnerabilityCard = (vuln: Vulnerability, index: number) => {
        const isSelected = index === selectedIndex;
        
        return (
            <div
                key={vuln.id}
                ref={(el) => { if (el) itemRefs.current.set(vuln.id, el); }}
                role="listitem"
                tabIndex={0}
                className={`vuln-card vuln-card--${getSeverityClass(vuln.severity)} cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] ${isSelected ? 'ring-2 ring-[var(--vscode-focusBorder)]' : ''}`}
                onClick={() => {
                    setSelectedIndex(index);
                    handleOpenFile(vuln.file, vuln.range);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenFile(vuln.file, vuln.range);
                    }
                }}
                aria-label={`${vuln.severity} vulnerability: ${vuln.description}`}
                aria-selected={isSelected}
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
                            onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(vuln);
                            }}
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
    };

    return (
        <div 
            className="p-4 flex flex-col gap-4" 
            onKeyDown={handleKeyDown}
            tabIndex={-1}
        >
            {/* Header / Summary */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
                <h2 className="text-xl font-bold text-[var(--vscode-foreground)] flex items-center gap-2">
                    <i className="codicon codicon-shield" aria-hidden="true"></i>
                    Scan Results
                </h2>
                <div className="text-sm text-[var(--vscode-descriptionForeground)] flex items-center gap-1">
                    <i className="codicon codicon-file-code" aria-hidden="true"></i>
                    {results.filesScanned} files scanned
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <span className="codicon codicon-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
                <input
                    type="text"
                    placeholder="Search by description, file, or type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
                    aria-label="Search vulnerabilities"
                />
            </div>

            {/* Toolbar: Filters, Sort, Group */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* Severity Filters */}
                <div className="flex gap-1" role="group" aria-label="Filter by severity">
                    {(Object.keys(Severity) as Array<keyof typeof Severity>).map((key) => {
                        const sev = Severity[key];
                        const isActive = filters.has(sev);
                        return (
                            <button
                                key={sev}
                                onClick={() => toggleFilter(sev)}
                                aria-pressed={isActive}
                                className={`severity-badge ${isActive ? `severity-badge--${getSeverityClass(sev)}` : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)]'} cursor-pointer hover:opacity-80`}
                            >
                                {sev} ({results.summary[sev.toLowerCase() as keyof typeof results.summary]})
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1" />

                {/* Sort */}
                <div className="flex items-center gap-2">
                    <label htmlFor="sort-select" className="text-xs text-[var(--color-text-secondary)]">Sort:</label>
                    <select
                        id="sort-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                        className="bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded px-2 py-1 text-xs"
                    >
                        <option value="severity">Severity</option>
                        <option value="file">File</option>
                        <option value="confidence">Confidence</option>
                    </select>
                </div>

                {/* Group */}
                <div className="flex items-center gap-2">
                    <label htmlFor="group-select" className="text-xs text-[var(--color-text-secondary)]">Group:</label>
                    <select
                        id="group-select"
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                        className="bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded px-2 py-1 text-xs"
                    >
                        <option value="none">None</option>
                        <option value="file">By File</option>
                    </select>
                </div>
            </div>

            {/* Results count and keyboard hint */}
            <div className="flex justify-between items-center text-xs text-[var(--color-text-secondary)]">
                <span>{processedVulnerabilities.length} vulnerabilities</span>
                <span className="opacity-70">j/k to navigate, Enter to open, c to copy</span>
            </div>

            {/* List */}
            <div ref={listRef} className="flex flex-col gap-3" role="list">
                {processedVulnerabilities.length === 0 ? (
                    <div className="text-center text-[var(--vscode-descriptionForeground)] py-8 flex flex-col items-center gap-2" role="status">
                        <i className="codicon codicon-check text-2xl text-[var(--vscode-charts-green)]" aria-hidden="true"></i>
                        {searchQuery ? 'No vulnerabilities match your search.' : 'No vulnerabilities found matching filters.'}
                    </div>
                ) : groupBy === 'none' ? (
                    processedVulnerabilities.map((vuln, index) => renderVulnerabilityCard(vuln, index))
                ) : (
                    Array.from(groupedVulnerabilities!.entries()).map(([groupKey, vulns]) => {
                        const isCollapsed = collapsedGroups.has(groupKey);
                        const startIndex = processedVulnerabilities.findIndex(v => v.file === groupKey);
                        
                        return (
                            <div key={groupKey} className="border border-[var(--color-border-default)] rounded-lg overflow-hidden">
                                <button
                                    onClick={() => toggleGroup(groupKey)}
                                    className="w-full flex items-center gap-2 p-3 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] text-left"
                                    aria-expanded={!isCollapsed}
                                >
                                    <span className={`codicon ${isCollapsed ? 'codicon-chevron-right' : 'codicon-chevron-down'}`} aria-hidden="true" />
                                    <span className="font-mono text-sm text-[var(--color-text-link)] truncate flex-1">{groupKey}</span>
                                    <span className="text-xs text-[var(--color-text-secondary)]">{vulns.length} issues</span>
                                </button>
                                {!isCollapsed && (
                                    <div className="flex flex-col gap-2 p-2">
                                        {vulns.map((vuln, idx) => renderVulnerabilityCard(vuln, startIndex + idx))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

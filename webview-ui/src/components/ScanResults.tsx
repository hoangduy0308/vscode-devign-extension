import React, { useState, useMemo, useEffect } from 'react';
import { type ScanResultPayload, Severity, MessageType } from '../types';
import { vscode } from '../utilities/vscode';
import { state } from '../utilities/messages';

interface ScanResultsProps {
    results: ScanResultPayload;
}

// Helper to get severity class suffix
const getSeverityClass = (severity: Severity): string => {
    return severity.toLowerCase();
};

export const ScanResults: React.FC<ScanResultsProps> = ({ results }) => {
    // Restore filters from persisted state or default to all severities
    const [filters, setFilters] = useState<Set<Severity>>(() => {
        const savedState = state.get();
        if (savedState?.scanResultsFilters && savedState.scanResultsFilters.length > 0) {
            return new Set(savedState.scanResultsFilters as Severity[]);
        }
        return new Set(Object.values(Severity));
    });

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

    const filteredVulnerabilities = useMemo(() => {
        return results.vulnerabilities.filter(v => filters.has(v.severity));
    }, [results.vulnerabilities, filters]);

    const handleOpenFile = (file: string, range: any) => {
        vscode.postMessage({
            type: MessageType.OPEN_FILE,
            payload: { path: file, range }
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent, file: string, range: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpenFile(file, range);
        }
    };

    return (
        <div className="p-4 flex flex-col gap-4">
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

            {/* Filters */}
            <div className="flex gap-2" role="group" aria-label="Filter by severity">
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

            {/* List */}
            <div className="flex flex-col gap-3" role="list">
                {filteredVulnerabilities.length === 0 ? (
                    <div className="text-center text-[var(--vscode-descriptionForeground)] py-8 flex flex-col items-center gap-2" role="status">
                        <i className="codicon codicon-check text-2xl text-[var(--vscode-charts-green)]" aria-hidden="true"></i>
                        No vulnerabilities found matching filters.
                    </div>
                ) : (
                    filteredVulnerabilities.map((vuln) => (
                        <div
                            key={vuln.id}
                            role="listitem"
                            tabIndex={0}
                            className={`vuln-card vuln-card--${getSeverityClass(vuln.severity)} cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]`}
                            onClick={() => handleOpenFile(vuln.file, vuln.range)}
                            onKeyDown={(e) => handleKeyDown(e, vuln.file, vuln.range)}
                            aria-label={`${vuln.severity} vulnerability: ${vuln.description}`}
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
                                <span className="text-xs text-[var(--color-text-secondary)]">
                                    Conf: {(vuln.confidence * 100).toFixed(0)}%
                                </span>
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
                    ))
                )}
            </div>
        </div>
    );
};
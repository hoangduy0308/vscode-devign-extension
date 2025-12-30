import React, { useState, useMemo } from 'react';
import { type ScanResultPayload, Severity, MessageType } from '../types';
import { vscode } from '../utilities/vscode';

interface ScanResultsProps {
    results: ScanResultPayload;
}

const SeverityColors = {
    [Severity.CRITICAL]: 'bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-errorForeground)] border border-[var(--vscode-inputValidation-errorBorder)]',
    [Severity.HIGH]: 'bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-editorWarning-foreground)] border border-[var(--vscode-inputValidation-warningBorder)]',
    [Severity.MEDIUM]: 'bg-[var(--vscode-inputValidation-infoBackground)] text-[var(--vscode-editorInfo-foreground)] border border-[var(--vscode-inputValidation-infoBorder)]',
    [Severity.LOW]: 'bg-[var(--vscode-editor-inactiveSelectionBackground)] text-[var(--vscode-foreground)] border border-[var(--vscode-editor-selectionHighlightBorder)]'
};

export const ScanResults: React.FC<ScanResultsProps> = ({ results }) => {
    const [filters, setFilters] = useState<Set<Severity>>(new Set(Object.values(Severity)));

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
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${isActive
                                ? SeverityColors[sev]
                                : 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] border-[var(--vscode-button-border)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]'
                                }`}
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
                            className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer bg-[var(--vscode-editor-background)] border-[var(--vscode-panel-border)] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
                            onClick={() => handleOpenFile(vuln.file, vuln.range)}
                            onKeyDown={(e) => handleKeyDown(e, vuln.file, vuln.range)}
                            aria-label={`${vuln.severity} vulnerability: ${vuln.description}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex gap-2 items-center">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${SeverityColors[vuln.severity]}`}>
                                        {vuln.severity}
                                    </span>
                                    <span className="font-mono text-xs text-[var(--vscode-descriptionForeground)]">
                                        {vuln.type}
                                    </span>
                                </div>
                                <span className="text-xs text-[var(--vscode-descriptionForeground)]">
                                    Conf: {(vuln.confidence * 100).toFixed(0)}%
                                </span>
                            </div>

                            <p className="text-sm mb-2 font-medium text-[var(--vscode-foreground)]">{vuln.description}</p>

                            <div className="text-xs text-[var(--vscode-textLink-foreground)] font-mono truncate" title={vuln.file}>
                                {vuln.file}:{vuln.range.startLine}
                            </div>

                            {vuln.snippet && (
                                <pre className="mt-2 p-2 bg-[var(--vscode-textBlockQuote-background)] border border-[var(--vscode-textBlockQuote-border)] rounded text-xs overflow-x-auto font-mono text-[var(--vscode-foreground)]">
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
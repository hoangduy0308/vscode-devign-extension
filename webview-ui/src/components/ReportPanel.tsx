import React, { useState, useEffect } from 'react';
import { state } from '../utilities/messages';

export interface ReportVulnerability {
    id: string;
    ruleId: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    file: string;
    line: number;
    endLine?: number;
    snippet?: string;
    probability?: number;
    functionName?: string;
}

export interface ReportSummary {
    totalVulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    filesAffected: number;
    scanTime: string;
    toolName: string;
    toolVersion: string;
}

export interface ReportData {
    summary: ReportSummary;
    vulnerabilities: ReportVulnerability[];
    generatedAt: string;
}

interface ReportPanelProps {
    data: ReportData;
    onExport?: () => void;
    onVulnerabilityClick?: (vuln: ReportVulnerability) => void;
}

type SeverityFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const severityIcons: Record<string, string> = {
    CRITICAL: 'codicon-error',
    HIGH: 'codicon-warning',
    MEDIUM: 'codicon-info',
    LOW: 'codicon-check'
};

// Helper to get severity class suffix
const getSeverityClass = (severity: string): string => {
    return severity.toLowerCase();
};

export const ReportPanel: React.FC<ReportPanelProps> = ({
    data,
    onExport,
    onVulnerabilityClick
}) => {
    // Restore filter and sort from persisted state
    const [filter, setFilter] = useState<SeverityFilter>(() => {
        const savedState = state.get();
        return savedState?.reportFilter || 'ALL';
    });
    const [sortBy, setSortBy] = useState<'severity' | 'file'>(() => {
        const savedState = state.get();
        return savedState?.reportSortBy || 'severity';
    });

    // Persist filter when it changes
    useEffect(() => {
        state.update({ reportFilter: filter });
    }, [filter]);

    // Persist sortBy when it changes
    useEffect(() => {
        state.update({ reportSortBy: sortBy });
    }, [sortBy]);

    const filteredVulns = data.vulnerabilities
        .filter(v => filter === 'ALL' || v.severity === filter)
        .sort((a, b) => {
            if (sortBy === 'severity') {
                const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                return order[a.severity] - order[b.severity];
            }
            return a.file.localeCompare(b.file);
        });

    const handleVulnClick = (vuln: ReportVulnerability) => {
        if (onVulnerabilityClick) {
            onVulnerabilityClick(vuln);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <SummaryCard 
                    value={data.summary.totalVulnerabilities} 
                    label="Total" 
                />
                <SummaryCard 
                    value={data.summary.critical} 
                    label="Critical" 
                    severityClass="critical"
                />
                <SummaryCard 
                    value={data.summary.high} 
                    label="High" 
                    severityClass="high"
                />
                <SummaryCard 
                    value={data.summary.medium} 
                    label="Medium" 
                    severityClass="medium"
                />
                <SummaryCard 
                    value={data.summary.low} 
                    label="Low" 
                    severityClass="low"
                />
                <SummaryCard 
                    value={data.summary.filesAffected} 
                    label="Files" 
                />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <label 
                        htmlFor="severity-filter"
                        className="text-sm text-[var(--vscode-descriptionForeground)]"
                    >
                        Filter:
                    </label>
                    <select
                        id="severity-filter"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as SeverityFilter)}
                        className="bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded px-2 py-1 text-sm"
                    >
                        <option value="ALL">All Severities</option>
                        <option value="CRITICAL">Critical Only</option>
                        <option value="HIGH">High Only</option>
                        <option value="MEDIUM">Medium Only</option>
                        <option value="LOW">Low Only</option>
                    </select>

                    <label 
                        htmlFor="sort-by"
                        className="text-sm text-[var(--vscode-descriptionForeground)] ml-4"
                    >
                        Sort:
                    </label>
                    <select
                        id="sort-by"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'severity' | 'file')}
                        className="bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded px-2 py-1 text-sm"
                    >
                        <option value="severity">By Severity</option>
                        <option value="file">By File</option>
                    </select>
                </div>

                {onExport && (
                    <button
                        onClick={onExport}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)] text-sm font-medium"
                    >
                        <span className="codicon codicon-export"></span>
                        Export Report
                    </button>
                )}
            </div>

            {/* Vulnerability List */}
            <div className="flex flex-col gap-2">
                {filteredVulns.length > 0 ? (
                    filteredVulns.map(vuln => (
                        <VulnerabilityCard 
                            key={vuln.id} 
                            vuln={vuln}
                            onClick={() => handleVulnClick(vuln)}
                        />
                    ))
                ) : (
                    <div className="text-center py-8 text-[var(--vscode-descriptionForeground)]">
                        <span className="codicon codicon-shield text-4xl mb-2 block opacity-50"></span>
                        {filter === 'ALL' 
                            ? 'No vulnerabilities found. Your code looks secure!'
                            : `No ${filter.toLowerCase()} severity vulnerabilities found.`}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-[var(--vscode-descriptionForeground)] pt-4 border-t border-[var(--vscode-panel-border)]">
                Generated at {new Date(data.generatedAt).toLocaleString()} by {data.summary.toolName} v{data.summary.toolVersion}
            </div>
        </div>
    );
};

interface SummaryCardProps {
    value: number;
    label: string;
    severityClass?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ value, label, severityClass }) => (
    <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg p-3 text-center">
        <span className={`text-2xl font-bold block ${severityClass ? `summary-value--${severityClass}` : ''}`}>
            {value}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
            {label}
        </span>
    </div>
);

interface VulnerabilityCardProps {
    vuln: ReportVulnerability;
    onClick?: () => void;
}

const VulnerabilityCard: React.FC<VulnerabilityCardProps> = ({ vuln, onClick }) => {
    const severityClass = getSeverityClass(vuln.severity);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
        }
    };

    return (
        <div 
            className={`vuln-card vuln-card--${severityClass} cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]`}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            aria-label={`${vuln.severity} vulnerability: ${vuln.message}`}
        >
            <div className="flex items-center gap-3 mb-2">
                <span className={`severity-badge severity-badge--${severityClass}`}>
                    <span className={`codicon ${severityIcons[vuln.severity]}`}></span>
                    {vuln.severity}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                    {vuln.ruleId}
                </span>
                {vuln.probability !== undefined && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                        {(vuln.probability * 100).toFixed(1)}% confidence
                    </span>
                )}
            </div>

            <p className="text-sm mb-2">{vuln.message}</p>

            <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-text-link)]">{vuln.file}</span>
                <span>Line {vuln.line}{vuln.endLine && vuln.endLine !== vuln.line ? `-${vuln.endLine}` : ''}</span>
                {vuln.functionName && <span>in {vuln.functionName}()</span>}
            </div>

            {vuln.snippet && (
                <pre className="mt-2 p-2 bg-[var(--vscode-textCodeBlock-background)] rounded text-xs overflow-x-auto">
                    {vuln.snippet}
                </pre>
            )}
        </div>
    );
};

export default ReportPanel;

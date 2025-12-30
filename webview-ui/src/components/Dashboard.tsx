import React from 'react';

interface DashboardProps {
    stats: {
        totalScans: number;
        vulnerabilitiesFound: number;
        criticalIssues: number;
    };
    modelVersion: string;
    lastScanTime: string | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, modelVersion, lastScanTime }) => {
    return (
        <div className="p-4 bg-[var(--vscode-editor-background)] rounded-lg shadow-sm border border-[var(--vscode-panel-border)]">
            <h2 className="text-lg font-bold mb-4 text-[var(--vscode-foreground)]">Dashboard</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-3 bg-[var(--vscode-textBlockQuote-background)] rounded-lg border border-[var(--vscode-textBlockQuote-border)]">
                    <div className="text-xs text-[var(--vscode-descriptionForeground)] uppercase font-semibold">Total Scans</div>
                    <div className="text-2xl font-bold text-[var(--vscode-textLink-foreground)]">{stats.totalScans}</div>
                </div>
                <div className="p-3 bg-[var(--vscode-inputValidation-errorBackground)] rounded-lg border border-[var(--vscode-inputValidation-errorBorder)]">
                    <div className="text-xs text-[var(--vscode-descriptionForeground)] uppercase font-semibold">Vulnerabilities</div>
                    <div className="text-2xl font-bold text-[var(--vscode-errorForeground)]">{stats.vulnerabilitiesFound}</div>
                </div>
                <div className="p-3 bg-[var(--vscode-inputValidation-warningBackground)] rounded-lg border border-[var(--vscode-inputValidation-warningBorder)]">
                    <div className="text-xs text-[var(--vscode-descriptionForeground)] uppercase font-semibold">Critical</div>
                    <div className="text-2xl font-bold text-[var(--vscode-editorWarning-foreground)]">{stats.criticalIssues}</div>
                </div>
            </div>

            <div className="flex justify-between text-sm text-[var(--vscode-descriptionForeground)] border-t pt-3 border-[var(--vscode-panel-border)]">
                <div>
                    <span className="font-medium">Model Version:</span> {modelVersion}
                </div>
                <div>
                    <span className="font-medium">Last Scan:</span> {lastScanTime || 'Never'}
                </div>
            </div>
        </div>
    );
};
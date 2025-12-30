import React from 'react';

interface GitPanelProps {
    branch: string;
    stagedFiles: string[];
    unstagedFiles: string[];
}

export const GitPanel: React.FC<GitPanelProps> = ({ branch, stagedFiles, unstagedFiles }) => {
    return (
        <div className="p-4 bg-[var(--vscode-editor-background)] rounded-lg shadow-sm border border-[var(--vscode-panel-border)]">
            <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-[var(--vscode-foreground)]">Git Status</h2>
                <span className="px-2 py-0.5 bg-[var(--vscode-textBlockQuote-background)] rounded text-xs font-mono text-[var(--vscode-textBlockQuote-border)]">
                    {branch}
                </span>
            </div>

            <div className="flex flex-col gap-4">
                <div role="region" aria-label="Staged Changes">
                    <h3 className="text-xs font-semibold text-[var(--vscode-descriptionForeground)] uppercase mb-2">
                        Staged Changes ({stagedFiles.length})
                    </h3>
                    {stagedFiles.length === 0 ? (
                        <div className="text-sm text-[var(--vscode-disabledForeground)] italic">No staged files</div>
                    ) : (
                        <ul className="space-y-1" role="list">
                            {stagedFiles.map((file, idx) => (
                                <li key={idx} className="text-sm font-mono text-[var(--vscode-gitDecoration-addedResourceForeground)] truncate" role="listitem">
                                    {file}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div role="region" aria-label="Unstaged Changes">
                    <h3 className="text-xs font-semibold text-[var(--vscode-descriptionForeground)] uppercase mb-2">
                        Unstaged Changes ({unstagedFiles.length})
                    </h3>
                    {unstagedFiles.length === 0 ? (
                        <div className="text-sm text-[var(--vscode-disabledForeground)] italic">No unstaged files</div>
                    ) : (
                        <ul className="space-y-1" role="list">
                            {unstagedFiles.map((file, idx) => (
                                <li key={idx} className="text-sm font-mono text-[var(--vscode-gitDecoration-modifiedResourceForeground)] truncate" role="listitem">
                                    {file}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};
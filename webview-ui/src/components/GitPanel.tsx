import React from 'react';

interface GitPanelProps {
    branch: string;
    branches: string[];
    stagedFiles: string[];
    unstagedFiles: string[];
    onBranchChange: (branch: string) => void;
    onCreateBranch: (name: string) => void;
    onDeleteBranch: (name: string) => void;
    onStageFile: (file: string) => void;
    onUnstageFile: (file: string) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({
    branch,
    branches,
    stagedFiles,
    unstagedFiles,
    onBranchChange,
    onCreateBranch,
    onDeleteBranch,
    onStageFile,
    onUnstageFile
}) => {
    const [isCreatingBranch, setIsCreatingBranch] = React.useState(false);
    const [newBranchName, setNewBranchName] = React.useState('');

    const handleCreateBranch = () => {
        if (newBranchName) {
            onCreateBranch(newBranchName);
            setIsCreatingBranch(false);
            setNewBranchName('');
        }
    };

    return (
        <div className="p-4 bg-[var(--vscode-editor-background)] rounded-lg shadow-sm border border-[var(--vscode-panel-border)]">
            <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[var(--vscode-foreground)]">Git Status</h2>
                    <button
                        onClick={() => setIsCreatingBranch(!isCreatingBranch)}
                        className="px-2 py-1 text-xs bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)]"
                    >
                        New Branch
                    </button>
                </div>

                {isCreatingBranch && (
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            placeholder="New branch name"
                            className="flex-1 px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded"
                        />
                        <button
                            onClick={handleCreateBranch}
                            className="px-2 py-1 text-xs bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded"
                        >
                            Create
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--vscode-descriptionForeground)]">Current:</span>
                    <select
                        value={branch}
                        onChange={(e) => onBranchChange(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] border border-[var(--vscode-dropdown-border)] rounded"
                    >
                        {branches.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div role="region" aria-label="Staged Changes">
                    <h3 className="text-xs font-semibold text-[var(--vscode-descriptionForeground)] uppercase mb-2">
                        Staged Changes ({stagedFiles.length})
                    </h3>
                    {stagedFiles.length === 0 ? (
                        <div className="text-sm text-[var(--vscode-disabledForeground)] italic">No staged files</div>
                    ) : (
                        <ul className="space-y-1 group" role="list">
                            {stagedFiles.map((file, idx) => (
                                <li key={idx} className="flex items-center justify-between text-sm font-mono text-[var(--vscode-gitDecoration-addedResourceForeground)]" role="listitem">
                                    <span className="truncate flex-1">{file}</span>
                                    <button
                                        onClick={() => onUnstageFile(file)}
                                        className="ml-2 opacity-0 group-hover:opacity-100 hover:opacity-100 px-1.5 text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] rounded"
                                        title="Unstage file"
                                    >
                                        -
                                    </button>
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
                        <ul className="space-y-1 group" role="list">
                            {unstagedFiles.map((file, idx) => (
                                <li key={idx} className="flex items-center justify-between text-sm font-mono text-[var(--vscode-gitDecoration-modifiedResourceForeground)]" role="listitem">
                                    <span className="truncate flex-1">{file}</span>
                                    <button
                                        onClick={() => onStageFile(file)}
                                        className="ml-2 opacity-0 group-hover:opacity-100 hover:opacity-100 px-1.5 text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] rounded"
                                        title="Stage file"
                                    >
                                        +
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};
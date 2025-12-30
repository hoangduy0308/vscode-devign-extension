import React from 'react';

interface GitPanelProps {
    branch: string;
    branches: string[];
    stagedFiles: string[];
    unstagedFiles: string[];
    remotes?: string[];
    isPushing?: boolean;
    isPulling?: boolean;
    onBranchChange: (branch: string) => void;
    onCreateBranch: (name: string) => void;
    onDeleteBranch: (name: string) => void;
    onStageFile: (file: string) => void;
    onUnstageFile: (file: string) => void;
    onPush?: (remote?: string) => void;
    onPull?: (remote?: string) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({
    branch,
    branches,
    stagedFiles,
    unstagedFiles,
    remotes = ['origin'],
    isPushing = false,
    isPulling = false,
    onBranchChange,
    onCreateBranch,
    // @ts-ignore
    onDeleteBranch,
    onStageFile,
    onUnstageFile,
    onPush,
    onPull
}) => {
    const [isCreatingBranch, setIsCreatingBranch] = React.useState(false);
    const [newBranchName, setNewBranchName] = React.useState('');
    const [commitMessage, setCommitMessage] = React.useState('');
    const [selectedRemote, setSelectedRemote] = React.useState(remotes[0] || 'origin');

    const handleCreateBranch = () => {
        if (newBranchName) {
            onCreateBranch(newBranchName);
            setIsCreatingBranch(false);
            setNewBranchName('');
        }
    };

    const handleCommit = () => {
        if (commitMessage) {
            // Send commit message to extension
            // @ts-ignore
            window.vscode.postMessage({
                type: 'GIT_ACTION',
                payload: {
                    action: 'commit',
                    data: { message: commitMessage }
                }
            });
            setCommitMessage('');
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
                {/* Commit Section */}
                <div className="flex flex-col gap-2">
                    <textarea
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Commit message..."
                        className="w-full px-2 py-1 text-sm bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded resize-none h-20 focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
                    />
                    <button
                        onClick={handleCommit}
                        disabled={!commitMessage || stagedFiles.length === 0}
                        className="w-full px-3 py-1.5 text-sm font-medium bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Commit
                    </button>
                </div>

                {/* Push/Pull Section */}
                <div className="flex flex-col gap-2">
                    {remotes.length > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--vscode-descriptionForeground)]">Remote:</span>
                            <select
                                value={selectedRemote}
                                onChange={(e) => setSelectedRemote(e.target.value)}
                                className="flex-1 px-2 py-1 text-xs bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] border border-[var(--vscode-dropdown-border)] rounded"
                            >
                                {remotes.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={() => onPull?.(selectedRemote)}
                            disabled={isPulling || isPushing}
                            className="flex-1 px-3 py-1.5 text-sm font-medium bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] rounded hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                            {isPulling ? (
                                <>
                                    <span className="animate-spin">↻</span>
                                    Pulling...
                                </>
                            ) : (
                                '↓ Pull'
                            )}
                        </button>
                        <button
                            onClick={() => onPush?.(selectedRemote)}
                            disabled={isPushing || isPulling}
                            className="flex-1 px-3 py-1.5 text-sm font-medium bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] rounded hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                            {isPushing ? (
                                <>
                                    <span className="animate-spin">↻</span>
                                    Pushing...
                                </>
                            ) : (
                                '↑ Push'
                            )}
                        </button>
                    </div>
                </div>

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
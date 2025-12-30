import React from 'react';

export type GateStatus = 'PASSED' | 'FAILED' | 'WARNING' | 'PENDING';

interface SecurityGateProps {
    status: GateStatus;
    progress: number; // 0 to 100
    onAllowCommit: () => void;
    onBlockCommit: () => void;
}

const StatusColors = {
    PASSED: 'text-[var(--vscode-testing-iconPassed)]',
    FAILED: 'text-[var(--vscode-testing-iconFailed)]',
    WARNING: 'text-[var(--vscode-editorWarning-foreground)]',
    PENDING: 'text-[var(--vscode-descriptionForeground)]'
};

export const SecurityGate: React.FC<SecurityGateProps> = ({ status, progress, onAllowCommit, onBlockCommit }) => {
    return (
        <div className="p-4 bg-[var(--vscode-editor-background)] rounded-lg shadow-sm border border-[var(--vscode-panel-border)]">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-[var(--vscode-foreground)]">Security Gate</h2>
                <span className={`font-bold ${StatusColors[status]}`} role="status" aria-label={`Security gate status: ${status}`}>
                    {status}
                </span>
            </div>

            <div
                className="w-full bg-[var(--vscode-progressBar-background)] rounded-full h-2.5 mb-4 overflow-hidden"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Scan progress"
            >
                <div
                    className={`h-2.5 transition-all duration-500 ${status === 'FAILED' ? 'bg-[var(--vscode-testing-iconFailed)]' :
                        status === 'WARNING' ? 'bg-[var(--vscode-editorWarning-foreground)]' :
                            status === 'PASSED' ? 'bg-[var(--vscode-testing-iconPassed)]' : 'bg-[var(--vscode-progressBar-background)]'
                        }`}
                    style={{ width: `${progress}%` }}
                ></div>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={onAllowCommit}
                    disabled={status === 'FAILED'}
                    aria-disabled={status === 'FAILED'}
                    className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] ${status === 'FAILED'
                        ? 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-disabledForeground)] cursor-not-allowed'
                        : 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]'
                        }`}
                >
                    Allow Commit
                </button>
                <button
                    onClick={onBlockCommit}
                    className="flex-1 py-2 px-4 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] rounded text-sm font-medium hover:bg-[var(--vscode-button-secondaryHoverBackground)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
                >
                    Block Commit
                </button>
            </div>
        </div>
    );
};
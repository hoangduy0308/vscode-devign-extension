import * as vscode from 'vscode';

/**
 * Git extension API types (from vscode.git extension)
 * These are minimal type definitions for the parts we use
 */
interface GitExtension {
    readonly enabled: boolean;
    readonly onDidChangeEnablement: vscode.Event<boolean>;
    getAPI(version: 1): API;
}

interface API {
    readonly state: 'uninitialized' | 'initialized';
    readonly onDidChangeState: vscode.Event<'uninitialized' | 'initialized'>;
    readonly repositories: Repository[];
    readonly onDidOpenRepository: vscode.Event<Repository>;
    readonly onDidCloseRepository: vscode.Event<Repository>;
}

interface Repository {
    readonly rootUri: vscode.Uri;
    readonly inputBox: { value: string };
    readonly state: RepositoryState;
}

interface RepositoryState {
    readonly HEAD: Branch | undefined;
    readonly remotes: Remote[];
    readonly workingTreeChanges: Change[];
    readonly indexChanges: Change[];
    readonly mergeChanges: Change[];
}

interface Branch {
    readonly name: string | undefined;
    readonly commit: string | undefined;
    readonly upstream?: { name: string; remote: string };
}

interface Remote {
    readonly name: string;
    readonly fetchUrl: string | undefined;
    readonly pushUrl: string | undefined;
}

interface Change {
    readonly uri: vscode.Uri;
    readonly originalUri: vscode.Uri;
    readonly status: number;
}

/**
 * Git change status codes from VS Code Git extension
 */
export enum GitChangeStatus {
    Modified = 0,
    Added = 1,
    Deleted = 2,
    Renamed = 3,
    Copied = 4,
    Untracked = 5,
    Ignored = 6,
    Conflict = 7
}

/**
 * Normalized file change with status letter
 */
export interface FileChange {
    filePath: string;
    uri: vscode.Uri;
    originalUri: vscode.Uri;
    status: GitChangeStatus;
    statusLetter: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?' | '!';
}

/**
 * Repository state snapshot containing staged, unstaged, and merge changes
 */
export interface RepositorySnapshot {
    /** Staged files (index changes) - ready for commit */
    staged: FileChange[];
    /** Unstaged files (working tree changes) - modified but not staged */
    unstaged: FileChange[];
    /** Merge conflict files */
    mergeConflicts: FileChange[];
    /** Whether repository is in merge state */
    isMerging: boolean;
    /** Repository root path */
    rootPath: string;
    /** Current branch name */
    branchName: string | undefined;
    /** Last commit hash */
    commitHash: string | undefined;
}

/**
 * Service for interacting with VS Code's built-in Git extension.
 * Provides access to Git repositories in the workspace.
 */
export class GitService {
    private gitExtension: GitExtension | undefined;
    private api: API | undefined;
    private initializationPromise: Promise<void> | undefined;

    constructor() {
        this.initializationPromise = this.initialize();
    }

    /**
     * Initialize the Git service by binding to the VS Code Git extension.
     */
    private async initialize(): Promise<void> {
        const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
        
        if (!extension) {
            console.log('GitService: Git extension not found');
            return;
        }

        if (!extension.isActive) {
            try {
                await extension.activate();
            } catch (error) {
                console.error('GitService: Failed to activate Git extension:', error);
                return;
            }
        }

        this.gitExtension = extension.exports;
        
        if (!this.gitExtension.enabled) {
            console.log('GitService: Git extension is disabled');
            return;
        }

        this.api = this.gitExtension.getAPI(1);
        console.log('GitService: Successfully initialized with Git extension');
    }

    /**
     * Ensures the service is initialized before performing operations.
     */
    private async ensureInitialized(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    /**
     * Check if the Git extension is available and enabled.
     * @returns true if Git functionality is available
     */
    public async isAvailable(): Promise<boolean> {
        await this.ensureInitialized();
        return this.api !== undefined && this.gitExtension?.enabled === true;
    }

    /**
     * Get all Git repositories in the current workspace.
     * @returns Array of Repository objects, or empty array if Git is unavailable
     */
    public async getRepositories(): Promise<Repository[]> {
        await this.ensureInitialized();
        
        if (!this.api) {
            console.log('GitService: Cannot get repositories - Git API not available');
            return [];
        }

        return this.api.repositories;
    }

    /**
     * Get the currently active Git repository.
     * In multi-root workspaces, returns the repository containing the active editor's file,
     * or the first repository if no editor is active.
     * @returns The active Repository, or undefined if none available
     */
    public async getActiveRepository(): Promise<Repository | undefined> {
        await this.ensureInitialized();
        
        if (!this.api) {
            console.log('GitService: Cannot get active repository - Git API not available');
            return undefined;
        }

        const repositories = this.api.repositories;
        
        if (repositories.length === 0) {
            console.log('GitService: No git repositories found in workspace');
            return undefined;
        }

        if (repositories.length === 1) {
            return repositories[0];
        }

        // Multi-root workspace: try to find repo containing active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const activeUri = activeEditor.document.uri;
            for (const repo of repositories) {
                if (activeUri.fsPath.startsWith(repo.rootUri.fsPath)) {
                    return repo;
                }
            }
        }

        // Fall back to first repository
        return repositories[0];
    }

    /**
     * Get a human-readable status message about Git availability.
     * Useful for displaying in UI or diagnostics.
     * @returns Status message describing Git availability
     */
    public async getStatusMessage(): Promise<string> {
        await this.ensureInitialized();

        const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
        
        if (!extension) {
            return 'Git extension not installed';
        }

        if (!this.gitExtension?.enabled) {
            return 'Git extension is disabled';
        }

        if (!this.api) {
            return 'Git API not available';
        }

        const repos = this.api.repositories;
        if (repos.length === 0) {
            return 'No Git repository found in workspace';
        }

        return `Git available: ${repos.length} repository(s) found`;
    }

    /**
     * Register a callback for when repositories are opened or closed.
     * @param onOpen Callback when a repository is opened
     * @param onClose Callback when a repository is closed
     * @returns Disposable to unregister the callbacks
     */
    public async onRepositoryChange(
        onOpen?: (repo: Repository) => void,
        onClose?: (repo: Repository) => void
    ): Promise<vscode.Disposable> {
        await this.ensureInitialized();

        const disposables: vscode.Disposable[] = [];

        if (this.api) {
            if (onOpen) {
                disposables.push(this.api.onDidOpenRepository(onOpen));
            }
            if (onClose) {
                disposables.push(this.api.onDidCloseRepository(onClose));
            }
        }

        return vscode.Disposable.from(...disposables);
    }

    /**
     * Convert Git change status number to status letter
     */
    private statusToLetter(status: number): FileChange['statusLetter'] {
        switch (status) {
            case GitChangeStatus.Added: return 'A';
            case GitChangeStatus.Modified: return 'M';
            case GitChangeStatus.Deleted: return 'D';
            case GitChangeStatus.Renamed: return 'R';
            case GitChangeStatus.Copied: return 'C';
            case GitChangeStatus.Untracked: return '?';
            case GitChangeStatus.Ignored: return '!';
            case GitChangeStatus.Conflict: return 'U';
            default: return 'M';
        }
    }

    /**
     * Convert VS Code Git Change to normalized FileChange
     */
    private normalizeChange(change: Change): FileChange {
        return {
            filePath: change.uri.fsPath,
            uri: change.uri,
            originalUri: change.originalUri,
            status: change.status as GitChangeStatus,
            statusLetter: this.statusToLetter(change.status)
        };
    }

    /**
     * Get a snapshot of repository state including staged, unstaged, and merge changes.
     * @param repo Optional specific repository. If not provided, uses active repository.
     * @returns Repository snapshot or undefined if no repository available
     */
    public async getRepositorySnapshot(repo?: Repository): Promise<RepositorySnapshot | undefined> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            console.log('GitService: Cannot get snapshot - no repository available');
            return undefined;
        }

        const state = repository.state;
        const mergeChanges = state.mergeChanges || [];

        return {
            staged: state.indexChanges.map(c => this.normalizeChange(c)),
            unstaged: state.workingTreeChanges.map(c => this.normalizeChange(c)),
            mergeConflicts: mergeChanges.map(c => this.normalizeChange(c)),
            isMerging: mergeChanges.length > 0,
            rootPath: repository.rootUri.fsPath,
            branchName: state.HEAD?.name,
            commitHash: state.HEAD?.commit
        };
    }

    /**
     * Get only staged C/C++ files ready for commit.
     * @returns Array of FileChange for staged C/C++ files
     */
    public async getStagedCppFiles(): Promise<FileChange[]> {
        const snapshot = await this.getRepositorySnapshot();
        if (!snapshot) {
            return [];
        }

        return snapshot.staged.filter(f => 
            f.filePath.endsWith('.c') || 
            f.filePath.endsWith('.cpp') || 
            f.filePath.endsWith('.h') ||
            f.filePath.endsWith('.hpp') ||
            f.filePath.endsWith('.cc') ||
            f.filePath.endsWith('.cxx')
        );
    }

    /**
     * Get all modified C/C++ files (staged + unstaged) based on gate scope.
     * @param scope 'staged' for only staged files, 'staged+unstaged' for both
     * @returns Array of FileChange for modified C/C++ files
     */
    public async getModifiedCppFiles(scope: 'staged' | 'staged+unstaged' = 'staged'): Promise<FileChange[]> {
        const snapshot = await this.getRepositorySnapshot();
        if (!snapshot) {
            return [];
        }

        const isCppFile = (f: FileChange) =>
            f.filePath.endsWith('.c') || 
            f.filePath.endsWith('.cpp') || 
            f.filePath.endsWith('.h') ||
            f.filePath.endsWith('.hpp') ||
            f.filePath.endsWith('.cc') ||
            f.filePath.endsWith('.cxx');

        if (scope === 'staged') {
            return snapshot.staged.filter(isCppFile);
        }

        // Combine staged + unstaged, dedupe by file path
        const allFiles = [...snapshot.staged, ...snapshot.unstaged];
        const seen = new Set<string>();
        return allFiles.filter(f => {
            if (seen.has(f.filePath) || !isCppFile(f)) {
                return false;
            }
            seen.add(f.filePath);
            return true;
        });
    }
}

// Export types for consumers
export type { Repository, RepositoryState, Branch, Remote, Change };

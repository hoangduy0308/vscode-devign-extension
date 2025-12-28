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
    
    // Diff methods
    diffWithHEAD(path?: string): Promise<string>;
    diffIndexWithHEAD(path?: string): Promise<string>;
    diffWith(ref: string, path?: string): Promise<string>;
    diffIndexWith(ref: string, path?: string): Promise<string>;
    
    // Git operations
    commit(message: string, opts?: { all?: boolean; amend?: boolean; signoff?: boolean }): Promise<void>;
    push(remoteName?: string, branchName?: string, setUpstream?: boolean): Promise<void>;
    pull(unshallow?: boolean): Promise<void>;
    fetch(options?: { remote?: string; ref?: string; all?: boolean; prune?: boolean }): Promise<void>;
    
    // Staging operations
    add(paths: vscode.Uri[]): Promise<void>;
    revert(paths: vscode.Uri[]): Promise<void>;
    clean(paths: vscode.Uri[]): Promise<void>;
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
 * Structured diff result for a single file
 */
export interface FileDiff {
    filePath: string;
    staged: string | undefined;
    unstaged: string | undefined;
}

/**
 * Result of a git operation
 */
export interface GitOperationResult {
    success: boolean;
    error?: string;
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

    // ==================== GIT-03: Diff Provider ====================

    /**
     * Get diff of unstaged changes for a specific file or all files.
     * Shows changes in working tree that are not yet staged.
     * @param filePath Optional file path. If not provided, returns diff for all files.
     * @param repo Optional specific repository.
     * @returns Diff string in unified format, or undefined if unavailable
     */
    public async getDiffUnstaged(filePath?: string, repo?: Repository): Promise<string | undefined> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            console.log('GitService: Cannot get diff - no repository available');
            return undefined;
        }

        try {
            return await repository.diffWithHEAD(filePath);
        } catch (error) {
            console.error('GitService: Failed to get unstaged diff:', error);
            return undefined;
        }
    }

    /**
     * Get diff of staged changes for a specific file or all files.
     * Shows changes that are staged (in index) but not yet committed.
     * @param filePath Optional file path. If not provided, returns diff for all files.
     * @param repo Optional specific repository.
     * @returns Diff string in unified format, or undefined if unavailable
     */
    public async getDiffStaged(filePath?: string, repo?: Repository): Promise<string | undefined> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            console.log('GitService: Cannot get diff - no repository available');
            return undefined;
        }

        try {
            return await repository.diffIndexWithHEAD(filePath);
        } catch (error) {
            console.error('GitService: Failed to get staged diff:', error);
            return undefined;
        }
    }

    /**
     * Get diff comparing a file or all files against a specific git ref (branch, tag, or commit).
     * @param ref Git reference to compare against (e.g., 'main', 'HEAD~1', 'v1.0.0')
     * @param filePath Optional file path. If not provided, returns diff for all files.
     * @param repo Optional specific repository.
     * @returns Diff string in unified format, or undefined if unavailable
     */
    public async getDiffWithRef(ref: string, filePath?: string, repo?: Repository): Promise<string | undefined> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            console.log('GitService: Cannot get diff - no repository available');
            return undefined;
        }

        try {
            return await repository.diffWith(ref, filePath);
        } catch (error) {
            console.error(`GitService: Failed to get diff with ref ${ref}:`, error);
            return undefined;
        }
    }

    /**
     * Get diff of staged changes against a specific git ref.
     * @param ref Git reference to compare against
     * @param filePath Optional file path.
     * @param repo Optional specific repository.
     * @returns Diff string in unified format, or undefined if unavailable
     */
    public async getDiffStagedWithRef(ref: string, filePath?: string, repo?: Repository): Promise<string | undefined> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            console.log('GitService: Cannot get diff - no repository available');
            return undefined;
        }

        try {
            return await repository.diffIndexWith(ref, filePath);
        } catch (error) {
            console.error(`GitService: Failed to get staged diff with ref ${ref}:`, error);
            return undefined;
        }
    }

    /**
     * Get both staged and unstaged diffs for a specific file.
     * @param filePath Path to the file
     * @param repo Optional specific repository
     * @returns Object containing both staged and unstaged diffs
     */
    public async getFileDiff(filePath: string, repo?: Repository): Promise<{ staged: string | undefined; unstaged: string | undefined }> {
        const [staged, unstaged] = await Promise.all([
            this.getDiffStaged(filePath, repo),
            this.getDiffUnstaged(filePath, repo)
        ]);

        return { staged, unstaged };
    }

    /**
     * Get diffs for all changed files in the repository.
     * @param repo Optional specific repository
     * @returns Array of file diffs with both staged and unstaged changes
     */
    public async getAllFileDiffs(repo?: Repository): Promise<Array<{ filePath: string; staged: string | undefined; unstaged: string | undefined }>> {
        const snapshot = await this.getRepositorySnapshot(repo);
        if (!snapshot) {
            return [];
        }

        // Collect unique file paths from staged and unstaged changes
        const filePaths = new Set<string>();
        snapshot.staged.forEach(f => filePaths.add(f.filePath));
        snapshot.unstaged.forEach(f => filePaths.add(f.filePath));

        // Get diffs for each file in parallel
        const results = await Promise.all(
            Array.from(filePaths).map(async filePath => {
                const diff = await this.getFileDiff(filePath, repo);
                return { filePath, ...diff };
            })
        );

        return results;
    }

    // ==================== GIT-04: Git Operation Wrappers ====================

    /**
     * Commit staged changes with the given message.
     * @param message Commit message
     * @param options Optional commit options
     * @param repo Optional specific repository
     * @returns Operation result
     */
    public async commit(
        message: string,
        options?: { all?: boolean; amend?: boolean; signoff?: boolean },
        repo?: Repository
    ): Promise<{ success: boolean; error?: string }> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            return { success: false, error: 'No repository available' };
        }

        try {
            await repository.commit(message, options);
            console.log('GitService: Commit successful');
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GitService: Commit failed:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Push commits to remote repository.
     * @param remoteName Optional remote name (default: origin)
     * @param branchName Optional branch name (default: current branch)
     * @param setUpstream Whether to set upstream tracking
     * @param repo Optional specific repository
     * @returns Operation result
     */
    public async push(
        remoteName?: string,
        branchName?: string,
        setUpstream?: boolean,
        repo?: Repository
    ): Promise<{ success: boolean; error?: string }> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            return { success: false, error: 'No repository available' };
        }

        try {
            await repository.push(remoteName, branchName, setUpstream);
            console.log('GitService: Push successful');
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GitService: Push failed:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Pull changes from remote repository.
     * @param unshallow Whether to unshallow a shallow clone
     * @param repo Optional specific repository
     * @returns Operation result
     */
    public async pull(unshallow?: boolean, repo?: Repository): Promise<{ success: boolean; error?: string }> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            return { success: false, error: 'No repository available' };
        }

        try {
            await repository.pull(unshallow);
            console.log('GitService: Pull successful');
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GitService: Pull failed:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Fetch changes from remote without merging.
     * @param options Fetch options
     * @param repo Optional specific repository
     * @returns Operation result
     */
    public async fetch(
        options?: { remote?: string; ref?: string; all?: boolean; prune?: boolean },
        repo?: Repository
    ): Promise<{ success: boolean; error?: string }> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            return { success: false, error: 'No repository available' };
        }

        try {
            await repository.fetch(options);
            console.log('GitService: Fetch successful');
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GitService: Fetch failed:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Stage files for commit.
     * @param uris File URIs to stage
     * @param repo Optional specific repository
     * @returns Operation result
     */
    public async stage(uris: vscode.Uri[], repo?: Repository): Promise<{ success: boolean; error?: string }> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            return { success: false, error: 'No repository available' };
        }

        try {
            await repository.add(uris);
            console.log(`GitService: Staged ${uris.length} file(s)`);
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GitService: Stage failed:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Unstage files (revert from index to HEAD).
     * @param uris File URIs to unstage
     * @param repo Optional specific repository
     * @returns Operation result
     */
    public async unstage(uris: vscode.Uri[], repo?: Repository): Promise<{ success: boolean; error?: string }> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            return { success: false, error: 'No repository available' };
        }

        try {
            await repository.revert(uris);
            console.log(`GitService: Unstaged ${uris.length} file(s)`);
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GitService: Unstage failed:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Discard changes in working directory (clean).
     * @param uris File URIs to clean
     * @param repo Optional specific repository
     * @returns Operation result
     */
    public async discardChanges(uris: vscode.Uri[], repo?: Repository): Promise<{ success: boolean; error?: string }> {
        await this.ensureInitialized();

        const repository = repo || await this.getActiveRepository();
        if (!repository) {
            return { success: false, error: 'No repository available' };
        }

        try {
            await repository.clean(uris);
            console.log(`GitService: Discarded changes in ${uris.length} file(s)`);
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('GitService: Discard changes failed:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }
}

// Export types for consumers
export type { Repository, RepositoryState, Branch, Remote, Change };

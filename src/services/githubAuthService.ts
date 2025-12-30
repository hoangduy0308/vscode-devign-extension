import * as vscode from 'vscode';

/**
 * GitHub Authentication Service
 * Uses VS Code's built-in GitHub authentication provider.
 * No OAuth secrets needed - leverages vscode.authentication API.
 */

export interface GitHubUser {
    id: string;
    login: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
}

export interface GitHubAuthSession {
    accessToken: string;
    account: {
        id: string;
        label: string;
    };
    scopes: readonly string[];
}

/**
 * GitHub scopes required for different operations
 */
export const GitHubScopes = {
    /** Read user profile */
    USER_READ: 'read:user',
    /** Read user email */
    USER_EMAIL: 'user:email',
    /** Full repo access (required for PR creation) */
    REPO: 'repo',
    /** Read-only repo access */
    REPO_READ: 'public_repo',
} as const;

/**
 * Default scopes for Devign extension
 * - read:user: Get user info
 * - user:email: Get user email for commits
 * - repo: Full repo access for PR creation and SARIF upload
 */
const DEFAULT_SCOPES = [
    GitHubScopes.USER_READ,
    GitHubScopes.USER_EMAIL,
    GitHubScopes.REPO
];

/**
 * GitHub Authentication Service
 * Provides secure authentication via VS Code's built-in GitHub auth provider.
 */
export class GitHubAuthService {
    private static instance: GitHubAuthService | null = null;
    private currentSession: vscode.AuthenticationSession | null = null;
    private sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationSession | null>();
    private disposables: vscode.Disposable[] = [];

    /** Event fired when authentication session changes */
    public readonly onSessionChange = this.sessionChangeEmitter.event;

    private constructor() {
        // Listen for session changes from VS Code
        this.disposables.push(
            vscode.authentication.onDidChangeSessions(async (e) => {
                if (e.provider.id === 'github') {
                    // Refresh our cached session
                    await this.refreshSession();
                }
            })
        );
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): GitHubAuthService {
        if (!GitHubAuthService.instance) {
            GitHubAuthService.instance = new GitHubAuthService();
        }
        return GitHubAuthService.instance;
    }

    /**
     * Check if user is currently authenticated
     */
    public async isAuthenticated(): Promise<boolean> {
        try {
            const session = await this.getSession({ createIfNone: false, silent: true });
            return session !== null;
        } catch {
            return false;
        }
    }

    /**
     * Get current session without prompting user
     */
    public async getSessionSilent(): Promise<vscode.AuthenticationSession | null> {
        return this.getSession({ createIfNone: false, silent: true });
    }

    /**
     * Get current session, prompting user to sign in if not authenticated
     */
    public async getSessionInteractive(): Promise<vscode.AuthenticationSession | null> {
        return this.getSession({ createIfNone: true });
    }

    /**
     * Get GitHub authentication session
     * @param options Authentication options
     * @returns Authentication session or null
     */
    public async getSession(options: {
        createIfNone?: boolean;
        silent?: boolean;
        scopes?: string[];
    } = {}): Promise<vscode.AuthenticationSession | null> {
        const scopes = options.scopes || DEFAULT_SCOPES;

        try {
            const session = await vscode.authentication.getSession(
                'github',
                scopes,
                {
                    createIfNone: options.createIfNone ?? false,
                    silent: options.silent ?? false
                }
            );

            if (session) {
                this.currentSession = session;
                this.sessionChangeEmitter.fire(session);
            }

            return session ?? null;
        } catch (error) {
            console.error('GitHubAuthService: Failed to get session:', error);
            return null;
        }
    }

    /**
     * Sign in to GitHub
     * Prompts user to authenticate if not already signed in
     * @returns Authentication session or null if user cancelled
     */
    public async signIn(): Promise<vscode.AuthenticationSession | null> {
        try {
            const session = await this.getSessionInteractive();
            
            if (session) {
                vscode.window.showInformationMessage(
                    `Signed in to GitHub as ${session.account.label}`
                );
            }
            
            return session;
        } catch (error) {
            if (error instanceof Error && error.message.includes('cancelled')) {
                console.log('GitHubAuthService: User cancelled sign in');
                return null;
            }
            console.error('GitHubAuthService: Sign in failed:', error);
            vscode.window.showErrorMessage('Failed to sign in to GitHub');
            return null;
        }
    }

    /**
     * Sign out from GitHub
     * Note: VS Code doesn't provide a direct sign-out API.
     * This clears our cached session and directs user to Accounts menu.
     */
    public async signOut(): Promise<void> {
        this.currentSession = null;
        this.sessionChangeEmitter.fire(null);
        
        vscode.window.showInformationMessage(
            'To fully sign out, go to Accounts (bottom left) and remove the GitHub account.',
            'Open Accounts'
        ).then(selection => {
            if (selection === 'Open Accounts') {
                vscode.commands.executeCommand('workbench.action.accounts.manage');
            }
        });
    }

    /**
     * Get the access token for API calls
     * @param options Options for getting token
     * @returns Access token or null
     */
    public async getAccessToken(options?: { 
        createIfNone?: boolean;
        silent?: boolean;
    }): Promise<string | null> {
        const session = await this.getSession(options);
        return session?.accessToken ?? null;
    }

    /**
     * Get current user info from cached session
     */
    public getCurrentUser(): { id: string; label: string } | null {
        return this.currentSession?.account ?? null;
    }

    /**
     * Fetch detailed user info from GitHub API
     */
    public async fetchUserInfo(): Promise<GitHubUser | null> {
        const token = await this.getAccessToken({ silent: true });
        if (!token) {
            return null;
        }

        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Devign-VSCode-Extension'
                }
            });

            if (!response.ok) {
                console.error('GitHubAuthService: Failed to fetch user info:', response.status);
                return null;
            }

            const data = await response.json() as {
                id: number;
                login: string;
                name?: string;
                email?: string;
                avatar_url?: string;
            };
            return {
                id: String(data.id),
                login: data.login,
                name: data.name,
                email: data.email,
                avatarUrl: data.avatar_url
            };
        } catch (error) {
            console.error('GitHubAuthService: Error fetching user info:', error);
            return null;
        }
    }

    /**
     * Refresh the cached session
     */
    private async refreshSession(): Promise<void> {
        const session = await this.getSession({ silent: true });
        if (session !== this.currentSession) {
            this.currentSession = session;
            this.sessionChangeEmitter.fire(session);
        }
    }

    /**
     * Check if we have specific scopes
     */
    public async hasScopes(requiredScopes: string[]): Promise<boolean> {
        const session = await this.getSessionSilent();
        if (!session) {
            return false;
        }

        return requiredScopes.every(scope => session.scopes.includes(scope));
    }

    /**
     * Request additional scopes if needed
     */
    public async ensureScopes(requiredScopes: string[]): Promise<vscode.AuthenticationSession | null> {
        const currentScopes = this.currentSession?.scopes ?? [];
        const allScopes = [...new Set([...currentScopes, ...requiredScopes])];

        // If we already have all scopes, return current session
        if (requiredScopes.every(scope => currentScopes.includes(scope))) {
            return this.currentSession;
        }

        // Request session with expanded scopes
        return this.getSession({
            createIfNone: true,
            scopes: allScopes
        });
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.sessionChangeEmitter.dispose();
        GitHubAuthService.instance = null;
    }
}

/**
 * Get the GitHub authentication service instance
 */
export function getGitHubAuthService(): GitHubAuthService {
    return GitHubAuthService.getInstance();
}

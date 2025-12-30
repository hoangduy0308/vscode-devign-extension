import * as vscode from 'vscode';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { GitHubAuthService, getGitHubAuthService } from './githubAuthService';
import { GitService } from './gitService';
import { SarifLog } from './sarifExportService';

const gzip = promisify(zlib.gzip);

/**
 * Result of SARIF upload operation
 */
export interface SarifUploadResult {
    success: boolean;
    sarifId?: string;
    analysisUrl?: string;
    error?: string;
}

/**
 * Options for SARIF upload
 */
export interface SarifUploadOptions {
    ref?: string;
    commitSha?: string;
    tool?: string;
}

/**
 * GitHub SARIF Upload Service
 * 
 * Uploads SARIF results to GitHub Code Scanning API.
 * Requires user consent before upload.
 */
export class GitHubSarifUploadService {
    private authService: GitHubAuthService;
    private gitService: GitService;

    constructor(gitService: GitService) {
        this.authService = getGitHubAuthService();
        this.gitService = gitService;
    }

    /**
     * Upload SARIF to GitHub Code Scanning with user consent
     */
    async uploadWithConsent(
        sarifLog: SarifLog,
        options: SarifUploadOptions = {}
    ): Promise<SarifUploadResult> {
        const consent = await this.promptForConsent();
        if (!consent) {
            return {
                success: false,
                error: 'User declined to upload SARIF results'
            };
        }

        return this.upload(sarifLog, options);
    }

    /**
     * Upload SARIF to GitHub Code Scanning API
     */
    async upload(
        sarifLog: SarifLog,
        options: SarifUploadOptions = {}
    ): Promise<SarifUploadResult> {
        const token = await this.authService.getAccessToken({ createIfNone: true });
        if (!token) {
            return {
                success: false,
                error: 'GitHub authentication required'
            };
        }

        const repoInfo = await this.getRepositoryInfo();
        if (!repoInfo) {
            return {
                success: false,
                error: 'Could not determine repository owner/name from remote URL'
            };
        }

        const ref = options.ref || await this.getCurrentRef();
        const commitSha = options.commitSha || await this.getCurrentCommitSha();

        if (!ref || !commitSha) {
            return {
                success: false,
                error: 'Could not determine git ref or commit SHA'
            };
        }

        try {
            const sarifContent = JSON.stringify(sarifLog);
            const gzipped = await gzip(Buffer.from(sarifContent));
            const base64Sarif = gzipped.toString('base64');

            const response = await fetch(
                `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/code-scanning/sarifs`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Devign-VSCode-Extension'
                    },
                    body: JSON.stringify({
                        commit_sha: commitSha,
                        ref: ref,
                        sarif: base64Sarif,
                        tool_name: options.tool || 'Devign Vulnerability Scanner'
                    })
                }
            );

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('GitHub SARIF upload failed:', response.status, errorBody);
                
                if (response.status === 403) {
                    return {
                        success: false,
                        error: 'GitHub Code Scanning is not enabled for this repository. Enable it in repository settings.'
                    };
                }
                
                if (response.status === 404) {
                    return {
                        success: false,
                        error: 'Repository not found or insufficient permissions. Ensure you have write access.'
                    };
                }

                return {
                    success: false,
                    error: `GitHub API error: ${response.status} - ${errorBody}`
                };
            }

            const result = await response.json() as { id: string; url: string };
            
            vscode.window.showInformationMessage(
                `✅ SARIF uploaded to GitHub Code Scanning`,
                'View Results'
            ).then(selection => {
                if (selection === 'View Results') {
                    vscode.env.openExternal(vscode.Uri.parse(
                        `https://github.com/${repoInfo.owner}/${repoInfo.repo}/security/code-scanning`
                    ));
                }
            });

            return {
                success: true,
                sarifId: result.id,
                analysisUrl: result.url
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('SARIF upload error:', error);
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Prompt user for consent before uploading
     */
    private async promptForConsent(): Promise<boolean> {
        const result = await vscode.window.showWarningMessage(
            'Upload scan results to GitHub Code Scanning?',
            {
                modal: true,
                detail: 'This will upload your SARIF vulnerability scan results to GitHub Code Scanning. The results will be visible in your repository\'s Security tab.'
            },
            'Upload',
            'Cancel'
        );

        return result === 'Upload';
    }

    /**
     * Get repository owner and name from git remote
     */
    private async getRepositoryInfo(): Promise<{ owner: string; repo: string } | null> {
        const snapshot = await this.gitService.getRepositorySnapshot();
        if (!snapshot) {
            return null;
        }

        // Get remotes from the repository
        const repo = await this.gitService.getActiveRepository();
        if (!repo) {
            return null;
        }

        const remotes = repo.state.remotes;
        const origin = remotes.find(r => r.name === 'origin') || remotes[0];
        
        if (!origin?.fetchUrl && !origin?.pushUrl) {
            return null;
        }

        const remoteUrl = origin.fetchUrl || origin.pushUrl || '';
        return this.parseGitHubUrl(remoteUrl);
    }

    /**
     * Parse GitHub owner/repo from various URL formats
     */
    private parseGitHubUrl(url: string): { owner: string; repo: string } | null {
        // SSH format: git@github.com:owner/repo.git
        const sshMatch = url.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
        if (sshMatch) {
            return { owner: sshMatch[1], repo: sshMatch[2] };
        }

        // HTTPS format: https://github.com/owner/repo.git
        const httpsMatch = url.match(/https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
        if (httpsMatch) {
            return { owner: httpsMatch[1], repo: httpsMatch[2] };
        }

        return null;
    }

    /**
     * Get current git ref (e.g., refs/heads/main)
     */
    private async getCurrentRef(): Promise<string | null> {
        const branch = await this.gitService.getCurrentBranch();
        if (!branch) {
            return null;
        }
        return `refs/heads/${branch}`;
    }

    /**
     * Get current commit SHA
     */
    private async getCurrentCommitSha(): Promise<string | null> {
        const snapshot = await this.gitService.getRepositorySnapshot();
        return snapshot?.commitHash || null;
    }

    /**
     * Check if GitHub Code Scanning is available for the repository
     */
    async isCodeScanningAvailable(): Promise<boolean> {
        const token = await this.authService.getAccessToken({ silent: true });
        if (!token) {
            return false;
        }

        const repoInfo = await this.getRepositoryInfo();
        if (!repoInfo) {
            return false;
        }

        try {
            const response = await fetch(
                `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/code-scanning/alerts`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Devign-VSCode-Extension'
                    }
                }
            );

            // 200 = enabled, 403 = not enabled, 404 = repo not found
            return response.ok;
        } catch {
            return false;
        }
    }
}

let sarifUploadServiceInstance: GitHubSarifUploadService | null = null;

export function getGitHubSarifUploadService(gitService: GitService): GitHubSarifUploadService {
    if (!sarifUploadServiceInstance) {
        sarifUploadServiceInstance = new GitHubSarifUploadService(gitService);
    }
    return sarifUploadServiceInstance;
}

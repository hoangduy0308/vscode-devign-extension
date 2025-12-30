import * as vscode from 'vscode';
import { GitHubAuthService, getGitHubAuthService } from './githubAuthService';
import { GitService, RepositorySnapshot } from './gitService';
import { SarifLog, SarifResult, getSarifExportService } from './sarifExportService';

/**
 * GitHub Pull Request Service
 * Creates PRs with auto-generated scan summary in the body.
 */

/**
 * Repository info extracted from git remote URL
 */
export interface RepoInfo {
    owner: string;
    repo: string;
    fullName: string;
}

/**
 * PR creation options
 */
export interface CreatePROptions {
    title: string;
    body?: string;
    base?: string;     // Target branch (default: main or master)
    head?: string;     // Source branch (default: current branch)
    draft?: boolean;
    includeScanSummary?: boolean;
    sarifLog?: SarifLog;
}

/**
 * PR creation result
 */
export interface CreatePRResult {
    success: boolean;
    prNumber?: number;
    prUrl?: string;
    error?: string;
}

/**
 * Scan summary for PR body
 */
export interface ScanSummary {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    filesScanned: number;
    functionsScanned: number;
    scanDate: string;
    findings: SummaryFinding[];
}

export interface SummaryFinding {
    file: string;
    function: string;
    line: number;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    probability: number;
    message: string;
}

/**
 * GitHub Pull Request Service
 */
export class PRService {
    private authService: GitHubAuthService;
    private gitService: GitService;

    constructor(gitService: GitService) {
        this.authService = getGitHubAuthService();
        this.gitService = gitService;
    }

    /**
     * Parse GitHub remote URL to extract owner and repo
     */
    public parseRemoteUrl(url: string | undefined): RepoInfo | null {
        if (!url) {
            return null;
        }

        // Handle SSH format: git@github.com:owner/repo.git
        const sshMatch = url.match(/git@github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/);
        if (sshMatch) {
            return {
                owner: sshMatch[1],
                repo: sshMatch[2],
                fullName: `${sshMatch[1]}/${sshMatch[2]}`
            };
        }

        // Handle HTTPS format: https://github.com/owner/repo.git
        const httpsMatch = url.match(/https?:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/);
        if (httpsMatch) {
            return {
                owner: httpsMatch[1],
                repo: httpsMatch[2],
                fullName: `${httpsMatch[1]}/${httpsMatch[2]}`
            };
        }

        return null;
    }

    /**
     * Get repository info from current workspace
     */
    public async getRepoInfo(): Promise<RepoInfo | null> {
        const snapshot = await this.gitService.getRepositorySnapshot();
        if (!snapshot) {
            return null;
        }

        const repos = await this.gitService.getRepositories();
        if (repos.length === 0) {
            return null;
        }

        const repo = repos[0];
        const remotes = repo.state.remotes;
        
        // Try origin first, then any remote
        const origin = remotes.find(r => r.name === 'origin');
        const remote = origin || remotes[0];
        
        if (!remote) {
            return null;
        }

        return this.parseRemoteUrl(remote.pushUrl || remote.fetchUrl);
    }

    /**
     * Generate scan summary from SARIF log
     */
    public generateScanSummary(sarifLog: SarifLog): ScanSummary {
        const results = sarifLog.runs[0]?.results || [];
        
        let criticalCount = 0;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;
        
        const findings: SummaryFinding[] = [];
        const filesSet = new Set<string>();
        const functionsSet = new Set<string>();

        for (const result of results) {
            const probability = (result.properties?.probability as number) || 0;
            const severity = this.getSeverityFromResult(result);
            
            switch (severity) {
                case 'CRITICAL': criticalCount++; break;
                case 'HIGH': highCount++; break;
                case 'MEDIUM': mediumCount++; break;
                case 'LOW': lowCount++; break;
            }

            const location = result.locations?.[0];
            const physicalLocation = location?.physicalLocation;
            const uri = physicalLocation?.artifactLocation?.uri || 'unknown';
            const line = physicalLocation?.region?.startLine || 0;
            const funcName = location?.logicalLocations?.[0]?.name || 'unknown';

            filesSet.add(uri);
            functionsSet.add(`${uri}::${funcName}`);

            findings.push({
                file: uri,
                function: funcName,
                line,
                severity,
                probability,
                message: result.message.text || 'Potential vulnerability detected'
            });
        }

        return {
            totalFindings: results.length,
            criticalCount,
            highCount,
            mediumCount,
            lowCount,
            filesScanned: filesSet.size,
            functionsScanned: functionsSet.size,
            scanDate: new Date().toISOString(),
            findings: findings.slice(0, 10) // Top 10 findings
        };
    }

    /**
     * Get severity from SARIF result
     */
    private getSeverityFromResult(result: SarifResult): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
        const probability = (result.properties?.probability as number) || 0;
        
        if (probability >= 0.9) return 'CRITICAL';
        if (probability >= 0.75) return 'HIGH';
        if (probability >= 0.5) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Generate PR body markdown with scan summary
     */
    public generatePRBody(summary: ScanSummary, customBody?: string): string {
        const lines: string[] = [];

        if (customBody) {
            lines.push(customBody);
            lines.push('');
            lines.push('---');
            lines.push('');
        }

        lines.push('## 🔒 Devign Security Scan Summary');
        lines.push('');
        lines.push(`**Scan Date:** ${new Date(summary.scanDate).toLocaleString()}`);
        lines.push(`**Files Scanned:** ${summary.filesScanned} | **Functions:** ${summary.functionsScanned}`);
        lines.push('');

        // Summary badges
        if (summary.totalFindings === 0) {
            lines.push('✅ **No vulnerabilities detected!**');
        } else {
            lines.push('### Findings Overview');
            lines.push('');
            lines.push('| Severity | Count |');
            lines.push('|----------|-------|');
            if (summary.criticalCount > 0) {
                lines.push(`| 🔴 Critical | ${summary.criticalCount} |`);
            }
            if (summary.highCount > 0) {
                lines.push(`| 🟠 High | ${summary.highCount} |`);
            }
            if (summary.mediumCount > 0) {
                lines.push(`| 🟡 Medium | ${summary.mediumCount} |`);
            }
            if (summary.lowCount > 0) {
                lines.push(`| 🟢 Low | ${summary.lowCount} |`);
            }
            lines.push('');

            // Top findings
            if (summary.findings.length > 0) {
                lines.push('### Top Findings');
                lines.push('');
                lines.push('| File | Function | Line | Severity | Probability |');
                lines.push('|------|----------|------|----------|-------------|');
                
                for (const finding of summary.findings) {
                    const severityEmoji = this.getSeverityEmoji(finding.severity);
                    lines.push(`| \`${finding.file}\` | \`${finding.function}\` | ${finding.line} | ${severityEmoji} ${finding.severity} | ${(finding.probability * 100).toFixed(1)}% |`);
                }
                lines.push('');
            }
        }

        lines.push('---');
        lines.push('');
        lines.push('*Generated by [Devign Vulnerability Scanner](https://github.com/hoangduy0308/vscode-devign-extension)*');

        return lines.join('\n');
    }

    private getSeverityEmoji(severity: string): string {
        switch (severity) {
            case 'CRITICAL': return '🔴';
            case 'HIGH': return '🟠';
            case 'MEDIUM': return '🟡';
            case 'LOW': return '🟢';
            default: return '⚪';
        }
    }

    /**
     * Create a Pull Request on GitHub
     */
    public async createPR(options: CreatePROptions): Promise<CreatePRResult> {
        // Ensure user is authenticated
        const token = await this.authService.getAccessToken({ createIfNone: true });
        if (!token) {
            return { success: false, error: 'GitHub authentication required' };
        }

        // Get repo info
        const repoInfo = await this.getRepoInfo();
        if (!repoInfo) {
            return { success: false, error: 'Could not determine GitHub repository' };
        }

        // Get current branch
        const currentBranch = await this.gitService.getCurrentBranch();
        if (!currentBranch) {
            return { success: false, error: 'Could not determine current branch' };
        }

        const head = options.head || currentBranch;
        const base = options.base || await this.getDefaultBranch(repoInfo, token) || 'main';

        // Generate body with scan summary if requested
        let body = options.body || '';
        if (options.includeScanSummary && options.sarifLog) {
            const summary = this.generateScanSummary(options.sarifLog);
            body = this.generatePRBody(summary, options.body);
        }

        try {
            const response = await fetch(
                `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Devign-VSCode-Extension'
                    },
                    body: JSON.stringify({
                        title: options.title,
                        body,
                        head,
                        base,
                        draft: options.draft || false
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json() as { message?: string; errors?: Array<{ message?: string }> };
                const errorMsg = errorData.message || `HTTP ${response.status}`;
                console.error('PRService: Failed to create PR:', errorMsg);
                return { success: false, error: errorMsg };
            }

            const data = await response.json() as { number: number; html_url: string };
            
            return {
                success: true,
                prNumber: data.number,
                prUrl: data.html_url
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('PRService: Error creating PR:', errorMsg);
            return { success: false, error: errorMsg };
        }
    }

    /**
     * Get default branch for repository
     */
    private async getDefaultBranch(repoInfo: RepoInfo, token: string): Promise<string | null> {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Devign-VSCode-Extension'
                    }
                }
            );

            if (!response.ok) {
                return null;
            }

            const data = await response.json() as { default_branch?: string };
            return data.default_branch || null;
        } catch {
            return null;
        }
    }

    /**
     * Show PR creation dialog
     */
    public async showCreatePRDialog(sarifLog?: SarifLog): Promise<void> {
        // Check auth first
        const isAuthed = await this.authService.isAuthenticated();
        if (!isAuthed) {
            const signIn = await vscode.window.showInformationMessage(
                'Please sign in to GitHub to create a Pull Request',
                'Sign In'
            );
            if (signIn === 'Sign In') {
                await this.authService.signIn();
            }
            return;
        }

        // Get current branch
        const currentBranch = await this.gitService.getCurrentBranch();
        if (!currentBranch) {
            vscode.window.showErrorMessage('No active branch found');
            return;
        }

        // Prompt for PR title
        const title = await vscode.window.showInputBox({
            prompt: 'Enter Pull Request title',
            value: `Feature: ${currentBranch}`,
            validateInput: (value) => value.trim() ? null : 'Title is required'
        });

        if (!title) {
            return; // User cancelled
        }

        // Prompt for base branch
        const branches = await this.gitService.getBranches({ includeRemote: true });
        const remoteBranches = branches
            .filter(b => b.type === 'remote' && !b.name?.includes(currentBranch))
            .map(b => b.name?.replace(/^origin\//, '') || '')
            .filter(Boolean);

        const defaultBase = remoteBranches.includes('main') ? 'main' : 
                          remoteBranches.includes('master') ? 'master' : 
                          remoteBranches[0] || 'main';

        const base = await vscode.window.showQuickPick(
            [...new Set(['main', 'master', ...remoteBranches])],
            {
                placeHolder: 'Select target branch',
                title: 'Base Branch'
            }
        ) || defaultBase;

        // Ask about scan summary
        let includeSummary = false;
        if (sarifLog && sarifLog.runs[0]?.results?.length > 0) {
            const includeChoice = await vscode.window.showQuickPick(
                ['Yes, include scan summary', 'No, skip scan summary'],
                { placeHolder: 'Include Devign scan summary in PR body?' }
            );
            includeSummary = includeChoice?.startsWith('Yes') || false;
        }

        // Prompt for additional description
        const description = await vscode.window.showInputBox({
            prompt: 'Enter PR description (optional)',
            placeHolder: 'Describe your changes...'
        });

        // Create the PR
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Creating Pull Request...',
                cancellable: false
            },
            async () => {
                return this.createPR({
                    title,
                    body: description,
                    base,
                    head: currentBranch,
                    includeScanSummary: includeSummary,
                    sarifLog
                });
            }
        );

        if (result.success) {
            const openPR = await vscode.window.showInformationMessage(
                `Pull Request #${result.prNumber} created successfully!`,
                'Open in Browser'
            );
            if (openPR && result.prUrl) {
                vscode.env.openExternal(vscode.Uri.parse(result.prUrl));
            }
        } else {
            vscode.window.showErrorMessage(`Failed to create PR: ${result.error}`);
        }
    }

    /**
     * Get list of open PRs for current repo
     */
    public async getOpenPRs(): Promise<Array<{ number: number; title: string; url: string }>> {
        const token = await this.authService.getAccessToken({ silent: true });
        if (!token) {
            return [];
        }

        const repoInfo = await this.getRepoInfo();
        if (!repoInfo) {
            return [];
        }

        try {
            const response = await fetch(
                `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls?state=open`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Devign-VSCode-Extension'
                    }
                }
            );

            if (!response.ok) {
                return [];
            }

            const data = await response.json() as Array<{ number: number; title: string; html_url: string }>;
            return data.map(pr => ({
                number: pr.number,
                title: pr.title,
                url: pr.html_url
            }));
        } catch {
            return [];
        }
    }
}

// Singleton instance
let prServiceInstance: PRService | null = null;

export function getPRService(gitService: GitService): PRService {
    if (!prServiceInstance) {
        prServiceInstance = new PRService(gitService);
    }
    return prServiceInstance;
}

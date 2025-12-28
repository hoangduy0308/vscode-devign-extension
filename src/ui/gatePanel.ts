import * as vscode from 'vscode';
import { AggregatedGateResult } from '../services/securityGateService';
import { ConfigurationService, getConfigurationService } from '../services/configurationService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GateTreeItemType = 'status' | 'lastRun' | 'separator' | 'action' | 'findingsHeader' | 'finding';

export interface GateTreeItem {
    type: GateTreeItemType;
    label: string;
    description?: string;
    tooltip?: string;
    icon?: string;
    iconColor?: string;
    command?: vscode.Command;
    children?: GateTreeItem[];
    severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    filePath?: string;
    line?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Severity Configuration
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<string, { icon: string; color: string }> = {
    'CRITICAL': { icon: 'error', color: 'errorForeground' },
    'HIGH': { icon: 'error', color: 'errorForeground' },
    'MEDIUM': { icon: 'warning', color: 'editorWarning.foreground' },
    'LOW': { icon: 'warning', color: 'editorWarning.foreground' },
    'INFO': { icon: 'info', color: 'editorInfo.foreground' }
};

// ─────────────────────────────────────────────────────────────────────────────
// GatePanelProvider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TreeDataProvider for displaying security gate status in the sidebar.
 * 
 * Displays:
 * - Gate status (Enabled/Disabled)
 * - Last run info (time, scope, decision)
 * - Quick actions: Run Gate, View Report, Configure
 * - Recent findings summary (top 5)
 */
export class GatePanelProvider implements vscode.TreeDataProvider<GateTreeItem>, vscode.Disposable {
    private _onDidChangeTreeData: vscode.EventEmitter<GateTreeItem | undefined | null | void> =
        new vscode.EventEmitter<GateTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<GateTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private configService: ConfigurationService;
    private lastRunResult: AggregatedGateResult | null = null;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.configService = getConfigurationService();

        // Listen for configuration changes to refresh the panel
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('devign.gate')) {
                    this.refresh();
                }
            })
        );
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this._onDidChangeTreeData.dispose();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Update the last run result and refresh the view
     * @param result The aggregated gate result from the last run
     */
    updateLastRun(result: AggregatedGateResult): void {
        this.lastRunResult = result;
        this.refresh();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TreeDataProvider Implementation
    // ─────────────────────────────────────────────────────────────────────────

    getTreeItem(element: GateTreeItem): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label);

        // Set collapsible state
        if (element.children && element.children.length > 0) {
            item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        } else {
            item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }

        // Set icon
        if (element.icon) {
            if (element.iconColor) {
                item.iconPath = new vscode.ThemeIcon(element.icon, new vscode.ThemeColor(element.iconColor));
            } else if (element.severity && SEVERITY_ICONS[element.severity]) {
                const config = SEVERITY_ICONS[element.severity];
                item.iconPath = new vscode.ThemeIcon(config.icon, new vscode.ThemeColor(config.color));
            } else {
                item.iconPath = new vscode.ThemeIcon(element.icon);
            }
        }

        // Set command
        if (element.command) {
            item.command = element.command;
        }

        // Set description
        if (element.description) {
            item.description = element.description;
        }

        // Set tooltip
        if (element.tooltip) {
            item.tooltip = new vscode.MarkdownString(element.tooltip);
        }

        // Set context value for menu contributions
        item.contextValue = element.type;

        return item;
    }

    getChildren(element?: GateTreeItem): GateTreeItem[] {
        if (!element) {
            return this.getRootNodes();
        }
        return element.children || [];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tree Structure Builders
    // ─────────────────────────────────────────────────────────────────────────

    private getRootNodes(): GateTreeItem[] {
        const nodes: GateTreeItem[] = [];

        // Status item
        nodes.push(this.buildStatusItem());

        // Last run item
        nodes.push(this.buildLastRunItem());

        // Separator
        nodes.push(this.buildSeparator());

        // Action items
        nodes.push(this.buildRunGateAction());
        nodes.push(this.buildViewReportAction());
        nodes.push(this.buildConfigureAction());

        // Separator
        nodes.push(this.buildSeparator());

        // Recent findings
        nodes.push(this.buildRecentFindingsSection());

        return nodes;
    }

    private buildStatusItem(): GateTreeItem {
        const isEnabled = this.configService.isGateEnabled();
        
        return {
            type: 'status',
            label: `Status: ${isEnabled ? 'Enabled' : 'Disabled'}`,
            icon: isEnabled ? 'zap' : 'circle-slash',
            iconColor: isEnabled ? 'charts.green' : 'disabledForeground',
            tooltip: isEnabled
                ? 'Security gate is enabled and will run on git operations'
                : 'Security gate is disabled. Enable it in settings to scan before commits/pushes.',
            command: {
                command: 'devign.gate.configure',
                title: 'Configure Gate'
            }
        };
    }

    private buildLastRunItem(): GateTreeItem {
        if (!this.lastRunResult) {
            return {
                type: 'lastRun',
                label: 'Last Run: Never',
                icon: 'history',
                tooltip: 'No security gate runs have been performed yet'
            };
        }

        const timeAgo = this.formatTimeAgo(this.lastRunResult.endTime);
        const decision = this.lastRunResult.decision;
        const decisionIcon = decision === 'PASS' ? '✅' : decision === 'WARN' ? '⚠️' : '🚫';
        const scope = this.lastRunResult.scanScope;

        return {
            type: 'lastRun',
            label: `Last Run: ${timeAgo} (${decision})`,
            description: decisionIcon,
            icon: 'history',
            tooltip: this.buildLastRunTooltip(),
            command: {
                command: 'devign.showResults',
                title: 'View Last Report'
            }
        };
    }

    private buildLastRunTooltip(): string {
        if (!this.lastRunResult) {
            return 'No runs yet';
        }

        const result = this.lastRunResult;
        const lines = [
            `**Last Security Gate Run**`,
            ``,
            `**Decision:** ${result.decision}`,
            `**Scope:** ${result.scanScope}`,
            `**Time:** ${result.endTime.toLocaleString()}`,
            `**Duration:** ${result.scanDurationMs}ms`,
            ``,
            `**Files Scanned:** ${result.filesScanned}`,
            `**Functions Scanned:** ${result.functionsScanned}`,
            ``,
            `**Blocking Findings:** ${result.blockedFindings.length}`,
            `**Warning Findings:** ${result.warnedFindings.length}`,
            ``,
            `*Click to view full report*`
        ];

        return lines.join('\n');
    }

    private buildSeparator(): GateTreeItem {
        return {
            type: 'separator',
            label: '─────────────',
            icon: 'dash'
        };
    }

    private buildRunGateAction(): GateTreeItem {
        return {
            type: 'action',
            label: 'Run Gate Now',
            icon: 'play',
            iconColor: 'charts.green',
            tooltip: 'Run the security gate on staged files',
            command: {
                command: 'devign.gate.run',
                title: 'Run Gate'
            }
        };
    }

    private buildViewReportAction(): GateTreeItem {
        return {
            type: 'action',
            label: 'View Last Report',
            icon: 'file-text',
            tooltip: 'Open the detailed security gate report',
            command: {
                command: 'devign.showResults',
                title: 'View Report'
            }
        };
    }

    private buildConfigureAction(): GateTreeItem {
        return {
            type: 'action',
            label: 'Configure Gate',
            icon: 'gear',
            tooltip: 'Open security gate settings',
            command: {
                command: 'devign.gate.configure',
                title: 'Configure Gate'
            }
        };
    }

    private buildRecentFindingsSection(): GateTreeItem {
        const findings = this.getRecentFindings();
        const count = findings.length;

        const children: GateTreeItem[] = findings.map(f => this.buildFindingItem(f));

        if (children.length === 0) {
            children.push({
                type: 'finding',
                label: 'No recent findings',
                icon: 'check',
                iconColor: 'charts.green',
                tooltip: 'No security issues found in the last run'
            });
        }

        return {
            type: 'findingsHeader',
            label: `Recent Findings (${count})`,
            icon: 'list-unordered',
            tooltip: count > 0
                ? `${count} finding${count !== 1 ? 's' : ''} from the last gate run`
                : 'No findings from the last gate run',
            children
        };
    }

    private buildFindingItem(finding: FindingInfo): GateTreeItem {
        const severityIcon = this.getSeverityIcon(finding.severity);
        const location = `${finding.fileName}:${finding.line}`;

        return {
            type: 'finding',
            label: `${location} - ${finding.message}`,
            icon: severityIcon.icon,
            severity: finding.severity,
            tooltip: this.buildFindingTooltip(finding),
            filePath: finding.filePath,
            line: finding.line,
            command: {
                command: 'devign.revealResult',
                title: 'Go to Finding',
                arguments: [{
                    filePath: finding.filePath,
                    line: finding.line,
                    column: 0
                }]
            }
        };
    }

    private buildFindingTooltip(finding: FindingInfo): string {
        return [
            `**Security Finding**`,
            ``,
            `**Severity:** ${finding.severity}`,
            `**File:** ${finding.filePath}`,
            `**Line:** ${finding.line}`,
            `**Message:** ${finding.message}`,
            ``,
            `*Click to navigate to this finding*`
        ].join('\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private getRecentFindings(): FindingInfo[] {
        if (!this.lastRunResult) {
            return [];
        }

        const findings: FindingInfo[] = [];

        // Collect findings from blocked and warned findings
        for (const scanResult of [...this.lastRunResult.blockedFindings, ...this.lastRunResult.warnedFindings]) {
            if (scanResult.dangerous_lines) {
                for (const dl of scanResult.dangerous_lines) {
                    findings.push({
                        filePath: scanResult.file_path,
                        fileName: this.getBasename(scanResult.file_path),
                        line: dl.line,
                        message: dl.message || dl.api || 'Potential vulnerability',
                        severity: this.mapSeverity(dl.severity)
                    });
                }
            }
        }

        // Return top 5 findings
        return findings.slice(0, 5);
    }

    private mapSeverity(severity: string | undefined): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
        if (!severity) {
            return 'INFO';
        }
        const upper = severity.toUpperCase();
        if (upper === 'CRITICAL' || upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
            return upper as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
        }
        return 'INFO';
    }

    private getSeverityIcon(severity: string): { icon: string; color: string } {
        return SEVERITY_ICONS[severity] || SEVERITY_ICONS['INFO'];
    }

    private getBasename(filePath: string): string {
        const parts = filePath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || filePath;
    }

    private formatTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) {
            return 'just now';
        } else if (diffMin < 60) {
            return `${diffMin} min ago`;
        } else if (diffHour < 24) {
            return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
        } else {
            return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────

interface FindingInfo {
    filePath: string;
    fileName: string;
    line: number;
    message: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register the Gate Panel TreeView with VS Code
 * @param context The extension context
 * @returns The GatePanelProvider instance
 */
export function registerGatePanel(context: vscode.ExtensionContext): GatePanelProvider {
    const provider = new GatePanelProvider();

    // Register the tree view
    const treeView = vscode.window.createTreeView('devign.gatePanel', {
        treeDataProvider: provider,
        showCollapseAll: false
    });

    // Add disposables to context
    context.subscriptions.push(treeView);
    context.subscriptions.push(provider);

    return provider;
}

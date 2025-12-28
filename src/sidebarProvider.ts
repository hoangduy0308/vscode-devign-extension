import * as vscode from 'vscode';
import { ScanResult } from './scanner';
import { DangerousLine } from './decorations';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NodeType = 'section' | 'action' | 'severity-group' | 'finding' | 'status';

export interface TreeNode {
    type: NodeType;
    label: string;
    command?: vscode.Command;
    children?: TreeNode[];
    severity?: string;
    icon?: string;
    description?: string;
    tooltip?: string;
    filePath?: string;
    line?: number;
    column?: number;
    functionName?: string;
    probability?: number;
    api?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Severity Configuration
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

const SEVERITY_ICONS: Record<string, { icon: string; color: string }> = {
    'CRITICAL': { icon: 'error', color: 'errorForeground' },
    'HIGH': { icon: 'error', color: 'errorForeground' },
    'MEDIUM': { icon: 'warning', color: 'editorWarning.foreground' },
    'LOW': { icon: 'info', color: 'editorInfo.foreground' }
};

// ─────────────────────────────────────────────────────────────────────────────
// DevignSidebarProvider
// ─────────────────────────────────────────────────────────────────────────────

export class DevignSidebarProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> = 
        new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private results: ScanResult[] = [];
    private lastScanTime: Date | null = null;
    private modelsVersion: string = 'v1.0.0';
    private totalIssues: number = 0;

    constructor() {}

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    setResults(results: ScanResult[]): void {
        this.results = results;
        this.totalIssues = this.countTotalIssues(results);
        this.lastScanTime = new Date();
        this.refresh();
    }

    clearResults(): void {
        this.results = [];
        this.totalIssues = 0;
        this.refresh();
    }

    setStatus(status: { modelsVersion?: string; lastScanTime?: Date; totalIssues?: number }): void {
        if (status.modelsVersion !== undefined) {
            this.modelsVersion = status.modelsVersion;
        }
        if (status.lastScanTime !== undefined) {
            this.lastScanTime = status.lastScanTime;
        }
        if (status.totalIssues !== undefined) {
            this.totalIssues = status.totalIssues;
        }
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TreeDataProvider Implementation
    // ─────────────────────────────────────────────────────────────────────────

    getTreeItem(element: TreeNode): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label);

        // Set collapsible state
        if (element.children && element.children.length > 0) {
            item.collapsibleState = element.type === 'section' || element.type === 'severity-group'
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed;
        } else {
            item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }

        // Set icon
        item.iconPath = this.getIcon(element);

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
        if (element.severity) {
            item.contextValue += `-${element.severity.toLowerCase()}`;
        }

        return item;
    }

    getChildren(element?: TreeNode): TreeNode[] {
        if (!element) {
            return this.getRootNodes();
        }
        return element.children || [];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tree Structure Builders
    // ─────────────────────────────────────────────────────────────────────────

    private getRootNodes(): TreeNode[] {
        return [
            this.buildQuickActionsSection(),
            this.buildScanResultsSection(),
            this.buildStatusSection()
        ];
    }

    private buildQuickActionsSection(): TreeNode {
        return {
            type: 'section',
            label: '⚡ Quick Actions',
            children: [
                {
                    type: 'action',
                    label: 'Scan Current File',
                    icon: 'play',
                    command: {
                        command: 'devign.scanCurrentFile',
                        title: 'Scan Current File'
                    },
                    tooltip: 'Analyze the currently open C/C++ file for vulnerabilities'
                },
                {
                    type: 'action',
                    label: 'Scan Workspace',
                    icon: 'folder',
                    command: {
                        command: 'devign.scanWorkspace',
                        title: 'Scan Workspace'
                    },
                    tooltip: 'Scan all C/C++ files in the workspace'
                },
                {
                    type: 'action',
                    label: 'Clear Cache & Update',
                    icon: 'refresh',
                    command: {
                        command: 'devign.clearCacheAndUpdate',
                        title: 'Clear Cache & Update'
                    },
                    tooltip: 'Clear cached models and check for updates'
                },
                {
                    type: 'action',
                    label: 'Install Dependencies',
                    icon: 'package',
                    command: {
                        command: 'devign.installDependencies',
                        title: 'Install Dependencies'
                    },
                    tooltip: 'Install required Python packages (torch, tree-sitter, etc.)'
                },
                {
                    type: 'action',
                    label: 'Check Environment',
                    icon: 'tools',
                    command: {
                        command: 'devign.doctor',
                        title: 'Check Environment'
                    },
                    tooltip: 'Verify Python, dependencies, and model availability'
                }
            ]
        };
    }

    private buildScanResultsSection(): TreeNode {
        const children: TreeNode[] = [];

        if (this.results.length === 0) {
            children.push({
                type: 'status',
                label: 'No scan results yet',
                icon: 'circle-outline',
                description: 'Run a scan to see results'
            });
        } else {
            const groupedFindings = this.groupFindingsBySeverity();

            for (const severity of SEVERITY_ORDER) {
                const findings = groupedFindings.get(severity) || [];
                if (findings.length > 0) {
                    children.push(this.buildSeverityGroup(severity, findings));
                }
            }

            if (children.length === 0) {
                children.push({
                    type: 'status',
                    label: 'No vulnerabilities found',
                    icon: 'check',
                    description: '✓ All clear'
                });
            }
        }

        return {
            type: 'section',
            label: '🔍 Scan Results',
            children
        };
    }

    private buildSeverityGroup(severity: string, findings: FindingInfo[]): TreeNode {
        return {
            type: 'severity-group',
            label: `${severity}`,
            severity,
            description: `(${findings.length})`,
            icon: SEVERITY_ICONS[severity]?.icon || 'circle',
            children: findings.map(f => this.buildFindingNode(f)),
            tooltip: `${findings.length} ${severity.toLowerCase()} severity issue${findings.length !== 1 ? 's' : ''}`
        };
    }

    private buildFindingNode(finding: FindingInfo): TreeNode {
        const funcDisplay = finding.functionName ? `${finding.functionName}()` : 'unknown';
        const lineDisplay = `L${finding.line}`;
        const probDisplay = `${Math.round(finding.probability * 100)}%`;
        
        return {
            type: 'finding',
            label: `${finding.api}`,
            description: `• ${funcDisplay} • ${lineDisplay} • ${probDisplay}`,
            severity: finding.severity,
            filePath: finding.filePath,
            line: finding.line,
            column: finding.column,
            functionName: finding.functionName,
            probability: finding.probability,
            api: finding.api,
            command: {
                command: 'devign.revealResult',
                title: 'Go to Finding',
                arguments: [{
                    filePath: finding.filePath,
                    line: finding.line,
                    column: finding.column
                }]
            },
            tooltip: this.buildFindingTooltip(finding)
        };
    }

    private buildFindingTooltip(finding: FindingInfo): string {
        return [
            `**🛡️ Security Finding**`,
            ``,
            `**Severity:** ${finding.severity}`,
            `**API:** \`${finding.api}()\``,
            `**Function:** \`${finding.functionName || 'unknown'}()\``,
            `**Location:** ${finding.filePath}:${finding.line}`,
            `**Confidence:** ${Math.round(finding.probability * 100)}%`,
            ``,
            `*Click to navigate to this finding*`
        ].join('\n');
    }

    private buildStatusSection(): TreeNode {
        const lastScanDisplay = this.lastScanTime
            ? this.formatDateTime(this.lastScanTime)
            : 'Never';

        return {
            type: 'section',
            label: '📊 Status',
            children: [
                {
                    type: 'status',
                    label: `Models: ${this.modelsVersion}`,
                    icon: 'package',
                    tooltip: 'Currently loaded model version'
                },
                {
                    type: 'status',
                    label: `Last scan: ${lastScanDisplay}`,
                    icon: 'clock',
                    tooltip: this.lastScanTime
                        ? `Last scan completed at ${this.lastScanTime.toLocaleString()}`
                        : 'No scans have been performed yet'
                },
                {
                    type: 'status',
                    label: `Issues found: ${this.totalIssues}`,
                    icon: this.totalIssues > 0 ? 'bug' : 'check',
                    tooltip: this.totalIssues > 0
                        ? `${this.totalIssues} potential vulnerabilit${this.totalIssues !== 1 ? 'ies' : 'y'} detected`
                        : 'No issues detected in the last scan'
                }
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private getIcon(node: TreeNode): vscode.ThemeIcon | undefined {
        if (!node.icon) {
            return undefined;
        }

        // For severity-related nodes, use colored icons
        if (node.severity && SEVERITY_ICONS[node.severity]) {
            const config = SEVERITY_ICONS[node.severity];
            return new vscode.ThemeIcon(config.icon, new vscode.ThemeColor(config.color));
        }

        // For findings, inherit severity color
        if (node.type === 'finding' && node.severity) {
            const config = SEVERITY_ICONS[node.severity];
            if (config) {
                return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(config.color));
            }
        }

        // Standard icons for actions and status
        return new vscode.ThemeIcon(node.icon);
    }

    private groupFindingsBySeverity(): Map<string, FindingInfo[]> {
        const grouped = new Map<string, FindingInfo[]>();

        for (const result of this.results) {
            if (!result.vulnerable || !result.dangerous_lines) {
                continue;
            }

            for (const line of result.dangerous_lines) {
                const finding: FindingInfo = {
                    filePath: result.file_path,
                    line: line.line,
                    column: line.column_start,
                    severity: line.severity,
                    api: line.api,
                    functionName: line.function,
                    probability: result.probability,
                    message: line.message
                };

                const severity = line.severity || 'LOW';
                if (!grouped.has(severity)) {
                    grouped.set(severity, []);
                }
                grouped.get(severity)!.push(finding);
            }
        }

        return grouped;
    }

    private countTotalIssues(results: ScanResult[]): number {
        let count = 0;
        for (const result of results) {
            if (result.vulnerable && result.dangerous_lines) {
                count += result.dangerous_lines.length;
            }
        }
        return count;
    }

    private formatDateTime(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────

interface FindingInfo {
    filePath: string;
    line: number;
    column: number;
    severity: string;
    api: string;
    functionName?: string;
    probability: number;
    message: string;
}

export default DevignSidebarProvider;

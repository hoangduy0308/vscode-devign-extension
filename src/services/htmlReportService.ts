import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SarifLog, SarifResult, SarifLevel } from './sarifExportService';

/**
 * HTML Report generation from SARIF
 */
export interface HtmlReportOptions {
    title?: string;
    includeStyles?: boolean;
    darkMode?: boolean;
    exportPath?: string;
}

export interface ReportSummary {
    totalVulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    filesAffected: number;
    scanTime: string;
    toolName: string;
    toolVersion: string;
}

export interface ReportVulnerability {
    id: string;
    ruleId: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    file: string;
    line: number;
    endLine?: number;
    snippet?: string;
    probability?: number;
    functionName?: string;
}

export interface HtmlReportData {
    summary: ReportSummary;
    vulnerabilities: ReportVulnerability[];
    generatedAt: string;
}

/**
 * HTML Report Service
 * Converts SARIF logs to HTML reports for WebView rendering and file export.
 */
export class HtmlReportService {
    private readonly CSS_STYLES = `
        :root {
            --bg-primary: #1e1e1e;
            --bg-secondary: #252526;
            --bg-tertiary: #2d2d30;
            --text-primary: #cccccc;
            --text-secondary: #9d9d9d;
            --accent-blue: #0e639c;
            --severity-critical: #ff5252;
            --severity-high: #ff7b00;
            --severity-medium: #ffd600;
            --severity-low: #4caf50;
            --border-color: #3c3c3c;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 24px;
        }

        .report-container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .report-header {
            text-align: center;
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--border-color);
        }

        .report-header h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .report-header .meta {
            color: var(--text-secondary);
            font-size: 14px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }

        .summary-card {
            background: var(--bg-secondary);
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            border: 1px solid var(--border-color);
        }

        .summary-card .value {
            font-size: 36px;
            font-weight: 700;
            display: block;
            margin-bottom: 4px;
        }

        .summary-card .label {
            color: var(--text-secondary);
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .summary-card.critical .value { color: var(--severity-critical); }
        .summary-card.high .value { color: var(--severity-high); }
        .summary-card.medium .value { color: var(--severity-medium); }
        .summary-card.low .value { color: var(--severity-low); }

        .section-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }

        .vulnerability-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .vulnerability-card {
            background: var(--bg-secondary);
            border-radius: 8px;
            padding: 16px;
            border-left: 4px solid var(--border-color);
        }

        .vulnerability-card.critical { border-left-color: var(--severity-critical); }
        .vulnerability-card.high { border-left-color: var(--severity-high); }
        .vulnerability-card.medium { border-left-color: var(--severity-medium); }
        .vulnerability-card.low { border-left-color: var(--severity-low); }

        .vuln-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 8px;
        }

        .severity-badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .severity-badge.critical { background: var(--severity-critical); color: white; }
        .severity-badge.high { background: var(--severity-high); color: white; }
        .severity-badge.medium { background: var(--severity-medium); color: #1e1e1e; }
        .severity-badge.low { background: var(--severity-low); color: white; }

        .vuln-rule {
            color: var(--text-secondary);
            font-size: 12px;
        }

        .vuln-message {
            margin-bottom: 12px;
            font-size: 14px;
        }

        .vuln-location {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-secondary);
            font-size: 13px;
            font-family: 'Consolas', 'Monaco', monospace;
        }

        .vuln-location .file {
            color: var(--accent-blue);
        }

        .code-snippet {
            background: var(--bg-tertiary);
            border-radius: 4px;
            padding: 12px;
            margin-top: 12px;
            overflow-x: auto;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
        }

        .probability {
            color: var(--text-secondary);
            font-size: 12px;
        }

        .footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid var(--border-color);
            text-align: center;
            color: var(--text-secondary);
            font-size: 12px;
        }

        @media (prefers-color-scheme: light) {
            :root {
                --bg-primary: #ffffff;
                --bg-secondary: #f5f5f5;
                --bg-tertiary: #e8e8e8;
                --text-primary: #333333;
                --text-secondary: #666666;
                --border-color: #e0e0e0;
            }
        }
    `;

    /**
     * Convert SARIF log to HTML report data
     */
    sarifToReportData(sarifLog: SarifLog): HtmlReportData {
        const vulnerabilities: ReportVulnerability[] = [];
        let toolName = 'Unknown Tool';
        let toolVersion = '0.0.0';

        const filesAffected = new Set<string>();

        for (const run of sarifLog.runs) {
            toolName = run.tool.driver.name;
            toolVersion = run.tool.driver.version;

            for (const result of run.results) {
                const vuln = this.convertSarifResult(result);
                vulnerabilities.push(vuln);
                if (vuln.file) {
                    filesAffected.add(vuln.file);
                }
            }
        }

        const summary: ReportSummary = {
            totalVulnerabilities: vulnerabilities.length,
            critical: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
            high: vulnerabilities.filter(v => v.severity === 'HIGH').length,
            medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
            low: vulnerabilities.filter(v => v.severity === 'LOW').length,
            filesAffected: filesAffected.size,
            scanTime: new Date().toISOString(),
            toolName,
            toolVersion
        };

        return {
            summary,
            vulnerabilities,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Generate HTML report from SARIF log
     */
    generateHtml(sarifLog: SarifLog, options: HtmlReportOptions = {}): string {
        const data = this.sarifToReportData(sarifLog);
        return this.renderHtml(data, options);
    }

    /**
     * Render HTML from report data
     */
    renderHtml(data: HtmlReportData, options: HtmlReportOptions = {}): string {
        const title = options.title || 'Devign Security Report';
        const includeStyles = options.includeStyles !== false;

        const vulnHtml = data.vulnerabilities.map(v => this.renderVulnerabilityCard(v)).join('\n');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(title)}</title>
    ${includeStyles ? `<style>${this.CSS_STYLES}</style>` : ''}
</head>
<body>
    <div class="report-container">
        <header class="report-header">
            <h1>🛡️ ${this.escapeHtml(title)}</h1>
            <p class="meta">Generated by ${this.escapeHtml(data.summary.toolName)} v${this.escapeHtml(data.summary.toolVersion)} on ${new Date(data.generatedAt).toLocaleString()}</p>
        </header>

        <section class="summary-grid">
            <div class="summary-card">
                <span class="value">${data.summary.totalVulnerabilities}</span>
                <span class="label">Total Issues</span>
            </div>
            <div class="summary-card critical">
                <span class="value">${data.summary.critical}</span>
                <span class="label">Critical</span>
            </div>
            <div class="summary-card high">
                <span class="value">${data.summary.high}</span>
                <span class="label">High</span>
            </div>
            <div class="summary-card medium">
                <span class="value">${data.summary.medium}</span>
                <span class="label">Medium</span>
            </div>
            <div class="summary-card low">
                <span class="value">${data.summary.low}</span>
                <span class="label">Low</span>
            </div>
            <div class="summary-card">
                <span class="value">${data.summary.filesAffected}</span>
                <span class="label">Files Affected</span>
            </div>
        </section>

        <section>
            <h2 class="section-title">Vulnerabilities</h2>
            ${data.vulnerabilities.length > 0 ? `
            <div class="vulnerability-list">
                ${vulnHtml}
            </div>
            ` : '<p style="color: var(--text-secondary);">No vulnerabilities found. Your code looks secure!</p>'}
        </section>

        <footer class="footer">
            <p>Report generated by Devign Vulnerability Scanner</p>
        </footer>
    </div>
</body>
</html>`;
    }

    /**
     * Generate WebView-compatible HTML (without full document structure)
     */
    generateWebViewHtml(data: HtmlReportData): string {
        const vulnHtml = data.vulnerabilities.map(v => this.renderVulnerabilityCard(v)).join('\n');

        return `
<style>${this.CSS_STYLES}</style>
<div class="report-container">
    <section class="summary-grid">
        <div class="summary-card">
            <span class="value">${data.summary.totalVulnerabilities}</span>
            <span class="label">Total Issues</span>
        </div>
        <div class="summary-card critical">
            <span class="value">${data.summary.critical}</span>
            <span class="label">Critical</span>
        </div>
        <div class="summary-card high">
            <span class="value">${data.summary.high}</span>
            <span class="label">High</span>
        </div>
        <div class="summary-card medium">
            <span class="value">${data.summary.medium}</span>
            <span class="label">Medium</span>
        </div>
        <div class="summary-card low">
            <span class="value">${data.summary.low}</span>
            <span class="label">Low</span>
        </div>
        <div class="summary-card">
            <span class="value">${data.summary.filesAffected}</span>
            <span class="label">Files</span>
        </div>
    </section>

    <section>
        <h2 class="section-title">Vulnerabilities</h2>
        ${data.vulnerabilities.length > 0 ? `
        <div class="vulnerability-list">
            ${vulnHtml}
        </div>
        ` : '<p style="color: var(--text-secondary);">No vulnerabilities found.</p>'}
    </section>
</div>`;
    }

    /**
     * Export HTML report to file
     */
    async exportToFile(sarifLog: SarifLog, outputPath: string, options: HtmlReportOptions = {}): Promise<void> {
        const html = this.generateHtml(sarifLog, options);
        await fs.promises.writeFile(outputPath, html, 'utf-8');
    }

    /**
     * Show save dialog and export report
     */
    async exportWithDialog(sarifLog: SarifLog, options: HtmlReportOptions = {}): Promise<string | undefined> {
        const defaultName = `devign-report-${new Date().toISOString().split('T')[0]}.html`;
        
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultName),
            filters: {
                'HTML Report': ['html'],
                'All Files': ['*']
            },
            title: 'Export Security Report'
        });

        if (uri) {
            await this.exportToFile(sarifLog, uri.fsPath, options);
            vscode.window.showInformationMessage(`Report exported to ${uri.fsPath}`);
            return uri.fsPath;
        }

        return undefined;
    }

    private renderVulnerabilityCard(vuln: ReportVulnerability): string {
        const severityClass = vuln.severity.toLowerCase();
        
        return `
<div class="vulnerability-card ${severityClass}">
    <div class="vuln-header">
        <span class="severity-badge ${severityClass}">${vuln.severity}</span>
        <span class="vuln-rule">${this.escapeHtml(vuln.ruleId)}</span>
        ${vuln.probability !== undefined ? `<span class="probability">${(vuln.probability * 100).toFixed(1)}% confidence</span>` : ''}
    </div>
    <p class="vuln-message">${this.escapeHtml(vuln.message)}</p>
    <div class="vuln-location">
        <span class="file">${this.escapeHtml(vuln.file)}</span>
        <span>Line ${vuln.line}${vuln.endLine && vuln.endLine !== vuln.line ? `-${vuln.endLine}` : ''}</span>
        ${vuln.functionName ? `<span>in ${this.escapeHtml(vuln.functionName)}()</span>` : ''}
    </div>
    ${vuln.snippet ? `<pre class="code-snippet">${this.escapeHtml(vuln.snippet)}</pre>` : ''}
</div>`;
    }

    private convertSarifResult(result: SarifResult): ReportVulnerability {
        const location = result.locations?.[0]?.physicalLocation;
        const logicalLocation = result.locations?.[0]?.logicalLocations?.[0];
        
        return {
            id: result.fingerprints?.['devign/v1'] || `${result.ruleId}-${Date.now()}`,
            ruleId: result.ruleId,
            severity: this.levelToSeverity(result.level),
            message: result.message.text || result.message.markdown || 'No description',
            file: location?.artifactLocation?.uri || 'Unknown file',
            line: location?.region?.startLine || 1,
            endLine: location?.region?.endLine,
            snippet: location?.region?.snippet?.text,
            probability: result.properties?.probability as number | undefined,
            functionName: logicalLocation?.name
        };
    }

    private levelToSeverity(level?: SarifLevel): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
        switch (level) {
            case 'error': return 'HIGH';
            case 'warning': return 'MEDIUM';
            case 'note': return 'LOW';
            default: return 'MEDIUM';
        }
    }

    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

let htmlReportServiceInstance: HtmlReportService | null = null;

export function getHtmlReportService(): HtmlReportService {
    if (!htmlReportServiceInstance) {
        htmlReportServiceInstance = new HtmlReportService();
    }
    return htmlReportServiceInstance;
}

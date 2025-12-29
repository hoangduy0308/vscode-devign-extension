import * as vscode from 'vscode';
import { FunctionResult } from './scanner';

export interface DangerousLine {
    line: number;
    column_start: number;
    column_end: number;
    severity: string;
    api: string;
    message: string;
    code: string;
    function?: string;
}

// Result from model prediction
export interface FileVulnerabilityResult {
    vulnerable: boolean;
    probability: number;
    risk_level: string;
    confidence: string;
    detected_patterns: string[];
    function_results?: FunctionResult[];  // Function-level results from Python
}

// Extension path for tree-sitter initialization (kept for compatibility)
let extensionPath: string = '';

export function setExtensionPath(path: string): void {
    extensionPath = path;
}

// Decoration types for different severity levels
const criticalDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
    isWholeLine: true,
    overviewRulerColor: '#ff0000',
    overviewRulerLane: vscode.OverviewRulerLane.Full,
});

const highDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 165, 0, 0.12)',
    isWholeLine: true,
    overviewRulerColor: '#ff9800',
    overviewRulerLane: vscode.OverviewRulerLane.Full,
});

const mediumDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 235, 59, 0.1)',
    isWholeLine: true,
    overviewRulerColor: '#ffeb3b',
    overviewRulerLane: vscode.OverviewRulerLane.Full,
});

const lowDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(33, 150, 243, 0.08)',
    isWholeLine: true,
    overviewRulerColor: '#2196f3',
    overviewRulerLane: vscode.OverviewRulerLane.Full,
});

export class DecorationManager {
    private static instance: DecorationManager;
    private decoratedEditors: Map<string, boolean> = new Map();
    
    private constructor() {}
    
    public static getInstance(): DecorationManager {
        if (!DecorationManager.instance) {
            DecorationManager.instance = new DecorationManager();
        }
        return DecorationManager.instance;
    }
    
    /**
     * Apply decorations for vulnerability results.
     * Uses function_results from Python scanner (each function scanned individually).
     */
    public applyFileVulnerabilityDecoration(
        editor: vscode.TextEditor, 
        result: FileVulnerabilityResult
    ): void {
        if (!result.vulnerable) {
            this.clearDecorations(editor);
            return;
        }
        
        // Clear all first
        this.clearDecorations(editor);
        
        // Group decorations by severity
        const criticalDecorations: vscode.DecorationOptions[] = [];
        const highDecorations: vscode.DecorationOptions[] = [];
        const mediumDecorations: vscode.DecorationOptions[] = [];
        const lowDecorations: vscode.DecorationOptions[] = [];
        
        // Use function_results from Python if available (more accurate - each function scanned individually)
        if (result.function_results && result.function_results.length > 0) {
            for (const func of result.function_results) {
                // Lines are 1-indexed from Python, convert to 0-indexed
                const startLine = func.start_line - 1;
                const endLine = func.end_line - 1;
                
                // Validate line numbers
                if (startLine < 0 || endLine >= editor.document.lineCount || startLine > endLine) {
                    continue;
                }
                
                const range = new vscode.Range(
                    startLine, 0,
                    endLine, editor.document.lineAt(endLine).text.length
                );
                
                const patternsText = func.detected_patterns && func.detected_patterns.length > 0 
                    ? `\n\n**Detected patterns:** ${func.detected_patterns.join(', ')}`
                    : '';
                
                const hoverMessage = new vscode.MarkdownString(
                    `## 🛡️ Devign Vulnerability Detection\n\n` +
                    `**Function:** \`${func.function_name}()\`\n\n` +
                    `**Risk Level:** ${this.getSeverityEmoji(func.risk_level)} **${func.risk_level}**\n\n` +
                    `**Probability:** ${(func.probability * 100).toFixed(1)}%\n\n` +
                    `**Confidence:** ${func.confidence}` +
                    patternsText +
                    `\n\n---\n` +
                    `*AI model prediction for this specific function.*`
                );
                
                const decoration: vscode.DecorationOptions = {
                    range: range,
                    hoverMessage: hoverMessage
                };
                
                // Add to appropriate severity group
                switch (func.risk_level) {
                    case 'CRITICAL':
                        criticalDecorations.push(decoration);
                        break;
                    case 'HIGH':
                        highDecorations.push(decoration);
                        break;
                    case 'MEDIUM':
                        mediumDecorations.push(decoration);
                        break;
                    case 'LOW':
                        lowDecorations.push(decoration);
                        break;
                }
            }
        } else {
            // Fallback: mark entire file with overall result
            const lastLine = editor.document.lineCount - 1;
            const fullRange = new vscode.Range(0, 0, lastLine, editor.document.lineAt(lastLine).text.length);
            
            const patternsText = result.detected_patterns.length > 0 
                ? `\n\n**Detected patterns:** ${result.detected_patterns.join(', ')}`
                : '';
            
            const hoverMessage = new vscode.MarkdownString(
                `## 🛡️ Devign Vulnerability Detection\n\n` +
                `**Risk Level:** ${this.getSeverityEmoji(result.risk_level)} **${result.risk_level}**\n\n` +
                `**Probability:** ${(result.probability * 100).toFixed(1)}%\n\n` +
                `**Confidence:** ${result.confidence}` +
                patternsText +
                `\n\n---\n` +
                `*AI model prediction for this file.*`
            );
            
            const decoration: vscode.DecorationOptions = {
                range: fullRange,
                hoverMessage: hoverMessage
            };
            
            switch (result.risk_level) {
                case 'CRITICAL':
                    criticalDecorations.push(decoration);
                    break;
                case 'HIGH':
                    highDecorations.push(decoration);
                    break;
                case 'MEDIUM':
                    mediumDecorations.push(decoration);
                    break;
                case 'LOW':
                    lowDecorations.push(decoration);
                    break;
            }
        }
        
        // Apply all decorations
        editor.setDecorations(criticalDecoration, criticalDecorations);
        editor.setDecorations(highDecoration, highDecorations);
        editor.setDecorations(mediumDecoration, mediumDecorations);
        editor.setDecorations(lowDecoration, lowDecorations);
        
        this.decoratedEditors.set(editor.document.uri.toString(), true);
    }
    
    /**
     * Legacy method for line-level decorations (kept for compatibility)
     */
    public applyDecorations(editor: vscode.TextEditor, dangerousLines: DangerousLine[]): void {
        if (!dangerousLines || dangerousLines.length === 0) {
            this.clearDecorations(editor);
            return;
        }
        
        const criticalRanges: vscode.DecorationOptions[] = [];
        const highRanges: vscode.DecorationOptions[] = [];
        const mediumRanges: vscode.DecorationOptions[] = [];
        const lowRanges: vscode.DecorationOptions[] = [];
        
        for (const item of dangerousLines) {
            const lineIndex = item.line - 1;
            
            if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
                continue;
            }
            
            const line = editor.document.lineAt(lineIndex);
            const lineRange = line.range;
            
            const decorationOptions: vscode.DecorationOptions = {
                range: lineRange,
                hoverMessage: new vscode.MarkdownString(
                    `**🛡️ Devign Security Alert**\n\n` +
                    `**Severity:** ${this.getSeverityEmoji(item.severity)} ${item.severity}\n\n` +
                    `**API:** \`${item.api}()\`\n\n` +
                    `**Issue:** ${item.message}\n\n` +
                    `---\n` +
                    `\`\`\`c\n${item.code}\n\`\`\``
                )
            };
            
            switch (item.severity) {
                case 'CRITICAL':
                    criticalRanges.push(decorationOptions);
                    break;
                case 'HIGH':
                    highRanges.push(decorationOptions);
                    break;
                case 'MEDIUM':
                    mediumRanges.push(decorationOptions);
                    break;
                case 'LOW':
                    lowRanges.push(decorationOptions);
                    break;
            }
        }
        
        editor.setDecorations(criticalDecoration, criticalRanges);
        editor.setDecorations(highDecoration, highRanges);
        editor.setDecorations(mediumDecoration, mediumRanges);
        editor.setDecorations(lowDecoration, lowRanges);
        
        this.decoratedEditors.set(editor.document.uri.toString(), true);
    }
    
    public clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(criticalDecoration, []);
        editor.setDecorations(highDecoration, []);
        editor.setDecorations(mediumDecoration, []);
        editor.setDecorations(lowDecoration, []);
        
        this.decoratedEditors.delete(editor.document.uri.toString());
    }
    
    public clearAllDecorations(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.clearDecorations(editor);
        }
        this.decoratedEditors.clear();
    }
    
    public isDecorated(uri: string): boolean {
        return this.decoratedEditors.get(uri) || false;
    }
    
    private getSeverityEmoji(severity: string): string {
        switch (severity) {
            case 'CRITICAL': return '🔴';
            case 'HIGH': return '🟠';
            case 'MEDIUM': return '🟡';
            case 'LOW': return '🔵';
            default: return '⚪';
        }
    }
}

// Export decoration types for disposal
export function disposeDecorations(): void {
    criticalDecoration.dispose();
    highDecoration.dispose();
    mediumDecoration.dispose();
    lowDecoration.dispose();
}

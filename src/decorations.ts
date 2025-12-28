import * as vscode from 'vscode';

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

// Result from model prediction (file-level)
export interface FileVulnerabilityResult {
    vulnerable: boolean;
    probability: number;
    risk_level: string;
    confidence: string;
    detected_patterns: string[];
}

// Decoration types for different severity levels - now for whole file indication
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

// Banner decoration at top of file
const vulnerabilityBannerDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    after: {
        contentText: '',
        margin: '0 0 0 20px',
        fontWeight: 'bold'
    }
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
     * Apply decorations for file-level vulnerability result.
     * Highlights the entire file with appropriate severity color.
     */
    public applyFileVulnerabilityDecoration(
        editor: vscode.TextEditor, 
        result: FileVulnerabilityResult
    ): void {
        if (!result.vulnerable) {
            this.clearDecorations(editor);
            return;
        }
        
        // Create range for entire file
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
            `*This is a file-level prediction by the Devign AI model. ` +
            `The model analyzes the entire code structure to detect potential vulnerabilities.*`
        );
        
        const decorationOptions: vscode.DecorationOptions[] = [{
            range: fullRange,
            hoverMessage: hoverMessage
        }];
        
        // Clear all first
        this.clearDecorations(editor);
        
        // Apply appropriate severity decoration
        switch (result.risk_level) {
            case 'CRITICAL':
                editor.setDecorations(criticalDecoration, decorationOptions);
                break;
            case 'HIGH':
                editor.setDecorations(highDecoration, decorationOptions);
                break;
            case 'MEDIUM':
                editor.setDecorations(mediumDecoration, decorationOptions);
                break;
            case 'LOW':
                editor.setDecorations(lowDecoration, decorationOptions);
                break;
        }
        
        this.decoratedEditors.set(editor.document.uri.toString(), true);
    }
    
    /**
     * Legacy method for line-level decorations (kept for compatibility)
     */
    public applyDecorations(editor: vscode.TextEditor, dangerousLines: DangerousLine[]): void {
        // If no dangerous lines, clear decorations
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
        editor.setDecorations(vulnerabilityBannerDecoration, []);
        
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
    vulnerabilityBannerDecoration.dispose();
}

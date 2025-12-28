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

// Decoration types for different severity levels
const criticalDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
    border: '1px solid #ff0000',
    borderRadius: '3px',
    overviewRulerColor: '#ff0000',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    after: {
        contentText: ' ⚠️ CRITICAL',
        color: '#ff6b6b',
        fontWeight: 'bold',
        margin: '0 0 0 10px'
    }
});

const highDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 165, 0, 0.25)',
    border: '1px solid #ff9800',
    borderRadius: '3px',
    overviewRulerColor: '#ff9800',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    after: {
        contentText: ' ⚠️ HIGH',
        color: '#ffa726',
        fontWeight: 'bold',
        margin: '0 0 0 10px'
    }
});

const mediumDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 235, 59, 0.2)',
    border: '1px solid #ffeb3b',
    borderRadius: '3px',
    overviewRulerColor: '#ffeb3b',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    after: {
        contentText: ' ⚡ MEDIUM',
        color: '#fdd835',
        margin: '0 0 0 10px'
    }
});

const lowDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    border: '1px solid #2196f3',
    borderRadius: '3px',
    overviewRulerColor: '#2196f3',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
});

// Underline decoration for the specific API call
const apiUnderlineDecoration = vscode.window.createTextEditorDecorationType({
    textDecoration: 'underline wavy #ff0000',
    fontWeight: 'bold'
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
    
    public applyDecorations(editor: vscode.TextEditor, dangerousLines: DangerousLine[]): void {
        const criticalRanges: vscode.DecorationOptions[] = [];
        const highRanges: vscode.DecorationOptions[] = [];
        const mediumRanges: vscode.DecorationOptions[] = [];
        const lowRanges: vscode.DecorationOptions[] = [];
        const apiRanges: vscode.DecorationOptions[] = [];
        
        for (const item of dangerousLines) {
            const lineIndex = item.line - 1; // VS Code uses 0-based line numbers
            
            if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
                continue;
            }
            
            const line = editor.document.lineAt(lineIndex);
            const lineRange = line.range;
            
            // Create range for the API call itself
            const apiRange = new vscode.Range(
                lineIndex,
                item.column_start,
                lineIndex,
                item.column_end
            );
            
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
            
            // Add underline to specific API
            apiRanges.push({
                range: apiRange,
                hoverMessage: new vscode.MarkdownString(`⚠️ **${item.api}()** - ${item.message}`)
            });
            
            // Add to appropriate severity array
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
        
        // Apply decorations
        editor.setDecorations(criticalDecoration, criticalRanges);
        editor.setDecorations(highDecoration, highRanges);
        editor.setDecorations(mediumDecoration, mediumRanges);
        editor.setDecorations(lowDecoration, lowRanges);
        editor.setDecorations(apiUnderlineDecoration, apiRanges);
        
        this.decoratedEditors.set(editor.document.uri.toString(), true);
    }
    
    public clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(criticalDecoration, []);
        editor.setDecorations(highDecoration, []);
        editor.setDecorations(mediumDecoration, []);
        editor.setDecorations(lowDecoration, []);
        editor.setDecorations(apiUnderlineDecoration, []);
        
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
    apiUnderlineDecoration.dispose();
}

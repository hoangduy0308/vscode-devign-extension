import * as vscode from 'vscode';
import { ParsedFunction, extractFunctionsFromCode, isParserAvailable } from './parsers/treeSitterParser';

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

// Function range info
interface FunctionRange {
    name: string;
    startLine: number;
    endLine: number;
}

// Extension path for tree-sitter initialization
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
     * Find all function definitions in C/C++ code using tree-sitter (with regex fallback)
     */
    private async findFunctionsAsync(document: vscode.TextDocument): Promise<FunctionRange[]> {
        const text = document.getText();
        const filePath = document.uri.fsPath;
        
        // Try tree-sitter first
        if (extensionPath) {
            try {
                const parsedFunctions = await extractFunctionsFromCode(text, filePath, extensionPath);
                if (parsedFunctions.length > 0) {
                    console.log(`Tree-sitter found ${parsedFunctions.length} functions in ${filePath}`);
                    return parsedFunctions.map(f => ({
                        name: f.name,
                        startLine: f.startLine - 1, // Convert to 0-indexed
                        endLine: f.endLine - 1
                    }));
                }
            } catch (error) {
                console.warn('Tree-sitter parsing failed, falling back to regex:', error);
            }
        }
        
        // Fallback to regex-based parsing
        return this.findFunctionsRegex(document);
    }
    
    /**
     * Regex-based function finding (fallback when tree-sitter unavailable)
     */
    private findFunctionsRegex(document: vscode.TextDocument): FunctionRange[] {
        const functions: FunctionRange[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        // Regex to match C/C++ function definitions
        // Matches: return_type function_name(params) {
        const funcStartRegex = /^[\w\s\*]+\s+(\w+)\s*\([^)]*\)\s*\{?\s*$/;
        const funcStartRegex2 = /^[\w\s\*]+\s+(\w+)\s*\([^)]*\)\s*$/; // Without opening brace
        
        let braceCount = 0;
        let currentFunc: { name: string; startLine: number } | null = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip preprocessor directives and comments
            if (line.startsWith('#') || line.startsWith('//') || line.startsWith('/*')) {
                continue;
            }
            
            // Check for function start
            if (braceCount === 0) {
                let match = line.match(funcStartRegex);
                if (!match) {
                    match = line.match(funcStartRegex2);
                }
                
                if (match && match[1] && !['if', 'else', 'for', 'while', 'switch', 'do'].includes(match[1])) {
                    currentFunc = { name: match[1], startLine: i };
                }
            }
            
            // Count braces
            for (const char of line) {
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    
                    // Function ended
                    if (braceCount === 0 && currentFunc) {
                        functions.push({
                            name: currentFunc.name,
                            startLine: currentFunc.startLine,
                            endLine: i
                        });
                        currentFunc = null;
                    }
                }
            }
        }
        
        return functions;
    }
    
    /**
     * Apply decorations for file-level vulnerability result.
     * Highlights all functions in the file with appropriate severity color.
     */
    public async applyFileVulnerabilityDecoration(
        editor: vscode.TextEditor, 
        result: FileVulnerabilityResult
    ): Promise<void> {
        if (!result.vulnerable) {
            this.clearDecorations(editor);
            return;
        }
        
        // Find all functions in the file (using tree-sitter if available)
        const functions = await this.findFunctionsAsync(editor.document);
        
        const patternsText = result.detected_patterns.length > 0 
            ? `\n\n**Detected patterns:** ${result.detected_patterns.join(', ')}`
            : '';
        
        const decorationOptions: vscode.DecorationOptions[] = [];
        
        if (functions.length > 0) {
            // Mark each function
            for (const func of functions) {
                const startLine = func.startLine;
                const endLine = func.endLine;
                
                const range = new vscode.Range(
                    startLine, 0,
                    endLine, editor.document.lineAt(endLine).text.length
                );
                
                const hoverMessage = new vscode.MarkdownString(
                    `## 🛡️ Devign Vulnerability Detection\n\n` +
                    `**Function:** \`${func.name}()\`\n\n` +
                    `**Risk Level:** ${this.getSeverityEmoji(result.risk_level)} **${result.risk_level}**\n\n` +
                    `**Probability:** ${(result.probability * 100).toFixed(1)}%\n\n` +
                    `**Confidence:** ${result.confidence}` +
                    patternsText +
                    `\n\n---\n` +
                    `*The Devign AI model detected potential vulnerabilities in this file. ` +
                    `Functions are highlighted for review.*`
                );
                
                decorationOptions.push({
                    range: range,
                    hoverMessage: hoverMessage
                });
            }
        } else {
            // No functions found, mark entire file
            const lastLine = editor.document.lineCount - 1;
            const fullRange = new vscode.Range(0, 0, lastLine, editor.document.lineAt(lastLine).text.length);
            
            const hoverMessage = new vscode.MarkdownString(
                `## 🛡️ Devign Vulnerability Detection\n\n` +
                `**Risk Level:** ${this.getSeverityEmoji(result.risk_level)} **${result.risk_level}**\n\n` +
                `**Probability:** ${(result.probability * 100).toFixed(1)}%\n\n` +
                `**Confidence:** ${result.confidence}` +
                patternsText +
                `\n\n---\n` +
                `*The Devign AI model detected potential vulnerabilities in this file.*`
            );
            
            decorationOptions.push({
                range: fullRange,
                hoverMessage: hoverMessage
            });
        }
        
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

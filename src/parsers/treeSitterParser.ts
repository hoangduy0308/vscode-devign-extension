/**
 * Tree-sitter based C/C++ parser for accurate function extraction.
 * 
 * Uses web-tree-sitter for parsing, which provides:
 * - Accurate AST parsing (not regex-based)
 * - Handles nested structures, strings, comments correctly
 * - Supports complex C++ syntax (templates, lambdas, etc.)
 */

import * as path from 'path';
import { Parser, Language, Node } from 'web-tree-sitter';

// Function info interface
export interface ParsedFunction {
    name: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    code: string;
    signature: string;
    returnType?: string;
    parameters?: string;
    className?: string;  // For methods
}

// Parser singleton
let parserInstance: Parser | null = null;
let cLanguage: Language | null = null;
let cppLanguage: Language | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize tree-sitter parser with C and C++ grammars.
 */
export async function initializeParser(extensionPath: string): Promise<void> {
    if (parserInstance) {
        return; // Already initialized
    }
    
    if (initPromise) {
        return initPromise; // Initialization in progress
    }
    
    initPromise = (async () => {
        try {
            // Initialize tree-sitter
            await Parser.init();
            parserInstance = new Parser();
            
            // Load language grammars from extension's wasm directory
            const wasmDir = path.join(extensionPath, 'wasm');
            
            try {
                cLanguage = await Language.load(path.join(wasmDir, 'tree-sitter-c.wasm'));
            } catch (e) {
                console.warn('Failed to load C grammar:', e);
            }
            
            try {
                cppLanguage = await Language.load(path.join(wasmDir, 'tree-sitter-cpp.wasm'));
            } catch (e) {
                console.warn('Failed to load C++ grammar:', e);
            }
            
            if (!cLanguage && !cppLanguage) {
                throw new Error('Failed to load any tree-sitter grammar');
            }
            
            console.log('Tree-sitter parser initialized successfully');
        } catch (error) {
            console.error('Failed to initialize tree-sitter:', error);
            parserInstance = null;
            throw error;
        }
    })();
    
    return initPromise;
}

/**
 * Check if tree-sitter parser is available
 */
export function isParserAvailable(): boolean {
    return parserInstance !== null && (cLanguage !== null || cppLanguage !== null);
}

/**
 * Parse source code and extract all function definitions.
 */
export function extractFunctionsWithTreeSitter(
    code: string, 
    filePath: string,
    language: 'c' | 'cpp' = 'c'
): ParsedFunction[] {
    if (!parserInstance) {
        throw new Error('Tree-sitter parser not initialized. Call initializeParser() first.');
    }
    
    const lang = language === 'cpp' ? cppLanguage : cLanguage;
    if (!lang) {
        throw new Error(`Language '${language}' not available`);
    }
    
    parserInstance.setLanguage(lang);
    const tree = parserInstance.parse(code);
    if (!tree) {
        throw new Error('Failed to parse code');
    }
    
    const functions: ParsedFunction[] = [];
    
    // Walk the AST to find function definitions
    walkTree(tree.rootNode, code, functions);
    
    return functions;
}

/**
 * Recursively walk the AST to find function definitions
 */
function walkTree(
    node: Node, 
    code: string, 
    functions: ParsedFunction[]
): void {
    // Function definition types in C/C++
    if (node.type === 'function_definition') {
        const func = extractFunctionInfo(node, code);
        if (func) {
            functions.push(func);
        }
    }
    
    // Recurse into children
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
            walkTree(child, code, functions);
        }
    }
}

/**
 * Extract function information from an AST node
 */
function extractFunctionInfo(
    node: Node, 
    code: string
): ParsedFunction | null {
    let name = '';
    let returnType = '';
    let parameters = '';
    let className = '';
    
    // Find declarator (contains function name and parameters)
    const declarator = findChild(node, ['function_declarator', 'declarator']);
    if (declarator) {
        // Get function name
        const identifier = findChild(declarator, ['identifier', 'field_identifier', 'destructor_name']);
        if (identifier) {
            name = identifier.text;
        }
        
        // Check for qualified name (class::method)
        const qualifiedId = findChild(declarator, ['qualified_identifier', 'scoped_identifier']);
        if (qualifiedId) {
            name = qualifiedId.text;
            // Extract class name
            const scope = findChild(qualifiedId, ['namespace_identifier', 'type_identifier']);
            if (scope) {
                className = scope.text;
            }
        }
        
        // Get parameters
        const paramList = findChild(declarator, ['parameter_list', 'parameter_declaration_list']);
        if (paramList) {
            parameters = paramList.text;
        }
    }
    
    // Get return type
    const typeNode = findChild(node, ['type_identifier', 'primitive_type', 'sized_type_specifier']);
    if (typeNode) {
        returnType = typeNode.text;
    }
    
    // Skip if no name found
    if (!name) {
        return null;
    }
    
    const startLine = node.startPosition.row + 1;  // 1-indexed
    const endLine = node.endPosition.row + 1;
    const startColumn = node.startPosition.column;
    const endColumn = node.endPosition.column;
    
    // Extract code
    const funcCode = code.substring(node.startIndex, node.endIndex);
    
    // Build signature
    const signature = `${returnType} ${name}${parameters}`.trim();
    
    return {
        name,
        startLine,
        endLine,
        startColumn,
        endColumn,
        code: funcCode,
        signature,
        returnType: returnType || undefined,
        parameters: parameters || undefined,
        className: className || undefined
    };
}

/**
 * Find a child node by type
 */
function findChild(node: Node, types: string[]): Node | null {
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && types.includes(child.type)) {
            return child;
        }
    }
    
    // Search recursively in first few levels
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
            for (let j = 0; j < child.childCount; j++) {
                const grandchild = child.child(j);
                if (grandchild && types.includes(grandchild.type)) {
                    return grandchild;
                }
            }
        }
    }
    
    return null;
}

/**
 * Detect language from file extension
 */
export function detectLanguageFromPath(filePath: string): 'c' | 'cpp' | null {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.c') {
        return 'c';
    }
    
    if (['.cpp', '.cc', '.cxx', '.hpp', '.hxx', '.h'].includes(ext)) {
        return 'cpp';
    }
    
    return null;
}

/**
 * High-level function to extract functions from a file
 */
export async function extractFunctionsFromCode(
    code: string,
    filePath: string,
    extensionPath: string
): Promise<ParsedFunction[]> {
    // Initialize parser if needed
    if (!isParserAvailable()) {
        await initializeParser(extensionPath);
    }
    
    const language = detectLanguageFromPath(filePath);
    if (!language) {
        return [];
    }
    
    try {
        return extractFunctionsWithTreeSitter(code, filePath, language);
    } catch (error) {
        console.error('Tree-sitter parsing failed:', error);
        return [];
    }
}

/**
 * Cleanup parser resources
 */
export function disposeParser(): void {
    if (parserInstance) {
        parserInstance.delete();
        parserInstance = null;
    }
    cLanguage = null;
    cppLanguage = null;
    initPromise = null;
}

import { FunctionInfo } from '../services/functionScanner';

/**
 * Supported C/C++ file extensions
 */
export const CPP_EXTENSIONS = ['.c', '.cpp', '.h', '.hpp', '.cc', '.cxx', '.hxx'];

/**
 * Check if a file path is a C/C++ file
 */
export function isCppFile(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase();
    return CPP_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filePath: string): 'c' | 'cpp' | null {
    const lowerPath = filePath.toLowerCase();
    
    if (lowerPath.endsWith('.c')) {
        return 'c';
    }
    
    if (lowerPath.endsWith('.cpp') || 
        lowerPath.endsWith('.cc') || 
        lowerPath.endsWith('.cxx') ||
        lowerPath.endsWith('.hpp') ||
        lowerPath.endsWith('.hxx') ||
        lowerPath.endsWith('.h')) {
        return 'cpp';
    }
    
    return null;
}

/**
 * Function extraction result
 */
export interface ExtractedFunction {
    name: string;
    startLine: number;
    endLine: number;
    code: string;
    signature: string;
    isDefinition: boolean;
}

/**
 * Extract functions from C/C++ source code using regex-based parsing.
 * This is a fallback when Tree-sitter is not available.
 * 
 * Handles:
 * - Regular functions
 * - Methods (class::method)
 * - Template functions
 * - Constructors/Destructors
 * 
 * @param code Full source code content
 * @param filePath Path to the file (for FunctionInfo)
 * @returns Array of extracted functions
 */
export function extractFunctions(code: string, filePath: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = code.split('\n');
    
    // Pattern for C/C++ function definitions
    // Matches: [template<...>] [static|inline|virtual|explicit|constexpr] return_type [class::]name(params) [const] [noexcept] {
    const functionStartPattern = /^(?:\s*template\s*<[^>]*>\s*)?(?:(?:static|inline|virtual|explicit|constexpr|extern|__attribute__\s*\([^)]*\))\s+)*(?:(?:const|volatile|unsigned|signed|long|short|struct|class|enum)\s+)*[\w:*&<>,\s]+\s+(\*?\s*(?:\w+::)*~?\w+)\s*\([^)]*\)\s*(?:const)?\s*(?:noexcept(?:\([^)]*\))?)?\s*(?:override|final)?\s*\{?\s*$/;
    
    // Simpler pattern for common cases
    const simplePattern = /^\s*(?:[\w:*&<>,\s]+)\s+(\w+(?:::\w+)?)\s*\(([^)]*)\)\s*(?:const)?\s*\{?\s*$/;
    
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Skip empty lines, preprocessor directives, and comments
        if (trimmedLine === '' || 
            trimmedLine.startsWith('#') || 
            trimmedLine.startsWith('//') ||
            trimmedLine.startsWith('/*')) {
            i++;
            continue;
        }
        
        // Try to match function definition
        let match = trimmedLine.match(functionStartPattern) || trimmedLine.match(simplePattern);
        
        // Additional check: does this look like a function definition?
        const looksLikeFunction = trimmedLine.includes('(') && 
                                  trimmedLine.includes(')') && 
                                  !trimmedLine.startsWith('if') &&
                                  !trimmedLine.startsWith('for') &&
                                  !trimmedLine.startsWith('while') &&
                                  !trimmedLine.startsWith('switch') &&
                                  !trimmedLine.startsWith('catch') &&
                                  !trimmedLine.startsWith('return') &&
                                  !trimmedLine.includes('=') &&
                                  !trimmedLine.endsWith(';');
        
        if (looksLikeFunction) {
            // Try to extract function name
            const funcNameMatch = trimmedLine.match(/(\w+(?:::\w+)?)\s*\([^)]*\)/);
            
            if (funcNameMatch) {
                const funcName = funcNameMatch[1];
                
                // Skip control structures and known non-functions
                if (['if', 'for', 'while', 'switch', 'catch', 'sizeof', 'typeof', 'alignof', 'decltype'].includes(funcName)) {
                    i++;
                    continue;
                }
                
                const startLine = i + 1; // 1-indexed
                let endLine = startLine;
                
                // Find the matching closing brace
                if (trimmedLine.includes('{')) {
                    let braceCount = 0;
                    for (let j = i; j < lines.length; j++) {
                        const currentLine = lines[j];
                        for (const char of currentLine) {
                            if (char === '{') braceCount++;
                            if (char === '}') braceCount--;
                        }
                        if (braceCount === 0 && j > i) {
                            endLine = j + 1;
                            break;
                        }
                        if (braceCount <= 0) {
                            endLine = j + 1;
                            break;
                        }
                    }
                } else if (trimmedLine.endsWith(')') || trimmedLine.endsWith(') const')) {
                    // Function declaration without body on same line, look for { on next lines
                    for (let j = i + 1; j < lines.length; j++) {
                        const nextLine = lines[j].trim();
                        if (nextLine.startsWith('{')) {
                            let braceCount = 0;
                            for (let k = j; k < lines.length; k++) {
                                const currentLine = lines[k];
                                for (const char of currentLine) {
                                    if (char === '{') braceCount++;
                                    if (char === '}') braceCount--;
                                }
                                if (braceCount === 0) {
                                    endLine = k + 1;
                                    break;
                                }
                            }
                            break;
                        } else if (nextLine.endsWith(';') || nextLine === '') {
                            // Declaration only, skip
                            break;
                        }
                    }
                }
                
                // Only add if we found a valid function body
                if (endLine > startLine) {
                    const functionCode = lines.slice(startLine - 1, endLine).join('\n');
                    
                    functions.push({
                        name: funcName,
                        code: functionCode,
                        filePath: filePath,
                        startLine: startLine,
                        endLine: endLine
                    });
                    
                    // Move past this function
                    i = endLine;
                    continue;
                }
            }
        }
        
        i++;
    }
    
    return functions;
}

/**
 * Extract functions from file content with language detection
 */
export function extractFunctionsFromFile(content: string, filePath: string): FunctionInfo[] {
    const language = detectLanguage(filePath);
    
    if (!language) {
        return [];
    }
    
    return extractFunctions(content, filePath);
}

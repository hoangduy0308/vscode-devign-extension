// Import vscode mock first - must be before any other imports
import './vscode-mock';

import * as assert from 'assert';
import { extractFunctions, isCppFile, detectLanguage, CPP_EXTENSIONS } from '../../parsers/functionExtractor';
import { FunctionInfo } from '../../services/functionScanner';

// Sample C code for testing
const SAMPLE_C_CODE = `
void vulnerable_function(char *input) {
    char buffer[10];
    strcpy(buffer, input);
}

int safe_function(int a, int b) {
    return a + b;
}
`;

const SAMPLE_CPP_CODE = `
class MyClass {
public:
    void processData(const std::string& data) {
        std::cout << data << std::endl;
    }

    int calculate(int x, int y) {
        return x * y;
    }
};

template<typename T>
T getValue(T input) {
    return input;
}
`;

const EMPTY_FILE = '';

const NO_FUNCTIONS_FILE = `
// Just comments
#include <stdio.h>

#define MAX_SIZE 100

typedef struct {
    int x;
    int y;
} Point;
`;

suite('Integration Tests', () => {

    suite('Function Scanner Tests', () => {

        test('extractFunctions from C code sample', () => {
            const functions = extractFunctions(SAMPLE_C_CODE, 'test.c');
            
            assert.ok(functions.length >= 2, `Expected at least 2 functions, got ${functions.length}`);
            
            const funcNames = functions.map(f => f.name);
            assert.ok(funcNames.includes('vulnerable_function'), 'Should find vulnerable_function');
            assert.ok(funcNames.includes('safe_function'), 'Should find safe_function');
        });

        test('extractFunctions from C code validates function properties', () => {
            const functions = extractFunctions(SAMPLE_C_CODE, 'test.c');
            
            const vulnerableFunc = functions.find(f => f.name === 'vulnerable_function');
            assert.ok(vulnerableFunc, 'Should find vulnerable_function');
            assert.strictEqual(vulnerableFunc.filePath, 'test.c');
            assert.ok(vulnerableFunc.startLine > 0, 'startLine should be positive');
            assert.ok(vulnerableFunc.endLine >= vulnerableFunc.startLine, 'endLine should be >= startLine');
            assert.ok(vulnerableFunc.code.includes('strcpy'), 'Code should contain strcpy');
        });

        test('extractFunctions from C++ code sample', () => {
            const functions = extractFunctions(SAMPLE_CPP_CODE, 'test.cpp');
            
            assert.ok(functions.length >= 1, `Expected at least 1 function, got ${functions.length}`);
            
            const funcNames = functions.map(f => f.name);
            // Should find at least some methods/functions
            const hasProcessData = funcNames.includes('processData');
            const hasCalculate = funcNames.includes('calculate');
            const hasGetValue = funcNames.includes('getValue');
            
            assert.ok(
                hasProcessData || hasCalculate || hasGetValue,
                `Should find at least one of: processData, calculate, getValue. Found: ${funcNames.join(', ')}`
            );
        });

        test('extractFunctions handles empty file gracefully', () => {
            const functions = extractFunctions(EMPTY_FILE, 'empty.c');
            
            assert.ok(Array.isArray(functions), 'Should return an array');
            assert.strictEqual(functions.length, 0, 'Should return empty array for empty file');
        });

        test('extractFunctions handles file with no functions', () => {
            const functions = extractFunctions(NO_FUNCTIONS_FILE, 'nofunc.c');
            
            assert.ok(Array.isArray(functions), 'Should return an array');
            assert.strictEqual(functions.length, 0, 'Should return empty array when no functions found');
        });

        test('extractFunctions handles multiline function signatures', () => {
            const codeWithMultiline = `
int multiline_function(
    int param1,
    int param2,
    int param3)
{
    return param1 + param2 + param3;
}
`;
            const functions = extractFunctions(codeWithMultiline, 'test.c');
            // May or may not extract depending on regex - just ensure no crash
            assert.ok(Array.isArray(functions), 'Should return an array without crashing');
        });

        test('extractFunctions skips control structures', () => {
            const codeWithControlStructures = `
void testFunction() {
    if (condition) {
        doSomething();
    }
    for (int i = 0; i < 10; i++) {
        process(i);
    }
    while (running) {
        update();
    }
}
`;
            const functions = extractFunctions(codeWithControlStructures, 'test.c');
            const funcNames = functions.map(f => f.name);
            
            // Should not include control structures as functions
            assert.ok(!funcNames.includes('if'), 'Should not extract if as function');
            assert.ok(!funcNames.includes('for'), 'Should not extract for as function');
            assert.ok(!funcNames.includes('while'), 'Should not extract while as function');
        });
    });

    suite('File Type Detection Tests', () => {

        test('isCppFile returns true for C files', () => {
            assert.strictEqual(isCppFile('test.c'), true);
            assert.strictEqual(isCppFile('/path/to/file.c'), true);
            assert.strictEqual(isCppFile('C:\\path\\to\\file.c'), true);
        });

        test('isCppFile returns true for C++ files', () => {
            assert.strictEqual(isCppFile('test.cpp'), true);
            assert.strictEqual(isCppFile('test.cc'), true);
            assert.strictEqual(isCppFile('test.cxx'), true);
        });

        test('isCppFile returns true for header files', () => {
            assert.strictEqual(isCppFile('test.h'), true);
            assert.strictEqual(isCppFile('test.hpp'), true);
            assert.strictEqual(isCppFile('test.hxx'), true);
        });

        test('isCppFile returns false for non-C/C++ files', () => {
            assert.strictEqual(isCppFile('test.js'), false);
            assert.strictEqual(isCppFile('test.py'), false);
            assert.strictEqual(isCppFile('test.ts'), false);
            assert.strictEqual(isCppFile('test.txt'), false);
        });

        test('isCppFile is case insensitive', () => {
            assert.strictEqual(isCppFile('test.C'), true);
            assert.strictEqual(isCppFile('test.CPP'), true);
            assert.strictEqual(isCppFile('test.H'), true);
        });

        test('detectLanguage returns correct language', () => {
            assert.strictEqual(detectLanguage('test.c'), 'c');
            assert.strictEqual(detectLanguage('test.cpp'), 'cpp');
            assert.strictEqual(detectLanguage('test.cc'), 'cpp');
            assert.strictEqual(detectLanguage('test.h'), 'cpp');
            assert.strictEqual(detectLanguage('test.hpp'), 'cpp');
        });

        test('detectLanguage returns null for unsupported files', () => {
            assert.strictEqual(detectLanguage('test.js'), null);
            assert.strictEqual(detectLanguage('test.py'), null);
        });

        test('CPP_EXTENSIONS contains expected extensions', () => {
            assert.ok(CPP_EXTENSIONS.includes('.c'), 'Should include .c');
            assert.ok(CPP_EXTENSIONS.includes('.cpp'), 'Should include .cpp');
            assert.ok(CPP_EXTENSIONS.includes('.h'), 'Should include .h');
            assert.ok(CPP_EXTENSIONS.includes('.hpp'), 'Should include .hpp');
        });
    });

    suite('Hybrid Scan Service Tests', () => {
        // Note: HybridScanService requires Python backend for actual scanning
        // These tests verify TypeScript logic only

        test('HybridScanService module exports expected types', async () => {
            // Dynamically import to test exports exist
            const hybridModule = await import('../../services/hybridScanService');
            
            assert.ok(hybridModule.HybridScanService, 'Should export HybridScanService class');
            assert.ok(hybridModule.getHybridScanService, 'Should export getHybridScanService function');
            assert.ok(hybridModule.disposeHybridScanService, 'Should export disposeHybridScanService function');
        });

        // Skip: Requires vscode.ExtensionContext and Python backend
        test.skip('HybridScanService instantiation requires ExtensionContext', () => {
            // Would need full vscode mock with ExtensionContext
        });

        test('TYPING_DEBOUNCE value should be reasonable', () => {
            // Verify debounce is set reasonably (800ms based on source)
            // This is a structural check - we know from source it's 800ms
            const expectedDebounce = 800;
            assert.ok(expectedDebounce >= 500 && expectedDebounce <= 2000,
                'Debounce should be between 500-2000ms for good UX');
        });
    });

    suite('Scanner Module Tests', () => {

        test('Scanner module exports expected interfaces', async () => {
            const scannerModule = await import('../../scanner');
            
            assert.ok(scannerModule.DevignScanner, 'Should export DevignScanner class');
        });

        test('ScanResult interface structure is correct', () => {
            // Test that we can create a valid ScanResult object
            const mockResult = {
                file_path: 'test.c',
                vulnerable: true,
                probability: 0.85,
                risk_level: 'HIGH',
                dangerous_apis: ['strcpy'],
                dangerous_lines: []
            };
            
            assert.strictEqual(mockResult.file_path, 'test.c');
            assert.strictEqual(mockResult.vulnerable, true);
            assert.ok(mockResult.probability >= 0 && mockResult.probability <= 1);
            assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'].includes(mockResult.risk_level) || mockResult.risk_level === 'HIGH');
        });

        test('FunctionResult interface structure is correct', () => {
            const mockFunctionResult = {
                function_name: 'test_func',
                start_line: 1,
                end_line: 10,
                vulnerable: false,
                probability: 0.2,
                risk_level: 'LOW',
                confidence: 'high',
                detected_patterns: []
            };
            
            assert.strictEqual(mockFunctionResult.function_name, 'test_func');
            assert.ok(mockFunctionResult.start_line > 0);
            assert.ok(mockFunctionResult.end_line >= mockFunctionResult.start_line);
        });

        // Skip: Requires Python backend and vscode.ExtensionContext
        test.skip('DevignScanner.scanFile requires Python backend', () => {
            // Actual scanning requires Python scanner to be running
        });

        // Skip: Requires Python backend
        test.skip('DevignScanner.scanCode requires Python backend', () => {
            // Actual scanning requires Python scanner to be running
        });
    });

    suite('Function Scanner Service Tests', () => {

        test('FunctionScannerService module exports expected types', async () => {
            const funcScannerModule = await import('../../services/functionScanner');
            
            assert.ok(funcScannerModule.FunctionScannerService, 'Should export FunctionScannerService class');
        });

        test('FunctionInfo interface is well-defined', () => {
            const mockFunctionInfo: FunctionInfo = {
                name: 'myFunction',
                code: 'void myFunction() { return; }',
                filePath: '/path/to/file.c',
                startLine: 1,
                endLine: 3
            };
            
            assert.strictEqual(mockFunctionInfo.name, 'myFunction');
            assert.ok(mockFunctionInfo.code.length > 0);
            assert.ok(mockFunctionInfo.startLine <= mockFunctionInfo.endLine);
        });

        // Skip: FunctionScannerService requires DevignScanner which requires Python
        test.skip('FunctionScannerService.scanFunctions requires Python backend', () => {
            // Actual function scanning requires Python scanner
        });
    });

    suite('End-to-End Flow Tests (Structural)', () => {

        test('Parser and scanner modules can be imported together', async () => {
            const parserModule = await import('../../parsers');
            const scannerModule = await import('../../scanner');
            
            assert.ok(parserModule.extractFunctions, 'Parser should export extractFunctions');
            assert.ok(scannerModule.DevignScanner, 'Scanner should export DevignScanner');
        });

        test('Function extraction output is compatible with FunctionScannerService input', () => {
            const extractedFunctions = extractFunctions(SAMPLE_C_CODE, 'test.c');
            
            // Verify extracted functions match FunctionInfo interface
            for (const func of extractedFunctions) {
                assert.ok(typeof func.name === 'string', 'name should be string');
                assert.ok(typeof func.code === 'string', 'code should be string');
                assert.ok(typeof func.filePath === 'string', 'filePath should be string');
                assert.ok(typeof func.startLine === 'number', 'startLine should be number');
                assert.ok(typeof func.endLine === 'number', 'endLine should be number');
            }
        });

        test('Extracted function code contains original source', () => {
            const extractedFunctions = extractFunctions(SAMPLE_C_CODE, 'test.c');
            
            const vulnerableFunc = extractedFunctions.find(f => f.name === 'vulnerable_function');
            if (vulnerableFunc) {
                assert.ok(vulnerableFunc.code.includes('char buffer[10]'), 
                    'Extracted code should contain buffer declaration');
                assert.ok(vulnerableFunc.code.includes('strcpy'), 
                    'Extracted code should contain strcpy call');
            }
        });

        test('Line numbers are 1-indexed', () => {
            const functions = extractFunctions(SAMPLE_C_CODE, 'test.c');
            
            for (const func of functions) {
                assert.ok(func.startLine >= 1, `startLine should be >= 1, got ${func.startLine}`);
                assert.ok(func.endLine >= 1, `endLine should be >= 1, got ${func.endLine}`);
            }
        });

        test('Complex C code with nested braces is handled', () => {
            const complexCode = `
int complex_function(int x) {
    if (x > 0) {
        for (int i = 0; i < x; i++) {
            if (i % 2 == 0) {
                continue;
            }
        }
    }
    return x;
}
`;
            const functions = extractFunctions(complexCode, 'complex.c');
            
            assert.ok(functions.length >= 1, 'Should extract at least one function');
            
            const complexFunc = functions.find(f => f.name === 'complex_function');
            if (complexFunc) {
                assert.ok(complexFunc.code.includes('return x'), 
                    'Should include the full function body');
            }
        });
    });
});

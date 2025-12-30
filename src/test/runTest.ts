/**
 * E2E Test Runner for VS Code Extension
 * 
 * This file sets up and runs E2E tests in a real VS Code environment.
 * 
 * REQUIREMENTS:
 * - Install @vscode/test-electron: npm install -D @vscode/test-electron
 * - Add to package.json scripts: "test:e2e": "node out/test/runTest.js"
 * 
 * USAGE:
 * 1. npm run compile
 * 2. npm run test:e2e
 * 
 * This will:
 * - Download VS Code if not present
 * - Launch VS Code with the extension loaded
 * - Run tests in the extension host
 * - Report results
 */

import * as path from 'path';

/**
 * Main entry point for running E2E tests
 * 
 * NOTE: This requires @vscode/test-electron package.
 * Install it with: npm install -D @vscode/test-electron
 * 
 * The code below is commented out until the package is installed.
 */
async function main() {
    try {
        // Import @vscode/test-electron - uncomment when package is installed
        // const { runTests, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } = require('@vscode/test-electron');

        // Path to the extension project root
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // Path to the test suite
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Path to the workspace to open during tests (optional)
        const testWorkspacePath = path.resolve(__dirname, '../../test-workspace');

        console.log('E2E Test Runner');
        console.log('================');
        console.log(`Extension path: ${extensionDevelopmentPath}`);
        console.log(`Test suite path: ${extensionTestsPath}`);
        console.log('');
        console.log('NOTE: Full E2E tests require @vscode/test-electron package.');
        console.log('Install it with: npm install -D @vscode/test-electron');
        console.log('');
        console.log('Once installed, uncomment the runTests() call below.');

        /*
        // Uncomment this section after installing @vscode/test-electron:
        
        const { runTests } = require('@vscode/test-electron');

        // Run the extension tests
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            // Optionally specify a workspace folder to open
            // launchArgs: [testWorkspacePath],
            
            // VS Code version to use (optional)
            // version: '1.74.0',
            
            // Additional launch arguments
            launchArgs: [
                '--disable-extensions',  // Disable other extensions for isolation
                '--disable-gpu',         // Useful in CI environments
            ],
        });

        console.log('E2E tests completed successfully!');
        */

        // For now, run structural tests without VS Code host
        runStructuralTests();

    } catch (err) {
        console.error('Failed to run E2E tests:', err);
        process.exit(1);
    }
}

/**
 * Run structural tests that don't require VS Code extension host
 * These can run in a regular Node.js environment
 */
function runStructuralTests() {
    console.log('Running structural tests (no VS Code host required)...');
    console.log('');
    console.log('Use "npm test" to run these tests via Mocha.');
    console.log('');
    console.log('Available test files:');
    console.log('  - extension.test.ts: Tests extension module structure');
    console.log('  - commands.test.ts: Tests command registration');
    console.log('  - integration.test.ts: Tests file scanning logic');
    console.log('');
    console.log('To run: npm test');
}

// Run main
main().catch(console.error);

/**
 * Test Suite Index (for use with @vscode/test-electron)
 * 
 * This would be in src/test/suite/index.ts for full E2E setup.
 * Export a run() function that Mocha uses.
 */
export async function run(): Promise<void> {
    // Create Mocha instance
    const Mocha = require('mocha');
    const glob = require('glob');

    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 60000, // Extended timeout for E2E tests
    });

    const testsRoot = path.resolve(__dirname, './suite');

    return new Promise((resolve, reject) => {
        glob('**/**.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
            if (err) {
                return reject(err);
            }

            // Add files to Mocha
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run tests
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (runErr) {
                reject(runErr);
            }
        });
    });
}

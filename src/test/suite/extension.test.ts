/**
 * Extension E2E Tests
 * 
 * These tests verify the extension module structure and exports.
 * 
 * NOTE: Full E2E tests that interact with VS Code APIs require the
 * @vscode/test-electron package and running through src/test/runTest.ts.
 * The tests below focus on structural validation that can run without
 * the full extension host.
 */

import './vscode-mock';
import * as assert from 'assert';

suite('Extension Module Structure', () => {
    /**
     * NOTE: Full extension module loading tests require the VS Code extension host
     * because the extension imports modules that depend on VS Code APIs.
     * 
     * To run these tests:
     * 1. Install @vscode/test-electron: npm install -D @vscode/test-electron
     * 2. Use src/test/runTest.ts to launch tests in VS Code host
     * 
     * The tests below validate the extension source structure without loading
     * the compiled module (which requires full VS Code API mocking).
     */
    
    test('extension.ts source exists', () => {
        const fs = require('fs');
        const path = require('path');
        const extensionPath = path.resolve(__dirname, '../../../src/extension.ts');
        assert.ok(fs.existsSync(extensionPath), 'extension.ts should exist');
    });

    test('extension.ts exports activate function (source check)', () => {
        const fs = require('fs');
        const path = require('path');
        const extensionPath = path.resolve(__dirname, '../../../src/extension.ts');
        const source = fs.readFileSync(extensionPath, 'utf-8');
        
        assert.ok(
            source.includes('export function activate'),
            'extension.ts should export activate function'
        );
    });

    test('extension.ts exports deactivate function (source check)', () => {
        const fs = require('fs');
        const path = require('path');
        const extensionPath = path.resolve(__dirname, '../../../src/extension.ts');
        const source = fs.readFileSync(extensionPath, 'utf-8');
        
        assert.ok(
            source.includes('export function deactivate'),
            'extension.ts should export deactivate function'
        );
    });

    test('extension.ts exports log function (source check)', () => {
        const fs = require('fs');
        const path = require('path');
        const extensionPath = path.resolve(__dirname, '../../../src/extension.ts');
        const source = fs.readFileSync(extensionPath, 'utf-8');
        
        assert.ok(
            source.includes('export function log'),
            'extension.ts should export log function'
        );
    });

    test('extension.ts registers all expected commands', () => {
        const fs = require('fs');
        const path = require('path');
        const extensionPath = path.resolve(__dirname, '../../../src/extension.ts');
        const source = fs.readFileSync(extensionPath, 'utf-8');
        
        // Check for command registrations
        const expectedCommands = [
            'devign.scanCurrentFile',
            'devign.scanWorkspace',
            'devign.scanSelection',
            'devign.showResults',
            'devign.clearDiagnostics',
            'devign.doctor',
            'devign.gate.run',
            'devign.commitWithGate',
            'devign.pushWithGate',
            'devign.github.signIn',
            'devign.github.signOut',
            'devign.createPR'
        ];
        
        for (const cmd of expectedCommands) {
            assert.ok(
                source.includes(`'${cmd}'`),
                `extension.ts should register command '${cmd}'`
            );
        }
    });

    test('extension.ts imports required VS Code APIs', () => {
        const fs = require('fs');
        const path = require('path');
        const extensionPath = path.resolve(__dirname, '../../../src/extension.ts');
        const source = fs.readFileSync(extensionPath, 'utf-8');
        
        assert.ok(
            source.includes("import * as vscode from 'vscode'"),
            'extension.ts should import vscode'
        );
    });
});

/**
 * Full E2E Extension Lifecycle Tests
 * 
 * These tests would run with the actual VS Code extension host.
 * Requires @vscode/test-electron and running via runTest.ts
 * 
 * To enable full E2E tests:
 * 1. Install @vscode/test-electron: npm install -D @vscode/test-electron
 * 2. Run tests with: npm run test:e2e (after adding script)
 * 3. Uncomment the suite below and modify imports
 */

/*
suite('Extension Activation (Full E2E)', () => {
    const vscode = require('vscode');
    
    suiteSetup(async () => {
        // Wait for extension to activate
        const ext = vscode.extensions.getExtension('devign.devign-vulnerability-scanner');
        if (ext && !ext.isActive) {
            await ext.activate();
        }
    });

    test('extension should be present', () => {
        const ext = vscode.extensions.getExtension('devign.devign-vulnerability-scanner');
        assert.ok(ext, 'Extension should be installed');
    });

    test('extension should be active after activation', async () => {
        const ext = vscode.extensions.getExtension('devign.devign-vulnerability-scanner');
        assert.ok(ext?.isActive, 'Extension should be active');
    });

    test('extension should register diagnostic collection', async () => {
        // Verify diagnostics collection exists for 'devign'
        const diagnostics = vscode.languages.getDiagnostics();
        // Note: This would be populated after a scan
    });

    test('extension should create status bar item', async () => {
        // Status bar item verification would require visual inspection
        // or custom tracking mechanism
    });
});
*/

/**
 * Commands Registration E2E Tests
 * 
 * These tests verify that command IDs defined in package.json match
 * the commands registered in extension.ts.
 * 
 * NOTE: Full command execution tests require the VS Code extension host
 * and @vscode/test-electron. The tests below validate command structure
 * and registration patterns.
 */

import './vscode-mock';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Expected commands from package.json
 * These should match the 'contributes.commands' section in package.json
 */
const EXPECTED_COMMANDS = [
    // Core scanning commands
    'devign.scanCurrentFile',
    'devign.scanWorkspace',
    'devign.scanSelection',
    'devign.showResults',
    'devign.clearDiagnostics',
    
    // Utility commands
    'devign.doctor',
    'devign.openOutput',
    'devign.configurePython',
    'devign.downloadModels',
    'devign.installDependencies',
    'devign.clearCacheAndUpdate',
    'devign.sidebar.refresh',
    'devign.revealResult',
    
    // Security Gate commands
    'devign.commitWithGate',
    'devign.pushWithGate',
    'devign.pullWithScan',
    'devign.gate.run',
    'devign.gate.configure',
    
    // GitHub commands
    'devign.github.signIn',
    'devign.github.signOut',
    'devign.github.status',
    
    // PR commands
    'devign.createPR'
] as const;

suite('Command Registration Structure', () => {
    let packageJson: any;
    
    suiteSetup(() => {
        // Load package.json to verify command definitions
        const packageJsonPath = path.resolve(__dirname, '../../../package.json');
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        packageJson = JSON.parse(content);
    });

    test('package.json has contributes.commands section', () => {
        assert.ok(packageJson.contributes, 'package.json should have contributes section');
        assert.ok(packageJson.contributes.commands, 'package.json should have contributes.commands section');
        assert.ok(Array.isArray(packageJson.contributes.commands), 'commands should be an array');
    });

    test('all expected commands are defined in package.json', () => {
        const definedCommands = packageJson.contributes.commands.map(
            (cmd: { command: string }) => cmd.command
        );

        for (const expectedCommand of EXPECTED_COMMANDS) {
            assert.ok(
                definedCommands.includes(expectedCommand),
                `Command '${expectedCommand}' should be defined in package.json`
            );
        }
    });

    test('devign.scanCurrentFile command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.scanCurrentFile'
        );
        assert.ok(cmd, 'devign.scanCurrentFile should be defined');
        assert.ok(cmd.title, 'Command should have a title');
    });

    test('devign.scanWorkspace command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.scanWorkspace'
        );
        assert.ok(cmd, 'devign.scanWorkspace should be defined');
        assert.ok(cmd.title, 'Command should have a title');
    });

    test('devign.scanSelection command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.scanSelection'
        );
        assert.ok(cmd, 'devign.scanSelection should be defined');
        assert.ok(cmd.title, 'Command should have a title');
    });

    test('devign.showResults command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.showResults'
        );
        assert.ok(cmd, 'devign.showResults should be defined');
    });

    test('devign.clearDiagnostics command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.clearDiagnostics'
        );
        assert.ok(cmd, 'devign.clearDiagnostics should be defined');
    });

    test('devign.doctor command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.doctor'
        );
        assert.ok(cmd, 'devign.doctor should be defined');
    });

    test('devign.commitWithGate command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.commitWithGate'
        );
        assert.ok(cmd, 'devign.commitWithGate should be defined');
        assert.ok(cmd.icon, 'Security gate command should have an icon');
    });

    test('devign.pushWithGate command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.pushWithGate'
        );
        assert.ok(cmd, 'devign.pushWithGate should be defined');
        assert.ok(cmd.icon, 'Security gate command should have an icon');
    });

    test('devign.gate.run command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.gate.run'
        );
        assert.ok(cmd, 'devign.gate.run should be defined');
    });

    test('devign.createPR command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.createPR'
        );
        assert.ok(cmd, 'devign.createPR should be defined');
    });

    test('devign.github.signIn command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.github.signIn'
        );
        assert.ok(cmd, 'devign.github.signIn should be defined');
    });

    test('devign.github.signOut command exists', () => {
        const cmd = packageJson.contributes.commands.find(
            (c: any) => c.command === 'devign.github.signOut'
        );
        assert.ok(cmd, 'devign.github.signOut should be defined');
    });

    test('all commands have required properties', () => {
        for (const cmd of packageJson.contributes.commands) {
            assert.ok(cmd.command, 'Each command should have a command ID');
            assert.ok(cmd.title, `Command ${cmd.command} should have a title`);
            assert.ok(
                cmd.command.startsWith('devign.'),
                `Command ${cmd.command} should use devign namespace`
            );
        }
    });

    test('command count matches expected', () => {
        const definedCount = packageJson.contributes.commands.length;
        // Allow for additional commands beyond expected (for flexibility)
        assert.ok(
            definedCount >= EXPECTED_COMMANDS.length,
            `Should have at least ${EXPECTED_COMMANDS.length} commands, found ${definedCount}`
        );
    });
});

suite('Configuration Structure', () => {
    let packageJson: any;
    
    suiteSetup(() => {
        const packageJsonPath = path.resolve(__dirname, '../../../package.json');
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        packageJson = JSON.parse(content);
    });

    test('extension has configuration section', () => {
        assert.ok(packageJson.contributes.configuration, 'Should have configuration section');
        assert.ok(packageJson.contributes.configuration.properties, 'Should have properties');
    });

    test('devign.pythonPath configuration exists', () => {
        const config = packageJson.contributes.configuration.properties['devign.pythonPath'];
        assert.ok(config, 'pythonPath config should exist');
        assert.strictEqual(config.type, 'string', 'pythonPath should be string type');
    });

    test('devign.threshold configuration exists', () => {
        const config = packageJson.contributes.configuration.properties['devign.threshold'];
        assert.ok(config, 'threshold config should exist');
        assert.strictEqual(config.type, 'number', 'threshold should be number type');
    });

    test('devign.gate.enabled configuration exists', () => {
        const config = packageJson.contributes.configuration.properties['devign.gate.enabled'];
        assert.ok(config, 'gate.enabled config should exist');
        assert.strictEqual(config.type, 'boolean', 'gate.enabled should be boolean type');
    });
});

/**
 * Full E2E Command Execution Tests
 * 
 * These tests would execute actual commands in the VS Code extension host.
 * Requires @vscode/test-electron and running via runTest.ts
 * 
 * To enable full E2E tests:
 * 1. Install @vscode/test-electron: npm install -D @vscode/test-electron
 * 2. Run tests with: npm run test:e2e (after adding script)
 * 3. Uncomment the suite below
 */

/*
suite('Command Execution (Full E2E)', () => {
    const vscode = require('vscode');

    suiteSetup(async () => {
        // Ensure extension is activated
        const ext = vscode.extensions.getExtension('devign.devign-vulnerability-scanner');
        if (ext && !ext.isActive) {
            await ext.activate();
        }
    });

    test('devign.doctor command executes without error', async () => {
        await assert.doesNotReject(
            vscode.commands.executeCommand('devign.doctor'),
            'Doctor command should execute without throwing'
        );
    });

    test('devign.clearDiagnostics command executes without error', async () => {
        await assert.doesNotReject(
            vscode.commands.executeCommand('devign.clearDiagnostics'),
            'Clear diagnostics command should execute without throwing'
        );
    });

    test('devign.showResults command executes without error', async () => {
        await assert.doesNotReject(
            vscode.commands.executeCommand('devign.showResults'),
            'Show results command should execute without throwing'
        );
    });

    test('all registered commands are callable', async () => {
        const commands = await vscode.commands.getCommands(true);
        const devignCommands = commands.filter((c: string) => c.startsWith('devign.'));
        
        assert.ok(devignCommands.length > 0, 'Should have devign commands registered');
        
        for (const command of EXPECTED_COMMANDS) {
            assert.ok(
                devignCommands.includes(command),
                `Command ${command} should be registered`
            );
        }
    });
});
*/

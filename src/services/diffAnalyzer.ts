import * as vscode from 'vscode';
import * as fs from 'fs';
import { GitService, FileChange } from './gitService';
import { FunctionInfo } from './functionScanner';
import { isCppFile, extractFunctionsFromFile, detectLanguage } from '../parsers';

/**
 * Result of analyzing a changed file
 */
export interface FileAnalysis {
    filePath: string;
    language: 'c' | 'cpp';
    functions: FunctionInfo[];
    staged: boolean;
    changeStatus: FileChange['statusLetter'];
}

/**
 * Result of analyzing all changed files
 */
export interface DiffAnalysisResult {
    files: FileAnalysis[];
    totalFunctions: number;
    stagedFiles: number;
    unstagedFiles: number;
}

/**
 * DiffAnalyzer Service
 * 
 * Responsibilities:
 * - DA-01: Get list of changed C/C++ files from staged changes
 * - DA-02: Language detection & file filter (C/C++ only)  
 * - DA-03/04: Function extractor (C/C++)
 * 
 * Uses GitService for Git operations and FunctionExtractor for parsing.
 */
export class DiffAnalyzer {
    private gitService: GitService;

    constructor(gitService: GitService) {
        this.gitService = gitService;
    }

    /**
     * DA-01: Get list of changed C/C++ file paths from staged changes.
     * @returns Array of absolute file paths for staged C/C++ files
     */
    public async getStagedCppFilePaths(): Promise<string[]> {
        const stagedFiles = await this.gitService.getStagedCppFiles();
        return stagedFiles.map(f => f.filePath);
    }

    /**
     * DA-01 + DA-02: Get changed C/C++ files with metadata.
     * @param scope 'staged' for only staged, 'all' for staged + unstaged
     * @returns Array of FileChange for C/C++ files only
     */
    public async getChangedCppFiles(scope: 'staged' | 'all' = 'staged'): Promise<FileChange[]> {
        if (scope === 'staged') {
            return this.gitService.getStagedCppFiles();
        }
        return this.gitService.getModifiedCppFiles('staged+unstaged');
    }

    /**
     * DA-02: Filter files to C/C++ only.
     * @param files Array of FileChange to filter
     * @returns Filtered array containing only C/C++ files
     */
    public filterCppFiles(files: FileChange[]): FileChange[] {
        return files.filter(f => isCppFile(f.filePath));
    }

    /**
     * DA-03/04: Extract all functions from a single file.
     * @param filePath Absolute path to the C/C++ file
     * @returns Array of FunctionInfo, empty if file cannot be read or parsed
     */
    public async extractFunctionsFromFile(filePath: string): Promise<FunctionInfo[]> {
        try {
            // Read file content
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return extractFunctionsFromFile(content, filePath);
        } catch (error) {
            console.error(`DiffAnalyzer: Failed to extract functions from ${filePath}:`, error);
            return [];
        }
    }

    /**
     * DA-03/04: Extract functions from code string.
     * @param code Source code content
     * @param filePath Path for metadata
     * @returns Array of extracted FunctionInfo
     */
    public extractFunctions(code: string, filePath: string): FunctionInfo[] {
        return extractFunctionsFromFile(code, filePath);
    }

    /**
     * Full analysis: Get staged C/C++ files and extract all functions.
     * @param scope 'staged' for staged files only, 'all' for staged + unstaged
     * @returns DiffAnalysisResult with all file analyses
     */
    public async analyze(scope: 'staged' | 'all' = 'staged'): Promise<DiffAnalysisResult> {
        const changedFiles = await this.getChangedCppFiles(scope);
        const snapshot = await this.gitService.getRepositorySnapshot();
        
        if (!snapshot) {
            return {
                files: [],
                totalFunctions: 0,
                stagedFiles: 0,
                unstagedFiles: 0
            };
        }

        const stagedPaths = new Set(snapshot.staged.map(f => f.filePath));
        const analyses: FileAnalysis[] = [];
        let totalFunctions = 0;
        let stagedCount = 0;
        let unstagedCount = 0;

        for (const file of changedFiles) {
            // Skip deleted files
            if (file.statusLetter === 'D') {
                continue;
            }

            const language = detectLanguage(file.filePath);
            if (!language) {
                continue;
            }

            const functions = await this.extractFunctionsFromFile(file.filePath);
            const isStaged = stagedPaths.has(file.filePath);

            analyses.push({
                filePath: file.filePath,
                language,
                functions,
                staged: isStaged,
                changeStatus: file.statusLetter
            });

            totalFunctions += functions.length;
            if (isStaged) stagedCount++;
            else unstagedCount++;
        }

        return {
            files: analyses,
            totalFunctions,
            stagedFiles: stagedCount,
            unstagedFiles: unstagedCount
        };
    }

    /**
     * Get all functions from staged C/C++ files.
     * Convenience method for security gate pipeline.
     * @returns Flat array of all FunctionInfo from staged files
     */
    public async getStagedFunctions(): Promise<FunctionInfo[]> {
        const result = await this.analyze('staged');
        return result.files.flatMap(f => f.functions);
    }

    /**
     * Quick check if there are any staged C/C++ files.
     * @returns true if there are staged C/C++ files
     */
    public async hasStagedCppFiles(): Promise<boolean> {
        const files = await this.gitService.getStagedCppFiles();
        return files.length > 0;
    }
}

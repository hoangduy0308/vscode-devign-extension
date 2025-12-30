import { vscode } from './vscode';
import { MessageType } from '../types';

// Types
export interface FileLocation {
  file: string;
  line: number;
  column?: number;
}

export interface ScanStatusPayload {
  status: 'idle' | 'scanning' | 'completed' | 'error';
  progress?: number;
  message?: string;
  filesScanned?: number;
  totalFiles?: number;
}

export type GitAction = 
  | { action: 'checkout'; branch: string }
  | { action: 'createBranch'; name: string }
  | { action: 'deleteBranch'; name: string }
  | { action: 'stage'; file: string }
  | { action: 'unstage'; file: string }
  | { action: 'commit'; message: string }
  | { action: 'push'; remote?: string }
  | { action: 'pull'; remote?: string };

// Messaging API
export const messages = {
  openFile: (location: FileLocation) => {
    vscode.postMessage({
      type: MessageType.OPEN_FILE,
      payload: location
    });
  },

  runScan: (options?: { files?: string[] }) => {
    vscode.postMessage({
      type: MessageType.RUN_SCAN,
      payload: options
    });
  },

  cancelScan: () => {
    vscode.postMessage({
      type: MessageType.CANCEL_SCAN
    });
  },

  exportReport: (format?: 'sarif' | 'html' | 'json') => {
    vscode.postMessage({
      type: MessageType.EXPORT_REPORT,
      payload: { format }
    });
  },

  git: (action: GitAction) => {
    vscode.postMessage({
      type: MessageType.GIT_ACTION,
      payload: action
    });
  }
};

// State persistence
export interface WebviewState {
  viewMode?: 'dashboard' | 'report';
  selectedVulnId?: string;
  // ScanResults filters (severity toggles)
  scanResultsFilters?: string[];
  // ReportPanel filters
  reportFilter?: 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reportSortBy?: 'severity' | 'file';
  scrollPosition?: number;
  collapsedSections?: string[];
}

export const state = {
  get: (): WebviewState | undefined => {
    return vscode.getState() as WebviewState | undefined;
  },

  set: (newState: WebviewState): WebviewState | undefined => {
    return vscode.setState(newState);
  },

  update: (partial: Partial<WebviewState>): WebviewState | undefined => {
    const current = state.get() || {};
    return state.set({ ...current, ...partial });
  },

  // Helper to save scroll position
  saveScrollPosition: (position: number): void => {
    state.update({ scrollPosition: position });
  },

  // Helper to get scroll position
  getScrollPosition: (): number => {
    return state.get()?.scrollPosition || 0;
  }
};

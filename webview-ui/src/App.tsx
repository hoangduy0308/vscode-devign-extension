import { useState, useEffect, useRef, useCallback } from 'react';
import { type ScanResultPayload, type ReportData, MessageType } from './types';
import { ScanResults } from './components/ScanResults';
import { Dashboard } from './components/Dashboard';
import { SecurityGate, type GateStatus } from './components/SecurityGate';
import { GitPanel } from './components/GitPanel';
import { ReportPanel } from './components/ReportPanel';
import { ScanProgressOverlay } from './components/ScanProgressOverlay';
import { messages, state, type GitAction, type ScanStatusPayload } from './utilities/messages';

type ViewMode = 'dashboard' | 'report';

// Helper to convert scan status to gate status
const getGateStatusFromScan = (scanStatus: ScanStatusPayload, scanResult: ScanResultPayload | null): GateStatus => {
  if (scanStatus.status === 'scanning') return 'PENDING';
  if (scanStatus.status === 'error') return 'FAILED';
  if (scanStatus.status === 'completed' || scanResult) {
    const hasCritical = scanResult?.summary.critical && scanResult.summary.critical > 0;
    const hasHigh = scanResult?.summary.high && scanResult.summary.high > 0;
    if (hasCritical) return 'FAILED';
    if (hasHigh) return 'WARNING';
    return 'PASSED';
  }
  return 'PENDING';
};

function App() {
  const [scanResult, setScanResult] = useState<ScanResultPayload | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatusPayload>({ status: 'idle' });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const savedState = state.get();
    return savedState?.viewMode || 'dashboard';
  });
  
  // Ref for scroll container
  const mainRef = useRef<HTMLElement>(null);

  // Derive gate status from scan status and results
  const gateStatus = getGateStatusFromScan(scanStatus, scanResult);
  const gateProgress = scanStatus.progress ?? (scanStatus.status === 'completed' ? 100 : 0);

  // Mock data for git panel (will be replaced by real data later)
  const [gitStatus] = useState({
    branch: 'feature/slice-2',
    branches: ['main', 'develop', 'feature/slice-2'],
    staged: ['src/components/Dashboard.tsx', 'src/components/SecurityGate.tsx'],
    unstaged: ['src/App.tsx']
  });

  // Restore scroll position on mount
  useEffect(() => {
    const savedState = state.get();
    if (savedState?.scrollPosition && mainRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (mainRef.current) {
          mainRef.current.scrollTop = savedState.scrollPosition || 0;
        }
      });
    }
  }, []);

  // Save scroll position on scroll (debounced)
  const handleScroll = useCallback(() => {
    if (mainRef.current) {
      const scrollTop = mainRef.current.scrollTop;
      // Debounce by only saving if scroll position changed significantly
      const savedPosition = state.get()?.scrollPosition || 0;
      if (Math.abs(scrollTop - savedPosition) > 50) {
        state.saveScrollPosition(scrollTop);
      }
    }
  }, []);

  const handleGitAction = (action: string, data: string | { remote?: string }) => {
    let gitAction: GitAction;
    
    switch (action) {
      case 'checkout':
        gitAction = { action: 'checkout', branch: data as string };
        break;
      case 'createBranch':
        gitAction = { action: 'createBranch', name: data as string };
        break;
      case 'deleteBranch':
        gitAction = { action: 'deleteBranch', name: data as string };
        break;
      case 'stage':
        gitAction = { action: 'stage', file: data as string };
        break;
      case 'unstage':
        gitAction = { action: 'unstage', file: data as string };
        break;
      case 'push':
        gitAction = { action: 'push', remote: (data as { remote?: string })?.remote };
        break;
      case 'pull':
        gitAction = { action: 'pull', remote: (data as { remote?: string })?.remote };
        break;
      default:
        return;
    }
    
    messages.git(gitAction);
  };

  // Auto-switch to dashboard if on report view with no data
  useEffect(() => {
    if (viewMode === 'report' && !reportData) {
      setViewMode('dashboard');
      state.update({ viewMode: 'dashboard' });
    }
  }, [viewMode, reportData]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case MessageType.SCAN_RESULT:
          setScanResult(message.payload);
          break;
        case MessageType.REPORT_DATA:
          setReportData(message.payload);
          if (message.payload) {
            setViewMode('report');
            state.update({ viewMode: 'report' });
          }
          break;
        case MessageType.SCAN_STATUS:
          setScanStatus(message.payload as ScanStatusPayload);
          // Auto-dismiss overlay when scan completes successfully
          if (message.payload?.status === 'completed') {
            setTimeout(() => {
              setScanStatus({ status: 'idle' });
            }, 2000);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    state.update({ viewMode: mode });
  };

  const handleExportReport = () => {
    messages.exportReport();
  };

  const handleVulnerabilityClick = (vuln: { file: string; line: number }) => {
    messages.openFile({ file: vuln.file, line: vuln.line });
  };

  return (
    <div className="min-h-screen bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)] font-[var(--vscode-font-family)]">
      {/* Scan Progress Overlay */}
      <ScanProgressOverlay 
        status={scanStatus} 
        onClose={() => setScanStatus({ status: 'idle' })}
      />
      
      <main 
        ref={mainRef}
        onScroll={handleScroll}
        className="p-4 flex flex-col gap-4 max-w-4xl mx-auto overflow-y-auto max-h-screen" 
        role="main" 
        aria-label="Devign Scanner Dashboard"
      >
        {/* View Toggle */}
        <div className="flex items-center gap-2 border-b border-[var(--vscode-panel-border)] pb-3" role="tablist" aria-label="View mode tabs">
          <button
            onClick={() => handleViewModeChange('dashboard')}
            className={`px-3 py-1.5 rounded text-sm font-medium ${viewMode === 'dashboard'
              ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
              : 'text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)]'
              }`}
            role="tab"
            aria-selected={viewMode === 'dashboard'}
            aria-controls="dashboard-panel"
          >
            Dashboard
          </button>
          <button
            onClick={() => reportData && handleViewModeChange('report')}
            disabled={!reportData}
            className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 ${viewMode === 'report'
              ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
              : !reportData
                ? 'text-[var(--vscode-disabledForeground)] cursor-not-allowed opacity-50'
                : 'text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)]'
              }`}
            role="tab"
            aria-selected={viewMode === 'report'}
            aria-controls="report-panel"
            aria-disabled={!reportData}
            title={!reportData ? 'No report data available. Run a scan first.' : undefined}
          >
            Report
            {!reportData && <span className="text-xs opacity-70">(empty)</span>}
          </button>
        </div>

        {viewMode === 'dashboard' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="region" aria-label="Status Overview">
              <Dashboard
                stats={{
                  totalScans: 12,
                  vulnerabilitiesFound: scanResult?.summary.critical || 0,
                  criticalIssues: scanResult?.summary.critical || 0
                }}
                modelVersion="1.0.0"
                lastScanTime={scanResult ? new Date(scanResult.timestamp).toLocaleString() : null}
              />

              <div className="flex flex-col gap-4">
                <SecurityGate
                  status={gateStatus}
                  progress={gateProgress}
                  onAllowCommit={() => console.log('Allow commit')}
                  onBlockCommit={() => console.log('Block commit')}
                />
                <GitPanel
                  branch={gitStatus.branch}
                  branches={gitStatus.branches}
                  stagedFiles={gitStatus.staged}
                  unstagedFiles={gitStatus.unstaged}
                  onBranchChange={(branch) => handleGitAction('checkout', branch)}
                  onCreateBranch={(name) => handleGitAction('createBranch', name)}
                  onDeleteBranch={(name) => handleGitAction('deleteBranch', name)}
                  onStageFile={(file) => handleGitAction('stage', file)}
                  onUnstageFile={(file) => handleGitAction('unstage', file)}
                  onPush={(remote) => handleGitAction('push', { remote })}
                  onPull={(remote) => handleGitAction('pull', { remote })}
                />
              </div>
            </div>

            {scanResult ? (
              <ScanResults results={scanResult} />
            ) : (
              <div
                className="flex flex-col items-center justify-center p-8 text-center text-[var(--vscode-descriptionForeground)] border-2 border-dashed border-[var(--vscode-panel-border)] rounded-lg"
                role="status"
                aria-live="polite"
              >
                <p className="mb-2 font-semibold">No scan results yet.</p>
                <p className="text-sm">Open a C/C++ file and run a scan to see vulnerabilities.</p>
              </div>
            )}
          </>
        ) : (
          reportData ? (
            <ReportPanel
              data={reportData}
              onExport={handleExportReport}
              onVulnerabilityClick={handleVulnerabilityClick}
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center p-8 text-center text-[var(--vscode-descriptionForeground)] border-2 border-dashed border-[var(--vscode-panel-border)] rounded-lg"
              role="status"
            >
              <p className="mb-2 font-semibold">No report generated yet.</p>
              <p className="text-sm">Run a scan first to generate a security report.</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}

export default App;

import React, { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react';
import { Toaster } from 'sonner';
import { type ScanResultPayload, type ReportData, type GitStatusPayload, type GateStatusPayload, type ActionResultPayload, MessageType } from './types';
import { Header, type ScanState, type ScanScope } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { SecurityGateCompact, type GateResult } from './components/SecurityGateCompact';
import { type Finding, type SeverityFilter, type GroupBy, type SortBy } from './components/FindingsList';
import { ReportPanel } from './components/ReportPanel';
import { ScanProgressOverlay } from './components/ScanProgressOverlay';
import { EmptyState } from './components/EmptyState';
import { messages, state, type ScanStatusPayload } from './utilities/messages';
import { showSuccess, showError } from './lib/toast';

const FindingsList = React.lazy(() => import('./components/FindingsList'));
const GitQuickActions = React.lazy(() => import('./components/GitQuickActions'));

type ViewMode = 'dashboard' | 'report';

const getStatusFromScan = (scanStatus: ScanStatusPayload, scanResult: ScanResultPayload | null): ScanState => {
  if (scanStatus.status === 'scanning') return 'SCANNING';
  if (scanStatus.status === 'completed' || scanResult) return 'COMPLETE';
  return 'IDLE';
};

const getGateStatusFromScan = (scanStatus: ScanStatusPayload, scanResult: ScanResultPayload | null): GateResult => {
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

const convertToFindings = (scanResult: ScanResultPayload | null): Finding[] => {
  if (!scanResult?.vulnerabilities) return [];
  return scanResult.vulnerabilities.map((v, index) => ({
    id: `finding-${index}`,
    severity: (v.severity?.toLowerCase() || 'medium') as Finding['severity'],
    title: v.type || 'Unknown Vulnerability',
    description: v.description,
    file: v.file || 'unknown',
    line: v.range?.startLine || 0,
  }));
};

const getGateMessage = (status: GateResult): string => {
  switch (status) {
    case 'PASSED':
      return 'Ready to commit · No blocking issues';
    case 'WARNING':
      return 'Review recommended · High severity issues found';
    case 'FAILED':
      return 'Blocked · Critical issues must be resolved';
    case 'PENDING':
      return 'Analyzing code...';
    default:
      return 'Run a scan to check security status';
  }
};

const getBlockedBy = (scanResult: ScanResultPayload | null): string[] => {
  if (!scanResult?.summary) return [];
  const blocked: string[] = [];
  if (scanResult.summary.critical > 0) {
    blocked.push(`${scanResult.summary.critical} Critical`);
  }
  if (scanResult.summary.high > 0) {
    blocked.push(`${scanResult.summary.high} High`);
  }
  return blocked;
};

function App() {
  const [scanResult, setScanResult] = useState<ScanResultPayload | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatusPayload>({ status: 'idle' });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const savedState = state.get();
    return savedState?.viewMode || 'dashboard';
  });

  const [gitStatus, setGitStatus] = useState<GitStatusPayload | null>(null);
  const [gateStatusData, setGateStatusData] = useState<GateStatusPayload | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [sortBy, setSortBy] = useState<SortBy>('severity');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanScope, setScanScope] = useState<ScanScope>('file');

  const dashboardTabRef = useRef<HTMLButtonElement>(null);
  const reportTabRef = useRef<HTMLButtonElement>(null);

  const handleTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabs = [dashboardTabRef.current, reportTabRef.current].filter(Boolean) as HTMLButtonElement[];
    const currentIndex = tabs.findIndex(tab => tab === event.currentTarget);
    
    let nextIndex: number | null = null;
    
    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case 'ArrowRight':
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab && !nextTab.disabled) {
      nextTab.focus();
      nextTab.click();
    }
  }, []);

  const status = getStatusFromScan(scanStatus, scanResult);
  const gateStatus = gateStatusData?.status as GateResult ?? getGateStatusFromScan(scanStatus, scanResult);
  const gateProgress = gateStatusData?.progress ?? scanStatus.progress ?? (scanStatus.status === 'completed' ? 100 : 0);
  
  const findings = useMemo(() => convertToFindings(scanResult), [scanResult]);
  
  const blockedBy = useMemo(() => getBlockedBy(scanResult), [scanResult]);
  const gateMessage = useMemo(() => getGateMessage(gateStatus), [gateStatus]);

  const handleScan = useCallback((scope: ScanScope) => {
    setScanScope(scope);
    switch (scope) {
      case 'file':
        messages.scanCurrentFile();
        break;
      case 'workspace':
        messages.scanWorkspace();
        break;
      case 'selection':
        messages.scanSelection();
        break;
    }
  }, []);

  const handleSettings = useCallback(() => {
    messages.openSettings();
  }, []);

  const handleCancel = useCallback(() => {
    messages.cancelScan();
  }, []);

  const handleFilterChange = useCallback((newFilter: SeverityFilter) => {
    setFilter(newFilter);
  }, []);

  const handleGroupByChange = useCallback((newGroupBy: GroupBy) => {
    setGroupBy(newGroupBy);
  }, []);

  const handleSortByChange = useCallback((newSortBy: SortBy) => {
    setSortBy(newSortBy);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFindingClick = useCallback((finding: Finding) => {
    messages.revealFinding({ file: finding.file, line: finding.line });
  }, []);

  const handleViewCode = useCallback((finding: Finding) => {
    messages.revealFinding({ file: finding.file, line: finding.line });
  }, []);

  const handleCommit = useCallback(() => {
    messages.commitWithGate();
  }, []);

  const handlePush = useCallback(() => {
    messages.pushWithGate();
  }, []);

  const handlePull = useCallback(() => {
    messages.pullWithScan();
  }, []);

  const handleCardClick = useCallback((severity: 'critical' | 'high' | 'medium' | 'low') => {
    setFilter(severity);
  }, []);

  useEffect(() => {
    if (viewMode === 'report' && !reportData) {
      setViewMode('dashboard');
      state.update({ viewMode: 'dashboard' });
    }
  }, [viewMode, reportData]);

  useEffect(() => {
    const processMessage = (message: any) => {
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
          if (message.payload?.status === 'completed') {
            showSuccess('Scan completed successfully');
            setIsRetrying(false);
            setRetryCount(0);
            setTimeout(() => {
              setScanStatus({ status: 'idle' });
            }, 2000);
          } else if (message.payload?.status === 'error') {
            const errorMsg = message.payload?.message || 'Scan failed';
            const isNetworkError = errorMsg.toLowerCase().includes('network') || 
                                   errorMsg.toLowerCase().includes('timeout') ||
                                   errorMsg.toLowerCase().includes('connection');
            
            if (isNetworkError && retryCount < MAX_RETRIES) {
              setIsRetrying(true);
              setRetryCount(prev => prev + 1);
              setTimeout(() => {
                messages.runScan({ scope: scanScope });
              }, 2000);
            } else {
              setIsRetrying(false);
              setRetryCount(0);
              showError(errorMsg);
            }
          }
          break;
        case MessageType.GIT_STATUS:
          setGitStatus(message.payload);
          setIsConnecting(false);
          break;
        case MessageType.GATE_STATUS:
          setGateStatusData(message.payload);
          break;
        case MessageType.ACTION_RESULT: {
          const result = message.payload as ActionResultPayload;
          if (result.success) {
            showSuccess(result.message || `${result.action} completed`);
          } else {
            showError(result.error || `${result.action} failed`);
          }
          break;
        }
      }
    };

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'batch' && Array.isArray(message.messages)) {
        message.messages.forEach(processMessage);
      } else {
        processMessage(message);
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

  const handleRunScan = () => {
    messages.runScan({ scope: 'file' });
  };

  return (
    <div className="app">
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--vscode-notifications-background)',
            color: 'var(--vscode-notifications-foreground)',
            border: '1px solid var(--vscode-notifications-border)',
            borderRadius: '4px',
          },
        }}
      />
      <ScanProgressOverlay 
        status={scanStatus} 
        onClose={() => setScanStatus({ status: 'idle' })}
      />
      
      {isRetrying && (
        <div className="fixed inset-0 bg-[var(--vscode-editor-background)]/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3 p-6 bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-lg shadow-lg">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--vscode-progressBar-background)] border-t-[var(--vscode-button-background)] rounded-full"></div>
            <span className="text-sm font-medium text-[var(--vscode-foreground)]">Retrying...</span>
            <span className="text-xs text-[var(--vscode-descriptionForeground)]">
              Attempt {retryCount} of {MAX_RETRIES}
            </span>
          </div>
        </div>
      )}
      
      {isConnecting && (
        <div className="fixed inset-0 bg-[var(--vscode-editor-background)] bg-opacity-80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3 p-6 bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-lg shadow-lg">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--vscode-progressBar-background)] border-t-[var(--vscode-button-background)] rounded-full"></div>
            <span className="text-sm text-[var(--vscode-descriptionForeground)]">Connecting to extension...</span>
          </div>
        </div>
      )}

      <Header
        scanState={status}
        gateResult={gateStatus === 'PASSED' ? 'PASSED' : gateStatus === 'FAILED' ? 'FAILED' : gateStatus === 'WARNING' ? 'WARNING' : 'PENDING'}
        scanScope={scanScope}
        currentFile={undefined}
        onScan={handleScan}
        onSettings={handleSettings}
        onCancel={handleCancel}
      />

      <main className="app-content" role="main" aria-label="Devign Scanner Dashboard">
        <div className="flex items-center gap-2 border-b border-[var(--vscode-panel-border)] pb-3 mb-4" role="tablist" aria-label="View mode tabs">
          <button
            ref={dashboardTabRef}
            id="dashboard-tab"
            onClick={() => handleViewModeChange('dashboard')}
            onKeyDown={handleTabKeyDown}
            className={`px-3 py-1.5 rounded text-sm font-medium ${viewMode === 'dashboard'
              ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
              : 'text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)]'
            }`}
            role="tab"
            aria-selected={viewMode === 'dashboard'}
            aria-controls="dashboard-panel"
            tabIndex={viewMode === 'dashboard' ? 0 : -1}
          >
            Dashboard
          </button>
          <button
            ref={reportTabRef}
            id="report-tab"
            onClick={() => reportData && handleViewModeChange('report')}
            onKeyDown={handleTabKeyDown}
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
            tabIndex={viewMode === 'report' ? 0 : -1}
            title={!reportData ? 'No report data available. Run a scan first.' : undefined}
          >
            Report
            {!reportData && <span className="text-xs opacity-70">(empty)</span>}
          </button>
        </div>

        <div
          id="dashboard-panel"
          role="tabpanel"
          aria-labelledby="dashboard-tab"
          hidden={viewMode !== 'dashboard'}
        >
          {viewMode === 'dashboard' && (
            <>
              <StatsCards
                critical={scanResult?.summary.critical || 0}
                high={scanResult?.summary.high || 0}
                medium={scanResult?.summary.medium || 0}
                low={scanResult?.summary.low || 0}
                onCardClick={handleCardClick}
              />

              <SecurityGateCompact
                scanState={status}
                gateResult={gateStatus}
                progress={gateProgress}
                message={gateMessage}
                blockedBy={blockedBy}
              />

              {findings.length > 0 ? (
                <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-[var(--vscode-progressBar-background)] border-t-[var(--vscode-button-background)] rounded-full"></div></div>}>
                  <FindingsList
                    findings={findings}
                    filter={filter}
                    groupBy={groupBy}
                    sortBy={sortBy}
                    searchQuery={searchQuery}
                    onFilterChange={handleFilterChange}
                    onGroupByChange={handleGroupByChange}
                    onSortByChange={handleSortByChange}
                    onSearchChange={handleSearchChange}
                    onFindingClick={handleFindingClick}
                    onViewCode={handleViewCode}
                  />
                </Suspense>
              ) : (
                <EmptyState
                  icon="codicon-shield"
                  title="No Scan Results"
                  description="Open a C/C++ file and run a scan to detect potential vulnerabilities in your code."
                  primaryAction={{
                    label: 'Run Scan',
                    onClick: handleRunScan,
                    icon: 'codicon-play'
                  }}
                />
              )}

              {gitStatus && (
                <Suspense fallback={<div className="flex items-center justify-center py-4"><div className="animate-spin w-5 h-5 border-2 border-[var(--vscode-progressBar-background)] border-t-[var(--vscode-button-background)] rounded-full"></div></div>}>
                  <GitQuickActions
                    branch={gitStatus.branch}
                    stagedCount={gitStatus.staged?.length || 0}
                    unstagedCount={gitStatus.unstaged?.length || 0}
                    isCommitting={false}
                    isPushing={gitStatus.isPushing || false}
                    isPulling={gitStatus.isPulling || false}
                    onCommit={handleCommit}
                    onPush={handlePush}
                    onPull={handlePull}
                  />
                </Suspense>
              )}
            </>
          )}
        </div>

        <div
          id="report-panel"
          role="tabpanel"
          aria-labelledby="report-tab"
          hidden={viewMode !== 'report'}
        >
          {viewMode === 'report' && (
            reportData ? (
              <ReportPanel
                data={reportData}
                onExport={handleExportReport}
                onVulnerabilityClick={handleVulnerabilityClick}
              />
            ) : (
              <EmptyState
                icon="codicon-file-text"
                title="No Report Generated"
                description="Run a vulnerability scan first to generate a detailed security report."
                primaryAction={{
                  label: 'Run Scan',
                  onClick: handleRunScan,
                  icon: 'codicon-play'
                }}
                secondaryAction={{
                  label: 'Go to Dashboard',
                  onClick: () => handleViewModeChange('dashboard')
                }}
              />
            )
          )}
        </div>
      </main>

      <style>{`
        .app {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: var(--vscode-editor-background);
          color: var(--vscode-foreground);
          font-family: var(--vscode-font-family);
        }
        
        .app-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4, 16px);
          display: flex;
          flex-direction: column;
          gap: var(--space-4, 16px);
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        }
      `}</style>
    </div>
  );
}

export default App;

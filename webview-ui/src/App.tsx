import { useState, useEffect } from 'react';
import './App.css';
import { type ScanResultPayload, MessageType } from './types';
import { ScanResults } from './components/ScanResults';
import { Dashboard } from './components/Dashboard';
import { SecurityGate, type GateStatus } from './components/SecurityGate';
import { GitPanel } from './components/GitPanel';

function App() {
  const [scanResult, setScanResult] = useState<ScanResultPayload | null>(null);

  // Mock data for new components (will be replaced by real data later)
  const [gateStatus] = useState<GateStatus>('PENDING');
  const [gateProgress] = useState(0);
  const [gitStatus] = useState({
    branch: 'feature/slice-2',
    staged: ['src/components/Dashboard.tsx', 'src/components/SecurityGate.tsx'],
    unstaged: ['src/App.tsx']
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case MessageType.SCAN_RESULT:
          setScanResult(message.payload);
          break;
        case MessageType.SCAN_STATUS:
          // Handle status updates if needed
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)] font-[var(--vscode-font-family)]">
      <main className="p-4 flex flex-col gap-4 max-w-4xl mx-auto" role="main" aria-label="Devign Scanner Dashboard">
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
              stagedFiles={gitStatus.staged}
              unstagedFiles={gitStatus.unstaged}
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
      </main>
    </div>
  );
}

export default App;

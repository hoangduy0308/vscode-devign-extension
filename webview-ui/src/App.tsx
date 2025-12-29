import { useState, useEffect } from 'react';
import './App.css';
import { type ScanResultPayload, MessageType } from './types';
import { ScanResults } from './components/ScanResults';

function App() {
  const [scanResult, setScanResult] = useState<ScanResultPayload | null>(null);

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
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {scanResult ? (
        <ScanResults results={scanResult} />
      ) : (
        <div className="flex flex-col items-center justify-center h-screen p-4 text-center text-gray-500">
          <p className="mb-2">No scan results yet.</p>
          <p className="text-sm">Open a C/C++ file and run a scan to see vulnerabilities.</p>
        </div>
      )}
    </div>
  );
}

export default App;

import React, { useState, useMemo } from 'react';
import { type ScanResultPayload, Severity, MessageType } from '../types';
import { vscode } from '../utilities/vscode';

interface ScanResultsProps {
    results: ScanResultPayload;
}

const SeverityColors = {
    [Severity.CRITICAL]: 'bg-red-600 text-white',
    [Severity.HIGH]: 'bg-orange-500 text-white',
    [Severity.MEDIUM]: 'bg-yellow-500 text-black',
    [Severity.LOW]: 'bg-blue-500 text-white'
};

export const ScanResults: React.FC<ScanResultsProps> = ({ results }) => {
    const [filters, setFilters] = useState<Set<Severity>>(new Set(Object.values(Severity)));

    const toggleFilter = (severity: Severity) => {
        const newFilters = new Set(filters);
        if (newFilters.has(severity)) {
            newFilters.delete(severity);
        } else {
            newFilters.add(severity);
        }
        setFilters(newFilters);
    };

    const filteredVulnerabilities = useMemo(() => {
        return results.vulnerabilities.filter(v => filters.has(v.severity));
    }, [results.vulnerabilities, filters]);

    const handleOpenFile = (file: string, range: any) => {
        vscode.postMessage({
            type: MessageType.OPEN_FILE,
            payload: { path: file, range }
        });
    };

    return (
        <div className="p-4 flex flex-col gap-4">
            {/* Header / Summary */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
                <h2 className="text-xl font-bold">Scan Results</h2>
                <div className="text-sm text-gray-500">
                    {results.filesScanned} files scanned
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {(Object.keys(Severity) as Array<keyof typeof Severity>).map((key) => {
                    const sev = Severity[key];
                    const isActive = filters.has(sev);
                    return (
                        <button
                            key={sev}
                            onClick={() => toggleFilter(sev)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${isActive
                                ? SeverityColors[sev]
                                : 'bg-gray-100 text-gray-400 border-gray-200'
                                }`}
                        >
                            {sev} ({results.summary[sev.toLowerCase() as keyof typeof results.summary]})
                        </button>
                    );
                })}
            </div>

            {/* List */}
            <div className="flex flex-col gap-3">
                {filteredVulnerabilities.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        No vulnerabilities found matching filters.
                    </div>
                ) : (
                    filteredVulnerabilities.map((vuln) => (
                        <div
                            key={vuln.id}
                            className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800 dark:border-gray-700"
                            onClick={() => handleOpenFile(vuln.file, vuln.range)}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex gap-2 items-center">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${SeverityColors[vuln.severity]}`}>
                                        {vuln.severity}
                                    </span>
                                    <span className="font-mono text-xs text-gray-500">
                                        {vuln.type}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400">
                                    Conf: {(vuln.confidence * 100).toFixed(0)}%
                                </span>
                            </div>

                            <p className="text-sm mb-2 font-medium">{vuln.description}</p>

                            <div className="text-xs text-gray-500 font-mono truncate" title={vuln.file}>
                                {vuln.file}:{vuln.range.startLine}
                            </div>

                            {vuln.snippet && (
                                <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-x-auto font-mono text-gray-600 dark:text-gray-300">
                                    {vuln.snippet}
                                </pre>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
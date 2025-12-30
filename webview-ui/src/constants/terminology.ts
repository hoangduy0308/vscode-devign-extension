/**
 * Terminology Constants for Devign Extension
 * 
 * This file defines standardized terminology used throughout the UI.
 * Use these constants to ensure consistency across all components.
 */

// Severity Labels (standardized)
export const SEVERITY_LABELS = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
} as const;

// Severity Descriptions
export const SEVERITY_DESCRIPTIONS = {
  CRITICAL: 'Requires immediate attention. May lead to severe security breaches.',
  HIGH: 'Should be addressed soon. Significant security risk.',
  MEDIUM: 'Should be reviewed. Moderate security concern.',
  LOW: 'Minor issue. Consider addressing when convenient.'
} as const;

// Finding vs Vulnerability vs Issue
// We use "vulnerability" as the primary term for security issues
export const TERMINOLOGY = {
  // Primary term for security issues found by scanner
  FINDING: 'vulnerability',
  FINDING_PLURAL: 'vulnerabilities',
  
  // Action labels
  SCAN: 'Scan',
  RUN_SCAN: 'Run Scan',
  CANCEL_SCAN: 'Cancel Scan',
  RETRY_SCAN: 'Retry Scan',
  
  // Status labels
  SCANNING: 'Scanning',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  IDLE: 'Ready',
  
  // UI labels
  RESULTS: 'Results',
  REPORT: 'Report',
  DASHBOARD: 'Dashboard',
  SETTINGS: 'Settings',
  
  // Actions
  EXPORT: 'Export',
  COPY: 'Copy',
  OPEN_FILE: 'Open File',
  VIEW_DETAILS: 'View Details'
} as const;

// Microcopy - helpful text throughout the UI
export const MICROCOPY = {
  // Empty states
  NO_RESULTS: 'No scan results yet',
  NO_RESULTS_DESCRIPTION: 'Open a C/C++ file and run a scan to detect potential vulnerabilities in your code.',
  NO_REPORT: 'No report generated',
  NO_REPORT_DESCRIPTION: 'Run a vulnerability scan first to generate a detailed security report.',
  NO_MATCHES: 'No vulnerabilities match your search',
  ALL_CLEAR: 'No vulnerabilities found matching filters',
  
  // Progress states
  CONNECTING: 'Connecting to extension...',
  LOADING_GIT: 'Loading git status...',
  SCANNING_PROGRESS: 'Analyzing your code for potential security vulnerabilities...',
  
  // Success states
  SCAN_COMPLETE: 'Scan complete',
  SCAN_COMPLETE_DESCRIPTION: 'Analysis finished. Review the results below.',
  
  // Error states
  SCAN_FAILED: 'Scan failed',
  SCAN_FAILED_DESCRIPTION: 'An error occurred during the scan. Please try again.',
  
  // Tooltips
  COPY_TOOLTIP: 'Copy to clipboard',
  SEVERITY_FILTER_TOOLTIP: 'Filter by severity level',
  SORT_TOOLTIP: 'Sort vulnerabilities',
  GROUP_TOOLTIP: 'Group vulnerabilities by file',
  
  // Keyboard hints
  KEYBOARD_HINT: 'j/k to navigate, Enter to open, c to copy'
} as const;

// Gate status labels
export const GATE_STATUS_LABELS = {
  PASSED: 'Passed',
  FAILED: 'Failed',
  WARNING: 'Warning',
  PENDING: 'Pending'
} as const;

export const GATE_STATUS_DESCRIPTIONS = {
  PASSED: 'No critical or high severity vulnerabilities found.',
  FAILED: 'Critical vulnerabilities detected. Commit blocked.',
  WARNING: 'High severity vulnerabilities found. Review before committing.',
  PENDING: 'Scan in progress...'
} as const;

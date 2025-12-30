# Security Policy

## Supported Versions

Only the latest version of the Devign VS Code Extension is currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of this extension seriously. If you believe you have found a security vulnerability in the Devign VS Code Extension, please report it to us as follows:

1.  **Do not open a public issue.** This allows us to assess the risk and fix the issue before it can be exploited.
2.  Email the details of the vulnerability to [hoangduy0308@gmail.com](mailto:hoangduy0308@gmail.com) (or the maintainer's email if different).
3.  Include as much information as possible to help us reproduce the issue:
    -   A description of the vulnerability.
    -   Steps to reproduce.
    -   Example code or configuration that triggers the issue.
    -   Potential impact.

## Response Process

1.  We will acknowledge receipt of your report within 48 hours.
2.  We will investigate the issue and determine its severity.
3.  We will work on a fix and release a patched version of the extension.
4.  Once the fix is released, we will publicly disclose the vulnerability (if appropriate) and credit you for the discovery.

## Security Features

This extension is designed to help you *find* security vulnerabilities in your C/C++ code. However, the extension itself runs within VS Code and has access to your workspace.

-   **Model Execution**: The vulnerability detection model runs locally on your machine (unless configured otherwise). No code is sent to external servers for scanning by default.
-   **Dependencies**: We strive to keep our dependencies up-to-date to minimize supply chain risks.

## Disclaimer

This tool is provided "as is" without warranty of any kind. While we strive to provide accurate results, false positives and false negatives may occur. Always verify the findings and use your best judgment when addressing security issues.
# Security Policy

## Supported Versions

Only the latest version of the Devign VS Code Extension is currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Model Overview

Devign is a VS Code extension for detecting vulnerabilities in C/C++ code using a local ONNX-based machine learning model. The extension is designed with security-first principles:

- **Local execution** – All scanning runs on your machine; no code leaves your environment
- **Sandboxed webview** – Strict Content Security Policy prevents XSS attacks
- **Safe Git integration** – Uses VS Code's Git extension API instead of shell commands
- **Validated messages** – All webview ↔ extension communication is type-checked

## Data Privacy

**No data is sent to external servers.**

- The vulnerability detection model runs entirely locally via ONNX Runtime
- Scan results are stored only in memory and optionally exported to local SARIF/HTML files
- No telemetry, analytics, or crash reporting is collected
- Configuration is stored in VS Code's settings (local `settings.json`)

## Content Security Policy (CSP)

The extension webview enforces a strict CSP defined in [`src/webview/DevignWebviewProvider.ts`](src/webview/DevignWebviewProvider.ts):

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  style-src ${webview.cspSource};
  script-src 'nonce-${nonce}';
">
```

This policy:
- Blocks all inline scripts except those with a cryptographic nonce
- Restricts styles to VS Code's webview source
- Prevents loading external resources

## Webview Message Validation

All messages between the webview and extension are validated before processing. See [`src/webview/DevignWebviewProvider.ts`](src/webview/DevignWebviewProvider.ts):

```typescript
private _isValidMessage(data: unknown): data is { type: MessageType; payload?: unknown } {
    if (!data || typeof data !== 'object') return false;
    if (!VALID_MESSAGE_TYPES.has(msg.type as MessageType)) return false;
    return true;
}
```

Invalid messages are logged and ignored to prevent injection attacks.

## Token Storage

The extension uses VS Code's secure authentication API for any credential storage:

- GitHub tokens are managed via `vscode.authentication.getSession()`
- No secrets are stored in plain text or extension settings
- Credentials are isolated per workspace when applicable

## Git Integration Safety

Git operations are performed exclusively through VS Code's Git extension API:

- **No shell command execution** – All operations use the `vscode.git` extension API
- File paths are validated before Git operations
- Branch names are sanitized to prevent command injection
- See [`src/services/gitService.ts`](src/services/gitService.ts)

## Model Download Verification

ONNX model files are verified using SHA-256 checksums:

- Model checksums are defined in configuration
- Downloads are verified before the model is loaded
- Corrupted or tampered models are rejected
- See model initialization in [`src/scanner/onnxScanner.ts`](src/scanner/onnxScanner.ts)

## Vulnerability Disclosure Policy

### Reporting a Vulnerability

We take security seriously. If you discover a vulnerability:

1. **Do not open a public issue** – This allows us to assess and fix before disclosure
2. **Email details to** [hoangduy0308@gmail.com](mailto:hoangduy0308@gmail.com)
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Example code or configuration
   - Potential impact assessment

### Response Process

1. We acknowledge receipt within **48 hours**
2. We investigate and determine severity
3. We develop and test a fix
4. We release a patched version
5. We publicly disclose (if appropriate) and credit the reporter

## Security Checklist for Contributors

Before submitting a PR, verify:

- [ ] **No secrets in code** – API keys, tokens, and credentials must never be committed
- [ ] **Input validation** – All user/webview inputs are validated
- [ ] **Path sanitization** – File paths are validated and normalized
- [ ] **No `eval()` or `Function()`** – Dynamic code execution is prohibited
- [ ] **No shell commands** – Use VS Code APIs instead of `child_process.exec()`
- [ ] **CSP compliance** – Webview changes maintain strict Content Security Policy
- [ ] **Message type validation** – New message types are added to `MessageType` enum
- [ ] **Dependencies audited** – Run `npm audit` before adding new packages
- [ ] **Error messages** – Don't expose sensitive paths or internal details in errors

### Code Review Focus Areas

| Area | Security Concern |
|------|------------------|
| `src/webview/` | CSP, message validation, XSS prevention |
| `src/services/gitService.ts` | Command injection, path traversal |
| `src/scanner/` | Model integrity, resource exhaustion |
| `webview-ui/` | Input sanitization, secure rendering |

## Disclaimer

This tool is provided "as is" without warranty of any kind. While we strive to provide accurate vulnerability detection, false positives and false negatives may occur. Always verify findings and use professional judgment when addressing security issues.

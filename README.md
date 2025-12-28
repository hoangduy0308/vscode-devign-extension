# Devign C/C++ Vulnerability Scanner - VS Code Extension

🛡️ AI-powered vulnerability detection for C/C++ code using BiGRU deep learning model.

![Extension Demo](media/demo.gif)

## Features

- **Real-time Scanning**: Automatically scan C/C++ files on save
- **Manual Scanning**: Scan current file or entire workspace on demand
- **Code Selection**: Scan selected code snippets
- **Visual Diagnostics**: Vulnerabilities shown in Problems panel with severity levels
- **Status Bar**: Quick status indicator showing scan results
- **Risk Levels**: CRITICAL, HIGH, MEDIUM, LOW classification
- **Dangerous API Detection**: Identifies risky function calls (malloc, strcpy, sprintf, etc.)

## Requirements

- **Python 3.8+** with PyTorch installed
- **Devign Model Files**: 
  - Model checkpoint (`.pt` file)
  - `vocab.json`
  - `config.json`
- **devign_pipeline** module installed

## Installation

### 1. Install Extension

```bash
cd vscode-devign-extension
npm install
npm run compile
```

### 2. Install from VSIX

```bash
npm run package
# Creates devign-vulnerability-scanner-1.0.0.vsix
code --install-extension devign-vulnerability-scanner-1.0.0.vsix
```

### 3. Setup Model

1. Download or copy model files to a directory:
   ```
   models/
   ├── best_v2_seed42.pt
   ├── vocab.json
   └── config.json
   ```

2. Configure extension settings (see below)

## Configuration

Open VS Code Settings (`Ctrl+,`) and search for "Devign":

| Setting | Default | Description |
|---------|---------|-------------|
| `devign.pythonPath` | `python` | Path to Python executable |
| `devign.modelPath` | (auto) | Path to model directory |
| `devign.threshold` | `0.5` | Vulnerability probability threshold (0.0 - 1.0) |
| `devign.scanOnSave` | `true` | Scan files automatically on save |
| `devign.scanOnOpen` | `false` | Scan files when opened |
| `devign.showNotifications` | `true` | Show popup notifications for findings |
| `devign.maxFilesToScan` | `100` | Maximum files for workspace scan |
| `devign.device` | `auto` | Inference device (auto/cpu/cuda) |

### Example settings.json

```json
{
    "devign.pythonPath": "C:\\Python310\\python.exe",
    "devign.modelPath": "C:\\Models\\devign",
    "devign.threshold": 0.6,
    "devign.scanOnSave": true,
    "devign.device": "cuda"
}
```

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` | Scan current file |

### Commands

Open Command Palette (`Ctrl+Shift+P`) and type "Devign":

- **Devign: Scan Current File** - Scan active C/C++ file
- **Devign: Scan Workspace** - Scan all C/C++ files in workspace
- **Devign: Scan Selected Code** - Scan highlighted code snippet
- **Devign: Show Results** - Open results panel
- **Devign: Clear Diagnostics** - Clear all warnings

### Context Menu

Right-click on a C/C++ file in editor or explorer to scan.

## Security Gate (IDE-first)

🚦 **Security Gate** scans your staged files before commit/push to prevent vulnerable code from entering your repository.

### What is Security Gate?

Security Gate is a pre-commit/pre-push scanning feature that automatically checks your staged C/C++ files for vulnerabilities before you commit or push. Unlike traditional git hooks, Devign uses an **IDE-first approach** - all gate operations are triggered through VS Code commands and UI, giving you full control and visibility.

### Limitation: No Git Hooks

> ⚠️ **Important**: Security Gate does NOT install git hooks. Instead, it uses VS Code commands.

This IDE-first approach means:
- ✅ No global git hook conflicts
- ✅ Works consistently across all platforms
- ✅ Easy to enable/disable without modifying `.git/hooks`
- ✅ Visual feedback and interactive dialogs
- ❌ Won't block commits made outside VS Code (CLI, other IDEs)

### How to Use

#### 1. Enable Security Gate

Add to your `settings.json`:
```json
{
    "devign.gate.enabled": true
}
```

#### 2. Use Gate Commands

Open Command Palette (`Ctrl+Shift+P`) and use:

| Command | Description |
|---------|-------------|
| **Devign: Commit with Gate** | Scan staged files, then commit if passed |
| **Devign: Push with Gate** | Scan staged files, then push if passed |

#### 3. Or Use Sidebar Buttons

1. Open the **Devign** sidebar (click shield icon in Activity Bar)
2. Find the **Security Gate** section
3. Click **Commit with Gate** or **Push with Gate** buttons

### Gate Decisions

After scanning, the gate makes one of three decisions:

| Decision | Icon | Action |
|----------|------|--------|
| **PASS** | ✅ | Proceed with commit/push automatically |
| **WARN** | ⚠️ | Show confirmation dialog - you decide to proceed or cancel |
| **BLOCK** | 🛑 | Cancel operation - vulnerabilities must be fixed first |

### Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `devign.gate.enabled` | `false` | Enable/disable Security Gate |
| `devign.gate.onCommit` | `true` | Run gate before commit operations |
| `devign.gate.onPush` | `true` | Run gate before push operations |
| `devign.gate.blockOnRiskLevels` | `["CRITICAL", "HIGH"]` | Risk levels that block commit/push |
| `devign.gate.excludeGlobs` | `[]` | File patterns to exclude (e.g., `["**/third_party/**"]`) |
| `devign.gate.maxFilesToScan` | `50` | Maximum files to scan per gate run |
| `devign.gate.fallbackMode` | `"warn"` | Action when scan fails: `"allow"`, `"warn"`, or `"block"` |

### Example Configuration

```json
{
    "devign.gate.enabled": true,
    "devign.gate.onCommit": true,
    "devign.gate.onPush": true,
    "devign.gate.blockOnRiskLevels": ["CRITICAL", "HIGH"],
    "devign.gate.excludeGlobs": [
        "**/third_party/**",
        "**/vendor/**",
        "**/test/**"
    ],
    "devign.gate.maxFilesToScan": 100,
    "devign.gate.fallbackMode": "warn"
}
```

### Quick Start

1. **Enable gate**: Set `devign.gate.enabled: true` in settings
2. **Stage your changes**: `git add <files>`
3. **Commit with gate**: Run "Devign: Commit with Gate" from Command Palette
4. **Review results**: Fix any CRITICAL/HIGH vulnerabilities if blocked
5. **Push with gate**: Run "Devign: Push with Gate" when ready

## Understanding Results

### Risk Levels

| Level | Probability | Severity | Description |
|-------|-------------|----------|-------------|
| 🔴 CRITICAL | ≥90% | Error | Highly likely vulnerability |
| 🟠 HIGH | ≥75% | Error | Probable vulnerability |
| 🟡 MEDIUM | ≥50% | Warning | Possible vulnerability |
| 🔵 LOW | <50% | Info | Minor concern |

### Detected Patterns

The model detects 26 vulnerability features including:
- Pointer dereference without null check
- Array access without bounds check
- malloc() without corresponding free()
- Unchecked return values
- Dangerous API usage (gets, strcpy, sprintf, etc.)

## Example

```c
void vulnerable_function(char *input) {
    char buffer[64];
    strcpy(buffer, input);  // ⚠️ Buffer overflow risk
    
    int *ptr = malloc(sizeof(int));
    *ptr = 42;  // ⚠️ No null check after malloc
    // No free() - memory leak
}
```

The extension will highlight this file with:
- **Risk Level**: HIGH
- **Dangerous APIs**: strcpy, malloc
- **Probability**: ~85%

## Development

### Build from Source

```bash
git clone https://github.com/hoangduy0308/C-Vul-Devign
cd vscode-devign-extension
npm install
npm run compile
```

### Debug

1. Open in VS Code
2. Press `F5` to launch Extension Development Host
3. Open a C/C++ file and test

### Package for Distribution

```bash
npm run package
# Output: devign-vulnerability-scanner-1.0.0.vsix
```

## Troubleshooting

### "Scanner failed to start"
- Check Python path is correct
- Verify PyTorch is installed: `pip install torch`

### "No model file found"
- Set `devign.modelPath` to directory containing `.pt` files

### "Module not found: devign_infer"
- Install devign_pipeline: `pip install -e devign_pipeline/`

### Slow scanning
- Use GPU: set `devign.device` to `cuda`
- Reduce `devign.maxFilesToScan` for large workspaces

## License

MIT License - See [LICENSE](LICENSE)

## Related

- [Devign Paper](https://arxiv.org/abs/1909.03496)
- [GitHub Repository](https://github.com/hoangduy0308/C-Vul-Devign)

# 🚀 Kế hoạch nâng cấp Devign Extension v2.0

> **Mục tiêu**: Chuyển đổi extension thành công cụ bảo mật code hiện đại với giao diện đẹp, tích hợp Git/GitHub đầy đủ, tối ưu CI/CD.

---

## 🎯 Quyết định kiến trúc

| Quyết định | Lựa chọn | Lý do |
|------------|----------|-------|
| **UI** | 100% WebView (bỏ TreeView) | Giao diện hiện đại, linh hoạt |
| **Real-time scan** | Hybrid (A + B) | Typing → scan function hiện tại, Save → scan all changed |
| **GitHub Auth** | `vscode.authentication` | An toàn, không cần OAuth secret |
| **Report format** | SARIF (primary) + HTML (render) | CI/CD native + UX tốt |
| **Python model** | Long-lived worker + ONNX | Giảm cold start, tối ưu performance |
| **Packaging** | Bundled venv trong globalStorageUri | Tránh xung đột, pin versions |

---

## ⚠️ Điểm cần lưu ý từ Review

### 🔴 Critical Issues
1. **Timeline tight**: 6-8 tuần có thể cần buffer 20-40%
2. **Protocol type safety**: `payload: unknown` → cần schema validation (zod)
3. **Worker lifecycle**: Cần xử lý crash/restart/timeout/backpressure
4. **Cancellation**: TypeScript cancel không kill Python inference

### 🟡 Missing Items
1. **Testing strategy**: Unit/integration/e2e tests
2. **Benchmarking**: Đo latency histogram, không chỉ estimate
3. **Cross-platform**: Windows/macOS/Linux paths, multi-root workspace
4. **Accessibility**: Keyboard nav, screen readers cho WebView
5. **Privacy policy**: "Code không rời máy" disclosure

### 🟢 Improvements
1. **Vertical slices**: End-to-end flow trước, không làm UI xong mới làm scanner
2. **Performance target**: p50 <100ms, p95 <250ms (thay vì hard limit)
3. **CI workflow**: Thêm permissions, caching, artifact upload

---

## 📊 Phân tích hiện trạng

### ✅ Đã có sẵn
| Component | Trạng thái | File |
|-----------|------------|------|
| TreeView Sidebar | ✅ Hoạt động | `src/sidebarProvider.ts` |
| Python Scanner (BiGRU) | ✅ Function-level | `python/vscode_scanner.py` |
| Security Gate | ✅ Commit/Push gate | `src/services/securityGateService.ts` |
| Git API Integration | ✅ Cơ bản | `src/services/gitService.ts` |
| Results WebView Panel | ✅ HTML inline | `src/resultsPanel.ts` |
| Tree-sitter Parser | ✅ C/C++ | `src/parsers/treeSitterParser.ts` |

### ⚠️ Cần nâng cấp
- UI: TreeView → WebView React
- Scanner: File-level → Real-time function-level
- Git: Cơ bản → Full operations + GitHub
- Report: Không có → JSON/SARIF/HTML export

---

## 🏗️ Kiến trúc mới đề xuất

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Webview UI    │  │   Extension     │  │   Python        │ │
│  │   (React +      │◄─┤   Core          │─►│   Worker        │ │
│  │   Tailwind)     │  │                 │  │   (BiGRU Model) │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────┘ │
│           │                    │                                 │
│           │    Messages        │                                 │
│           ▼                    ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Service Layer                             ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    ││
│  │  │ Scanner  │  │   Git    │  │  GitHub  │  │  Report  │    ││
│  │  │ Service  │  │ Service  │  │  Service │  │  Service │    ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Chi tiết từng Phase

---

## Phase 0: Chuẩn bị nền tảng
**Timeline**: 1-2 ngày | **Độ phức tạp**: Medium

### 0.1 Setup Webview React Project
```bash
# Tạo cấu trúc thư mục
webview-ui/
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   ├── Scanner/
│   │   ├── GitPanel/
│   │   ├── SecurityGate/
│   │   └── shared/
│   ├── hooks/
│   ├── stores/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

### 0.2 Dependencies cần thêm

**Webview (webview-ui/package.json)**:
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@vscode/webview-ui-toolkit": "^1.4.0",
    "zustand": "^4.5.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0"
  }
}
```

**Extension (package.json thêm)**:
```json
{
  "dependencies": {
    "octokit": "^3.1.0"
  }
}
```

### 0.3 Message Protocol Types (với Schema Validation)
```typescript
// src/types/messages.ts
import { z } from 'zod';

// Protocol version để backward compatibility
export const PROTOCOL_VERSION = '1.0';

// Extension → Webview Messages
export const ScanResultPayload = z.object({
  file: z.string(),
  findings: z.array(z.object({
    line: z.number(),
    function: z.string(),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
    probability: z.number(),
    message: z.string(),
  })),
  scanTime: z.number(),
  cached: z.boolean(),
});

export const ExtensionMessage = z.object({
  version: z.literal(PROTOCOL_VERSION),
  id: z.string().optional(), // For request-response matching
  type: z.enum(['scanResults', 'gateStatus', 'gitSnapshot', 'error', 'progress']),
  payload: z.unknown(), // Validated per type
});

// Webview → Extension Messages
export const WebviewMessage = z.object({
  version: z.literal(PROTOCOL_VERSION),
  id: z.string(), // Required for tracking
  type: z.enum(['scan', 'commit', 'push', 'pull', 'createPR', 'export', 'cancel']),
  payload: z.unknown(),
});

export type ExtensionMessageType = z.infer<typeof ExtensionMessage>;
export type WebviewMessageType = z.infer<typeof WebviewMessage>;
```

### 0.4 Python Worker Protocol (JSON-RPC 2.0)
```typescript
// Worker request/response với cancellation support
interface WorkerRequest {
  jsonrpc: "2.0";
  id: number;
  method: "scan" | "batch_scan" | "health" | "cancel" | "shutdown";
  params: {
    functions?: FunctionCode[];
    request_ids?: number[];  // For cancel
    use_cache?: boolean;
    timeout_ms?: number;
  };
}

interface WorkerResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    findings: Finding[];
    cached_count: number;
    scan_time_ms: number;
    model_version: string;
  };
  error?: {
    code: number;  // -32000: scan error, -32001: timeout, -32002: cancelled
    message: string;
    data?: unknown;
  };
}

// Worker lifecycle management
interface WorkerManager {
  spawn(): Promise<void>;
  shutdown(): Promise<void>;
  restart(): Promise<void>;
  isHealthy(): boolean;
  
  // Request handling with timeout and cancellation
  request(req: WorkerRequest, timeout?: number): Promise<WorkerResponse>;
  cancel(requestId: number): void;
  
  // Backpressure: max pending requests
  readonly pendingCount: number;
  readonly maxPending: number;
}
```

---

## Phase 1: WebView Sidebar
**Timeline**: 4-6 ngày | **Độ phức tạp**: High

### 1.1 Tasks chi tiết

| Task | Mô tả | Est. |
|------|-------|------|
| 1.1.1 | Tạo `DevignWebviewProvider` class | 4h |
| 1.1.2 | Setup React app với Vite | 2h |
| 1.1.3 | Tailwind + VS Code theme integration | 2h |
| 1.1.4 | Dashboard component (stats, model info) | 4h |
| 1.1.5 | Scan Results component (filter, sort, navigate) | 6h |
| 1.1.6 | Quick Actions component | 2h |
| 1.1.7 | Gate Status component (progress, result) | 4h |
| 1.1.8 | Message bridge (extension ↔ webview) | 4h |
| 1.1.9 | CSP security setup | 2h |
| 1.1.10 | Feature flag toggle (TreeView/WebView) | 2h |

### 1.2 UI Components Design

```
┌────────────────────────────────────┐
│  🛡️ DEVIGN SCANNER                 │
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │ DASHBOARD                    │  │
│  │ ┌─────┐ ┌─────┐ ┌─────────┐  │  │
│  │ │ 12  │ │ 3   │ │ v1.2.0  │  │  │
│  │ │Files│ │Vulns│ │ Model   │  │  │
│  │ └─────┘ └─────┘ └─────────┘  │  │
│  └──────────────────────────────┘  │
├────────────────────────────────────┤
│  ⚡ QUICK ACTIONS                  │
│  [Scan File] [Scan Workspace]      │
│  [Export Report] [Check Setup]     │
├────────────────────────────────────┤
│  🚦 SECURITY GATE                  │
│  Status: ✅ PASSED                 │
│  Last run: 2 mins ago              │
│  [Commit] [Push] [Run Gate]        │
├────────────────────────────────────┤
│  🔍 SCAN RESULTS                   │
│  ┌──────────────────────────────┐  │
│  │ 🔴 CRITICAL (2)              │  │
│  │   ├─ buffer_overflow.c:45   │  │
│  │   └─ malloc_leak.c:23       │  │
│  │ 🟠 HIGH (1)                  │  │
│  │   └─ strcpy_unsafe.c:12     │  │
│  └──────────────────────────────┘  │
├────────────────────────────────────┤
│  📊 STATUS                         │
│  Model: BiGRU v2 • GPU: CUDA      │
│  Last scan: 14:32:05              │
└────────────────────────────────────┘
```

### 1.3 DevignWebviewProvider skeleton
```typescript
// src/webview/DevignWebviewProvider.ts
export class DevignWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'devign.webviewSidebar';
  
  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist')
      ]
    };
    
    webviewView.webview.html = this.getHtmlContent(webviewView.webview);
    
    // Message handling
    webviewView.webview.onDidReceiveMessage(this.handleMessage.bind(this));
    
    // Push initial state
    this.pushState(webviewView.webview);
  }
}
```

---

## Phase 2: Nâng cấp Scanner
**Timeline**: 6-10 ngày | **Độ phức tạp**: High

### 2.1 Tasks chi tiết

| Task | Mô tả | Est. |
|------|-------|------|
| 2.1.1 | Real-time scan orchestrator | 6h |
| 2.1.2 | Debounce + cancellation logic | 4h |
| 2.1.3 | Function-level change detection | 6h |
| 2.1.4 | Diff scan (staged/unstaged) | 8h |
| 2.1.5 | Content hash cache | 4h |
| 2.1.6 | Python batch mode endpoint | 6h |
| 2.1.7 | Report export - JSON | 4h |
| 2.1.8 | Report export - SARIF | 6h |
| 2.1.9 | Report export - HTML | 4h |
| 2.1.10 | Scan history storage | 4h |

### 2.2 Real-time Scan Architecture

```typescript
// src/services/scanOrchestrator.ts
export class ScanOrchestrator {
  private scanQueue = new Map<string, CancellationTokenSource>();
  private debounceMs = 800;
  
  async onDocumentChange(doc: vscode.TextDocument, changes: vscode.TextDocumentContentChangeEvent[]) {
    // 1. Cancel pending scan for this document
    this.cancelPending(doc.uri.toString());
    
    // 2. Debounce
    await this.debounce(doc.uri.toString());
    
    // 3. Find affected functions
    const functions = await this.getAffectedFunctions(doc, changes);
    
    // 4. Check cache
    const uncached = functions.filter(f => !this.cache.has(f.hash));
    
    // 5. Scan only uncached functions
    if (uncached.length > 0) {
      const results = await this.scanFunctions(uncached);
      this.updateDiagnostics(doc, results);
    }
  }
}
```

### 2.3 Diff Scan Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Git Diff   │───►│ Parse Hunks │───►│ Map to      │
│  (staged)   │    │ (line nums) │    │ Functions   │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                   ┌─────────────┐    ┌──────▼──────┐
                   │  Scan Only  │◄───│ Filter      │
                   │  Changed    │    │ Changed Fns │
                   └──────┬──────┘    └─────────────┘
                          │
                   ┌──────▼──────┐
                   │  Report with│
                   │  Diff Context│
                   └─────────────┘
```

### 2.4 Report Formats

**SARIF (GitHub Code Scanning compatible)**:
```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": {
      "driver": {
        "name": "Devign",
        "version": "2.0.0",
        "rules": [...]
      }
    },
    "results": [...]
  }]
}
```

---

## Phase 3: Git Operations đầy đủ
**Timeline**: 5-8 ngày | **Độ phức tạp**: Medium-High

### 3.1 Tasks chi tiết

| Task | Mô tả | Est. |
|------|-------|------|
| 3.1.1 | Branch list (local/remote) | 3h |
| 3.1.2 | Create/checkout/delete branch | 4h |
| 3.1.3 | Stage/unstage files | 4h |
| 3.1.4 | Commit message editor | 4h |
| 3.1.5 | Remote selection | 3h |
| 3.1.6 | Fetch/prune | 2h |
| 3.1.7 | Pull with rebase option | 3h |
| 3.1.8 | Merge conflict detection | 4h |
| 3.1.9 | Commit history (recent) | 4h |
| 3.1.10 | Git panel UI component | 6h |

### 3.2 Git Panel UI Design

```
┌────────────────────────────────────┐
│  🌿 GIT PANEL                      │
├────────────────────────────────────┤
│  Branch: [main ▼] [+ New Branch]   │
├────────────────────────────────────┤
│  📂 STAGED (2)                     │
│    ☑ src/auth.c                    │
│    ☑ src/utils.h                   │
│  [Unstage All]                     │
├────────────────────────────────────┤
│  📝 UNSTAGED (3)                   │
│    ☐ src/main.c                    │
│    ☐ src/buffer.c                  │
│    ☐ README.md                     │
│  [Stage All]                       │
├────────────────────────────────────┤
│  💬 COMMIT MESSAGE                 │
│  ┌──────────────────────────────┐  │
│  │ Fix buffer overflow in auth  │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│  [🛡️ Commit with Gate] [Commit]   │
├────────────────────────────────────┤
│  🔄 SYNC                           │
│  ↑2 ↓1 (origin/main)              │
│  [Pull] [Push with Gate]          │
└────────────────────────────────────┘
```

### 3.3 Extended GitService

```typescript
// src/services/gitService.ts (additions)
export class GitService {
  // Existing methods...
  
  // NEW: Branch operations
  async getBranches(): Promise<Branch[]>;
  async createBranch(name: string, checkout?: boolean): Promise<void>;
  async checkoutBranch(name: string): Promise<void>;
  async deleteBranch(name: string, force?: boolean): Promise<void>;
  
  // NEW: Stage operations
  async stageFiles(paths: string[]): Promise<void>;
  async unstageFiles(paths: string[]): Promise<void>;
  async stageAll(): Promise<void>;
  async unstageAll(): Promise<void>;
  
  // NEW: Remote operations
  async getRemotes(): Promise<Remote[]>;
  async fetchRemote(remote: string): Promise<void>;
  async pruneRemote(remote: string): Promise<void>;
  
  // NEW: History
  async getRecentCommits(limit?: number): Promise<Commit[]>;
}
```

---

## Phase 4: GitHub Integration
**Timeline**: 7-12 ngày | **Độ phức tạp**: High

### 4.1 Tasks chi tiết

| Task | Mô tả | Est. |
|------|-------|------|
| 4.1.1 | VS Code Auth integration | 4h |
| 4.1.2 | Octokit setup with auth | 3h |
| 4.1.3 | Parse GitHub remote URL | 2h |
| 4.1.4 | Create PR UI | 6h |
| 4.1.5 | Create PR API call | 4h |
| 4.1.6 | PR template with scan summary | 4h |
| 4.1.7 | Issue creation from findings | 6h |
| 4.1.8 | Issue fingerprinting (avoid duplicates) | 4h |
| 4.1.9 | Issue sync (update/close) | 6h |
| 4.1.10 | SARIF upload to Code Scanning | 4h |

### 4.2 Auth Flow (Recommended)

```typescript
// src/services/githubService.ts
import { Octokit } from 'octokit';

export class GitHubService {
  private octokit: Octokit | null = null;
  
  async authenticate(): Promise<boolean> {
    try {
      // Use VS Code's built-in GitHub auth
      const session = await vscode.authentication.getSession(
        'github',
        ['repo', 'read:user'],
        { createIfNone: true }
      );
      
      this.octokit = new Octokit({
        auth: session.accessToken
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async createPullRequest(options: PROptions): Promise<string> {
    const { owner, repo, title, body, head, base } = options;
    
    const response = await this.octokit!.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base
    });
    
    return response.data.html_url;
  }
}
```

### 4.3 PR Creation UI

```
┌────────────────────────────────────┐
│  🔀 CREATE PULL REQUEST            │
├────────────────────────────────────┤
│  Repository: owner/repo            │
│                                    │
│  Base: [main ▼]                    │
│  Compare: [feature/auth-fix]       │
├────────────────────────────────────┤
│  Title:                            │
│  ┌──────────────────────────────┐  │
│  │ Fix authentication buffer    │  │
│  └──────────────────────────────┘  │
│                                    │
│  Description:                      │
│  ┌──────────────────────────────┐  │
│  │ ## Summary                   │  │
│  │ Fixed buffer overflow...     │  │
│  │                              │  │
│  │ ## Security Scan             │  │
│  │ ✅ Passed (0 vulnerabilities)│  │
│  └──────────────────────────────┘  │
│                                    │
│  ☑ Include security scan report   │
│  ☐ Create as draft                │
│                                    │
│  [Create Pull Request]             │
└────────────────────────────────────┘
```

### 4.4 Issue Fingerprinting

```typescript
// Fingerprint để tránh tạo issue trùng
function generateFingerprint(finding: Finding): string {
  return crypto
    .createHash('sha256')
    .update(`${finding.file}:${finding.function}:${finding.pattern}`)
    .digest('hex')
    .substring(0, 12);
}

// Issue body sẽ chứa hidden fingerprint
const issueBody = `
## 🛡️ Security Finding

**File:** \`${finding.file}\`
**Function:** \`${finding.function}\`
**Severity:** ${finding.severity}
**Confidence:** ${finding.probability}%

<!-- devign-fingerprint:${fingerprint} -->
`;
```

---

## 📅 Timeline tổng hợp (Revised - Vertical Slices)

```
Week 1-2:  [========] SLICE 1: End-to-end skeleton
           - Protocol types + Python worker skeleton
           - Basic WebView + 1 scan result display
           - Prove: Typing → scan → show result
           
Week 3-4:  [========] SLICE 2: Full WebView UI
           - All UI components (Dashboard, Results, Gate, Git)
           - Theme integration + Accessibility
           - CSP security
           
Week 5-6:  [========] SLICE 3: Performance + Real-time
           - ONNX conversion + benchmarking
           - Hybrid A+B scan + caching
           - SARIF export + HTML render
           
Week 7-8:  [========] SLICE 4: Git + GitHub
           - Full Git operations in UI
           - GitHub auth + PR creation
           - SARIF upload
           
Week 9:    [====] SLICE 5: CI/CD + Polish
           - CLI tool packaging
           - GitHub Actions workflow
           - Testing + Documentation
           
Week 10:   [====] Buffer + Release prep
```

**Tổng estimate**: 8-10 tuần (với 20% buffer)

---

## 🧪 Testing Strategy

### Unit Tests
```bash
# Extension tests
npm run test:unit
  - Message protocol validation (zod schemas)
  - Worker manager (spawn, restart, cancel)
  - Cache key computation
  - SARIF generation
```

### Integration Tests
```bash
# Extension + Python worker
npm run test:integration
  - Scan single function → verify result format
  - Batch scan → verify performance
  - Cancel mid-scan → verify cleanup
  - Worker crash → verify restart
```

### E2E Tests
```bash
# Full VS Code extension
npm run test:e2e
  - Open C file → auto scan → see diagnostics
  - WebView renders correctly
  - Git operations work
  - GitHub PR creation (mock)
```

### Performance Benchmarks
```bash
# Latency measurement
npm run benchmark
  - Target: p50 < 100ms, p95 < 250ms
  - Log histogram to benchmark.json
  - Compare against baseline
```

### Test Fixtures
```
tests/
├── fixtures/
│   ├── vulnerable/        # Known vulnerable code
│   ├── safe/              # Known safe code
│   ├── sarif/             # Golden SARIF outputs
│   └── edge-cases/        # Macros, templates, etc.
├── unit/
├── integration/
└── e2e/
```

---

## ⚠️ Risks & Mitigation (Updated)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Python model latency | High | ONNX + long-lived worker + cache + batch |
| Worker crash/hang | High | Watchdog + auto-restart + timeout per request |
| WebView CSP issues | Medium | Strict CSP + nonce, no remote, validate messages |
| Protocol drift | Medium | Zod validation + versioning + e2e tests |
| Tree-sitter edge cases | Medium | Golden fixtures + fallback to regex |
| Git CLI injection | High | Always use spawn args, never concat strings |
| GitHub rate limit | Low | ETag caching + exponential backoff |
| Cross-platform paths | Medium | Path normalization + CI on Win/Mac/Linux |
| Multi-root workspace | Medium | Test matrix + graceful degradation |
| Accessibility compliance | Medium | Keyboard nav + screen reader testing |

---

## 🔒 Security Checklist

- [ ] **WebView CSP**: nonce-based, no unsafe-eval, no remote
- [ ] **Message validation**: All messages validated with zod
- [ ] **Token storage**: Use `vscode.SecretStorage`, never log tokens
- [ ] **Git commands**: Spawn with args array, never shell string
- [ ] **Model download**: HTTPS + checksum verification
- [ ] **pip install**: Pin versions, use venv in globalStorageUri
- [ ] **Privacy**: Code stays local, opt-in for GitHub features
- [ ] **SARIF upload**: User consent before sending to GitHub

---

## 🔧 Development Setup

```bash
# Clone and setup
git clone https://github.com/hoangduy0308/vscode-devign-extension
cd vscode-devign-extension

# Install extension dependencies
npm install

# Setup webview
mkdir webview-ui
cd webview-ui
npm create vite@latest . -- --template react-ts
npm install tailwindcss postcss autoprefixer @vscode/webview-ui-toolkit zustand lucide-react
npx tailwindcss init -p

# Build all
cd ..
npm run build:webview
npm run compile

# Debug
# Press F5 in VS Code
```

---

## ✅ Definition of Done (per Phase)

### Phase 0
- [ ] Webview React app builds successfully
- [ ] Message types defined
- [ ] Feature flag working

### Phase 1
- [ ] WebView sidebar renders
- [ ] All TreeView features migrated
- [ ] Theme follows VS Code
- [ ] Navigate to file works
- [ ] Gate status updates real-time

### Phase 2
- [ ] Real-time scan triggers on typing
- [ ] Diff scan works for staged files
- [ ] Export JSON/SARIF/HTML works
- [ ] Performance acceptable (< 500ms per function)

### Phase 3
- [ ] All branch operations work
- [ ] Stage/unstage works
- [ ] Commit with message works
- [ ] Push/pull works
- [ ] Multi-remote support

### Phase 4
- [ ] GitHub auth works
- [ ] Create PR works
- [ ] Issue creation works
- [ ] No duplicate issues
- [ ] SARIF upload works

---

## 🚀 Tối ưu CI/CD & Hiệu suất Model

### Python Long-lived Worker Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VS Code Extension                            │
│  ┌─────────────────┐          ┌────────────────────────────┐    │
│  │   Extension     │  JSON-   │     Python Worker          │    │
│  │   Core          │◄─RPC────►│  (Long-lived process)      │    │
│  │                 │  stdin/  │  ┌────────────────────┐    │    │
│  └─────────────────┘  stdout  │  │ ONNX Runtime       │    │    │
│                               │  │ (BiGRU Model)      │    │    │
│                               │  └────────────────────┘    │    │
│                               │  ┌────────────────────┐    │    │
│                               │  │ In-memory Cache    │    │    │
│                               │  │ (hash → result)    │    │    │
│                               │  └────────────────────┘    │    │
│                               └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Performance Optimizations

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| Cold start | 2-3s (load model) | 0ms (preloaded) | **100%** |
| PyTorch → ONNX | ~500ms/func | ~50ms/func | **10x** |
| Caching | None | Hash-based | **Skip 60-80%** |
| Batching | 1 at a time | Up to 32 | **5-8x throughput** |

### GitHub Actions Workflow Template (Production-Ready)

```yaml
name: Devign Security Scan

on:
  pull_request:
    paths: ['**.c', '**.cpp', '**.h', '**.hpp']
  push:
    branches: [main, develop]

# Minimum required permissions
permissions:
  contents: read
  security-events: write  # For SARIF upload
  pull-requests: read

jobs:
  scan:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for diff scan
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'
          cache: 'pip'  # Cache pip dependencies
      
      - name: Install Devign Scanner
        run: |
          pip install devign-scanner==2.0.0  # Pin version
          devign --version
      
      - name: Run Security Scan
        id: scan
        run: |
          devign scan \
            --changed-only \
            --base ${{ github.event.pull_request.base.sha || 'HEAD~1' }} \
            --format sarif \
            --output results.sarif \
            --threshold 0.65 \
            --batch-size 32
        continue-on-error: true  # Don't fail workflow on findings
      
      - name: Upload SARIF to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif
          category: devign-vulnerability-scan
      
      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: security-scan-results
          path: |
            results.sarif
            results.html
          retention-days: 30
      
      - name: Generate HTML Report
        if: always()
        run: devign convert sarif-to-html results.sarif results.html
      
      - name: Comment PR with Summary
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const sarif = JSON.parse(fs.readFileSync('results.sarif', 'utf8'));
            const results = sarif.runs[0]?.results || [];
            
            const critical = results.filter(r => r.level === 'error').length;
            const high = results.filter(r => r.level === 'warning').length;
            
            const body = `## 🛡️ Devign Security Scan Results
            
            | Severity | Count |
            |----------|-------|
            | 🔴 Critical | ${critical} |
            | 🟠 High | ${high} |
            | Total | ${results.length} |
            
            ${results.length > 0 ? '⚠️ Please review the Security tab for details.' : '✅ No vulnerabilities detected!'}
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });

  # Build and test extension
  build-extension:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Build Webview
        run: npm run build:webview
      
      - name: Compile Extension
        run: npm run compile
      
      - name: Lint
        run: npm run lint
      
      - name: Package VSIX
        run: npm run package
      
      - name: Upload VSIX
        uses: actions/upload-artifact@v4
        with:
          name: devign-extension-vsix
          path: '*.vsix'
```

### CLI Interface

```bash
devign scan [options] [paths...]
  --format <sarif|json|html>   Output format (default: sarif)
  --changed-only               Scan only changed files
  --base <commit>              Base commit for diff
  --threshold <0.0-1.0>        Vulnerability threshold
  --batch-size <n>             Batch size (default: 32)
```

---

## 🔄 Real-time Scan Strategy (Hybrid A+B)

```
User typing → debounce 500ms → LEVEL A: Scan current function (~50ms)
User saves  → LEVEL B: Scan all changed functions (~200-500ms)
File idle   → Background scan remaining (low priority)
```

### Cache Key Strategy

```typescript
function computeHash(code: string, modelVersion: string): string {
  const normalized = code.replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256')
    .update(`${modelVersion}:${normalized}`)
    .digest('hex').substring(0, 16);
}
```

---

## ✅ Definition of Done (Updated - per Slice)

### SLICE 1: End-to-end skeleton
- [ ] Protocol types with zod validation
- [ ] Python worker spawns and responds to health check
- [ ] Basic WebView renders
- [ ] Type C code → debounce → scan → show 1 result in WebView
- [ ] Unit tests for protocol + worker manager

### SLICE 2: Full WebView UI
- [ ] Dashboard component (stats, model version, last scan)
- [ ] Scan Results component (filter by severity, navigate to file)
- [ ] Security Gate component (status, progress, actions)
- [ ] Git Panel component (branch, staged, unstaged)
- [ ] Theme integration (dark/light follows VS Code)
- [ ] Accessibility: keyboard navigation works
- [ ] CSP strict: nonce-based, no unsafe-eval

### SLICE 3: Performance + Real-time
- [ ] ONNX model converted and benchmarked
- [ ] **Performance: p50 < 100ms, p95 < 250ms**
- [ ] Hybrid A+B scan (typing → current function, save → all changed)
- [ ] Hash-based caching (skip 60%+ scans)
- [ ] SARIF export with valid schema
- [ ] HTML report rendering in WebView
- [ ] Benchmark harness with histogram output

### SLICE 4: Git + GitHub
- [ ] Branch operations (list, create, checkout, delete)
- [ ] Stage/unstage files from UI
- [ ] Commit with message editor
- [ ] Push/Pull with progress
- [ ] GitHub auth via `vscode.authentication`
- [ ] Create PR with scan summary in body
- [ ] SARIF upload to GitHub Code Scanning

### SLICE 5: CI/CD + Polish
- [ ] CLI tool `devign` packaged (PyPI)
- [ ] GitHub Actions workflow (scan + build + SARIF upload)
- [ ] GitLab CI template
- [ ] Documentation (README, CONTRIBUTING, SECURITY)
- [ ] All tests passing (unit, integration, e2e)
- [ ] Security checklist completed

---

## 📖 Next Steps

1. **Bắt đầu SLICE 1**: Setup webview-ui/ + protocol types + Python worker skeleton
2. **Milestone demo**: Type → scan → show result (2 tuần đầu)
3. **Iterate**: Mỗi slice có demo riêng

---

*Last updated: 30/12/2024*
*Review by: Oracle AI Advisor*

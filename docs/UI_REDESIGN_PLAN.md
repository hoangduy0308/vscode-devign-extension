# Devign UI Redesign Plan

> **Mục tiêu**: Giao diện hiện đại, flat, load nhanh, trực quan, thân thiện developer

**Status**: Draft v2 - Updated after Oracle Review  
**Last Updated**: 2025-01-01

---

## 1. Tổng quan thay đổi

### Hiện trạng (Vấn đề)
```
Sidebar Devign:
├── Vulnerability Scanner (tree view)
├── Security Gate (tree view)        ← Trùng lặp
└── Devign Webview (webview)         ← Phức tạp, nhiều component
    ├── Dashboard
    ├── SecurityGate                 ← Trùng lặp
    ├── GitPanel
    └── ScanResults
```

**Vấn đề:**
- 3 panels riêng biệt → user phải scroll/click nhiều
- Trùng lặp chức năng Security Gate
- Webview load chậm do nhiều component
- Giao diện tree view cũ, không modern

### Đề xuất (Giải pháp)
```
Sidebar Devign:
└── Devign Scanner (1 webview duy nhất)
    └── Modern Flat UI - Single Page
```

**Lợi ích:**
- ✅ 1 view duy nhất - đơn giản
- ✅ Flat UI - không tree view
- ✅ Load nhanh - lazy loading
- ✅ Trực quan - card-based design

---

## 2. Thiết kế UI mới

### 2.1 Layout tổng quan

```
┌──────────────────────────────────────────────────────┐
│ HEADER (Fixed)                                       │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🛡️ Status    │ ▶ Scan │ ⚙️ Settings             │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ CONTENT (Scrollable)                                 │
│                                                      │
│ ┌─ Stats Cards ──────────────────────────────────┐   │
│ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │   │
│ │ │🔴 2    │ │🟠 5    │ │🟡 3    │ │📊 12   │    │   │
│ │ │Critical│ │High    │ │Medium  │ │Scans   │    │   │
│ │ └────────┘ └────────┘ └────────┘ └────────┘    │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
│ ┌─ Security Gate ────────────────────────────────┐   │
│ │ ⬤ PASSED   ████████████████████████░░ 85%     │   │
│ │ Ready to commit · No blocking issues           │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
│ ┌─ Findings ─────────────────────────────────────┐   │
│ │ Filter: [All ▼] [Critical ▼] Sort: [Severity ▼]│   │
│ │                                                │   │
│ │ ┌────────────────────────────────────────────┐ │   │
│ │ │ 🔴 CRITICAL                                │ │   │
│ │ │ Buffer Overflow                            │ │   │
│ │ │ main.c:42 · CWE-120                       │ │   │
│ │ │ [View Code] [Mark Fixed]                   │ │   │
│ │ └────────────────────────────────────────────┘ │   │
│ │ ┌────────────────────────────────────────────┐ │   │
│ │ │ 🟠 HIGH                                    │ │   │
│ │ │ Use After Free                             │ │   │
│ │ │ lib.c:128 · CWE-416                       │ │   │
│ │ └────────────────────────────────────────────┘ │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
│ ┌─ Git Quick Actions ────────────────────────────┐   │
│ │ 🔀 main  │ Staged: 3 │ Unstaged: 1            │   │
│ │ [Commit with Gate] [Push] [Pull]              │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.2 Responsive behavior

| Width | Layout |
|-------|--------|
| < 300px | Stats cards 2x2, compact mode |
| 300-500px | Stats cards 4x1, normal mode |
| > 500px | Full width với spacing tốt hơn |

---

## 3. Components chi tiết

### 3.1 Header Component

```tsx
interface HeaderProps {
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'SCANNING' | 'IDLE';
  scanScope: 'file' | 'workspace' | 'selection';
  currentFile?: string;
  onScan: (scope: 'file' | 'workspace' | 'selection') => void;
  onSettings: () => void;
  onCancel: () => void;
}
```

**Thiết kế:**
- Fixed position trên cùng
- Status badge với màu semantic (sử dụng **codicons**, không emoji):
  - PASSED: `$(pass)` green (#22c55e)
  - FAILED: `$(error)` red (#ef4444)
  - WARNING: `$(warning)` orange (#f97316)
  - SCANNING: `$(sync~spin)` blue với animation
  - IDLE: `$(circle-outline)` gray
- **Scan dropdown menu** (không chỉ 1 button):
  - "Scan Current File" → `devign.scanCurrentFile`
  - "Scan Workspace" → `devign.scanWorkspace`
  - "Scan Selection" → `devign.scanSelection`
- **Scope indicator**: Hiển thị "Scanning: main.c" hoặc "Scope: Workspace"
- Settings icon → mở VS Code native settings với query `@ext:devign`
- Cancel button khi đang scan

### 3.2 StatsCards Component

```tsx
interface StatsCardsProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalScans: number;
  lastScanTime: string | null;
}
```

**Thiết kế:**
- Grid layout 4 columns (responsive)
- Mỗi card:
  - Icon + số lớn (font-size: 24px)
  - Label nhỏ bên dưới
  - Hover effect: slight elevation
  - Click: filter findings theo severity
- Màu sắc theo severity tokens đã có

### 3.3 SecurityGateCompact Component

```tsx
interface SecurityGateCompactProps {
  status: GateStatus;
  progress: number;
  message: string;
  blockedBy?: string[]; // ["2 Critical", "1 High"]
}
```

**Thiết kế:**
- Single row layout
- Status dot + label
- Progress bar inline
- Message text mô tả ngắn gọn
- Không cần buttons Allow/Block (logic tự động)

### 3.4 FindingsList Component

```tsx
interface FindingsListProps {
  findings: Finding[];
  filter: SeverityFilter;
  groupBy: 'none' | 'file' | 'severity' | 'cwe';
  sortBy: 'severity' | 'file' | 'line';
  searchQuery: string;
  onFilterChange: (filter: SeverityFilter) => void;
  onGroupByChange: (groupBy: 'none' | 'file' | 'severity' | 'cwe') => void;
  onSearchChange: (query: string) => void;
  onFindingClick: (finding: Finding) => void;
}
```

**Thiết kế:**
- **Search bar** trên cùng: tìm theo file, function, CWE
- Filter bar với dropdowns:
  - Severity: All / Critical / High / Medium / Low
  - Group by: None / File / Severity / CWE
  - Sort: Severity / File / Line
- Virtualized list cho performance (đã có VirtualizedVulnList)
- Card-based items (không phải tree):
  - Severity badge với **codicon** (trái)
  - Title + description
  - File:line location (click để jump)
  - Quick actions (View Code, Copy)
- **Grouped sections** khi group by enabled:
  ```
  📁 main.c (3 issues)
  ├── 🔴 Buffer Overflow - line 42
  └── 🟠 Use After Free - line 89
  
  📁 utils.c (1 issue)
  └── 🟡 Integer Overflow - line 15
  ```
- Empty state khi không có findings
- Skeleton loading khi đang scan
- **Performance**: Filter/sort chạy client-side với debounce 150ms

### 3.5 GitQuickActions Component

```tsx
interface GitQuickActionsProps {
  branch: string;
  stagedCount: number;
  unstagedCount: number;
  isCommitting: boolean;
  isPushing: boolean;
  isPulling: boolean;
  onCommit: () => void;    // → devign.commitWithGate
  onPush: () => void;      // → devign.pushWithGate
  onPull: () => void;      // → devign.pullWithScan
}
```

**Thiết kế:**
- Compact single row, collapsible
- Branch name với codicon `$(git-branch)`
- File counts: "staged: 3 | unstaged: 1"
- 3 action buttons với codicons:
  - `$(git-commit)` Commit → `devign.commitWithGate`
  - `$(cloud-upload)` Push → `devign.pushWithGate`
  - `$(cloud-download)` Pull → `devign.pullWithScan`
- Loading states cho mỗi action (spinner khi processing)
- **Inline feedback** sau action: "✓ Committed" / "✗ Push failed"
- Tooltip: "Commit with security gate check"

---

## 4. package.json Changes

### 4.1 Xóa views thừa

```diff
"views": {
  "devign": [
-   {
-     "id": "devign.sidebar",
-     "name": "Vulnerability Scanner",
-     "icon": "resources/devign.svg"
-   },
-   {
-     "id": "devign.gatePanel",
-     "name": "Security Gate",
-     "icon": "$(shield)"
-   },
    {
      "type": "webview",
      "id": "devign.webview",
-     "name": "Devign Webview",
+     "name": "Devign Scanner",
      "icon": "resources/devign.svg"
    }
  ]
}
```

### 4.2 Cập nhật viewsWelcome

```diff
"viewsWelcome": [
- {
-   "view": "devign.sidebar",
-   "contents": "..."
- }
]
```

> **Note**: Welcome message sẽ chuyển hoàn toàn vào EmptyState component trong webview, không còn dùng `viewsWelcome` của VS Code.

### 4.3 Thêm webview config

```json
{
  "type": "webview",
  "id": "devign.webview",
  "name": "Devign Scanner",
  "icon": "resources/devign.svg",
  "retainContextWhenHidden": true
}
```

> **Note**: `retainContextWhenHidden: true` giữ state webview khi user chuyển tab, tránh re-mount React.

### 4.4 Command Mapping

| UI Action | Command | Mô tả |
|-----------|---------|-------|
| Scan (File) | `devign.scanCurrentFile` | Scan file đang mở |
| Scan (Workspace) | `devign.scanWorkspace` | Scan toàn bộ workspace |
| Scan (Selection) | `devign.scanSelection` | Scan code đang chọn |
| Settings | `workbench.action.openSettings` | Mở settings với query `@ext:devign` |
| Commit | `devign.commitWithGate` | Commit với gate check |
| Push | `devign.pushWithGate` | Push với gate check |
| Pull | `devign.pullWithScan` | Pull và auto scan |
| View Finding | `devign.revealResult` | Jump đến code location |

---

## 5. File Structure mới

```
webview-ui/src/
├── App.tsx                    # Main app - simplified
├── components/
│   ├── Header.tsx             # NEW - fixed header
│   ├── StatsCards.tsx         # NEW - replace Dashboard
│   ├── SecurityGateCompact.tsx # NEW - compact gate
│   ├── FindingsList.tsx       # NEW - card-based list
│   ├── FindingCard.tsx        # NEW - single finding card
│   ├── GitQuickActions.tsx    # NEW - compact git
│   ├── EmptyState.tsx         # KEEP - improve
│   ├── ScanProgressOverlay.tsx # KEEP
│   └── _deprecated/           # OLD components to remove
│       ├── Dashboard.tsx
│       ├── SecurityGate.tsx
│       ├── GitPanel.tsx
│       └── ScanResults.tsx
├── hooks/
│   ├── useFindings.ts         # NEW - findings state
│   ├── useGitStatus.ts        # NEW - git state
│   └── useScanStatus.ts       # NEW - scan state
└── styles/
    └── tokens.css             # KEEP - enhance
```

---

## 6. Implementation Phases

### Phase 1: Cleanup & Setup (2-3 giờ)
- [ ] Backup components cũ vào `_deprecated/`
- [ ] Cập nhật package.json (xóa views thừa, thêm retainContextWhenHidden)
- [ ] Tạo file structure mới
- [ ] Setup custom hooks
- [ ] Cập nhật DevignWebviewProvider để xử lý retainContextWhenHidden

### Phase 2: Core Components (4-5 giờ)
- [ ] Header component với scan dropdown menu
- [ ] StatsCards component
- [ ] SecurityGateCompact component
- [ ] FindingCard component
- [ ] FindingsList component với search + grouping

### Phase 3: Integration (3-4 giờ)
- [ ] Refactor App.tsx với layout mới
- [ ] Connect với extension messages
- [ ] GitQuickActions component
- [ ] Command mapping và message handling
- [ ] Testing & debugging

### Phase 4: Polish (2-3 giờ)
- [ ] Animations & transitions
- [ ] Loading states & skeletons
- [ ] Empty states improvements
- [ ] Responsive testing (min-width 200px)
- [ ] Performance optimization
- [ ] Accessibility testing

**Tổng thời gian ước tính: 11-15 giờ (1.5-2 ngày)**

---

## 7. Performance Optimizations

### 7.1 Lazy Loading
```tsx
// Chỉ load findings khi cần
const FindingsList = React.lazy(() => import('./components/FindingsList'));

// Skeleton while loading
<Suspense fallback={<FindingsSkeleton />}>
  <FindingsList findings={findings} />
</Suspense>
```

### 7.2 Virtualization
- Sử dụng `react-window` hoặc `@tanstack/react-virtual`
- Chỉ render findings visible trong viewport
- Đã có `VirtualizedVulnList.tsx` - tái sử dụng

### 7.3 Message Debouncing & Batching
```tsx
// Debounce git status updates
useEffect(() => {
  const debounced = debounce((status) => {
    setGitStatus(status);
  }, 300);
  // ...
}, []);
```

**Extension side**: Coalesce scan updates to ~5-10 messages/second max, không spam webview.

### 7.4 Bundle Size
- Tree-shake unused code
- Lazy load icons (codicons loaded từ VS Code, không bundle)
- Minimize CSS với Tailwind purge
- Production build: no sourcemaps, no React dev tools

### 7.5 Webview State Management
- `retainContextWhenHidden: true` → state giữ nguyên khi switch tabs
- Persist critical state (scroll position, filter settings) với `vscode.setState()`
- Recover state khi webview được tạo lại với `vscode.getState()`

### 7.6 Filter/Sort Performance
- Client-side filtering với debounce 150ms
- Memoize filtered results với `useMemo`
- Avoid re-computing khi data không đổi

---

## 8. Design Tokens Update

### 8.1 Thêm tokens mới

```css
/* tokens.css additions */
body {
  /* Card styles */
  --card-bg: var(--vscode-editor-background);
  --card-bg-hover: var(--vscode-list-hoverBackground);
  --card-border: var(--vscode-panel-border);
  --card-radius: var(--radius-lg);
  --card-shadow: var(--shadow-sm);
  
  /* Header */
  --header-height: 48px;
  --header-bg: var(--vscode-sideBar-background);
  
  /* Status colors */
  --status-passed: #22c55e;
  --status-failed: #ef4444;
  --status-warning: #f97316;
  --status-scanning: #3b82f6;
  --status-idle: #6b7280;
}
```

---

## 9. Accessibility Checklist

- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader labels (aria-label, aria-describedby)
- [ ] Focus indicators visible
- [ ] Color không phải indicator duy nhất (thêm codicon + text)
- [ ] Reduced motion support (`prefers-reduced-motion`)
- [ ] Contrast ratio >= 4.5:1
- [ ] `aria-live="polite"` cho status changes (gate status, scan progress)
- [ ] Semantic HTML (headings, lists, buttons)

---

## 10. Icon System

### 10.1 Sử dụng Codicons (không emoji)

| Ý nghĩa | Codicon | Usage |
|---------|---------|-------|
| Critical | `$(flame)` | Severity badge |
| High | `$(warning)` | Severity badge |
| Medium | `$(info)` | Severity badge |
| Low | `$(circle-outline)` | Severity badge |
| Passed | `$(pass)` | Gate status |
| Failed | `$(error)` | Gate status |
| Scanning | `$(sync~spin)` | Loading state |
| File | `$(file-code)` | File reference |
| Git branch | `$(git-branch)` | Branch indicator |
| Commit | `$(git-commit)` | Git action |
| Push | `$(cloud-upload)` | Git action |
| Pull | `$(cloud-download)` | Git action |
| Settings | `$(gear)` | Settings button |
| Search | `$(search)` | Search input |
| Filter | `$(filter)` | Filter dropdown |

### 10.2 Implementation

```tsx
// Codicon component wrapper
const Icon: React.FC<{ name: string; className?: string }> = ({ name, className }) => (
  <i className={`codicon codicon-${name} ${className || ''}`} aria-hidden="true" />
);

// Usage
<Icon name="flame" className="text-red-500" />
<Icon name="warning" className="text-orange-500" />
```

---

## 11. Success Metrics

| Metric | Hiện tại | Mục tiêu |
|--------|----------|----------|
| Initial load time | ~500ms | < 200ms |
| Time to first scan | 3 clicks | 1 click |
| Panels to manage | 3 | 1 |
| User cognitive load | High | Low |

---

## Appendix A: Wireframes

### A.1 Default State (No Scan)
```
┌────────────────────────────────────┐
│ ○ IDLE  [▼ Scan] [⚙]              │
├────────────────────────────────────┤
│                                    │
│      ┌────────────────────┐        │
│      │   $(search)        │        │
│      │                    │        │
│      │   No scan results  │        │
│      │                    │        │
│      │   Open a C/C++ file│        │
│      │   and run a scan   │        │
│      │                    │        │
│      │   [▶ Scan Now]     │        │
│      └────────────────────┘        │
│                                    │
└────────────────────────────────────┘
```

### A.2 Scanning State
```
┌────────────────────────────────────┐
│ $(sync~spin) SCANNING  [Cancel]   │
│ Scope: main.c                      │
├────────────────────────────────────┤
│                                    │
│  Analyzing main.c...               │
│  ████████████░░░░░░░░░░ 60%        │
│                                    │
│  ┌──────────────────────────┐      │
│  │ $(file-code) Parsed: 45  │      │
│  │ $(check) Checked: 27/45  │      │
│  │ $(warning) Found: 2      │      │
│  └──────────────────────────┘      │
│                                    │
└────────────────────────────────────┘
```

### A.3 Results State (With Findings)
```
┌────────────────────────────────────┐
│ $(error) FAILED  [▼ Scan] [⚙]     │
│ Scope: Workspace                   │
├────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐   │
│ │$(flame)│ │$(warn) │ │$(info) │   │
│ │   2    │ │   5    │ │   3    │   │
│ │Critical│ │ High   │ │Medium  │   │
│ └────────┘ └────────┘ └────────┘   │
├────────────────────────────────────┤
│ $(error) Gate: BLOCKED             │
│ 2 critical issues must be fixed    │
├────────────────────────────────────┤
│ $(search) Search...                │
│ [All ▼] [Group: File ▼] [Sort ▼]  │
│                                    │
│ ┌──────────────────────────────┐   │
│ │$(file-code) main.c (2)       │   │
│ ├──────────────────────────────┤   │
│ │ $(flame) Buffer Overflow     │   │
│ │   Line 42 · CWE-120         │   │
│ │   [View] [Copy]              │   │
│ ├──────────────────────────────┤   │
│ │ $(flame) Integer Overflow    │   │
│ │   Line 89 · CWE-190         │   │
│ └──────────────────────────────┘   │
│ ┌──────────────────────────────┐   │
│ │$(file-code) utils.c (1)      │   │
│ ├──────────────────────────────┤   │
│ │ $(warning) Use After Free    │   │
│ │   Line 128 · CWE-416        │   │
│ └──────────────────────────────┘   │
├────────────────────────────────────┤
│ $(git-branch) main | staged: 3    │
│ [$(git-commit) Commit] [$(cloud-upload) Push] │
└────────────────────────────────────┘
```

### A.4 Success State (No Issues)
```
┌────────────────────────────────────┐
│ $(pass) PASSED  [▼ Scan] [⚙]      │
│ Scope: main.c                      │
├────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐   │
│ │$(flame)│ │$(warn) │ │$(info) │   │
│ │   0    │ │   0    │ │   0    │   │
│ │Critical│ │ High   │ │Medium  │   │
│ └────────┘ └────────┘ └────────┘   │
├────────────────────────────────────┤
│ $(pass) Gate: PASSED               │
│ Ready to commit                    │
├────────────────────────────────────┤
│                                    │
│      ┌────────────────────┐        │
│      │   $(pass)          │        │
│      │                    │        │
│      │   All clear!       │        │
│      │                    │        │
│      │   No vulnerabilities       │
│      │   detected         │        │
│      └────────────────────┘        │
│                                    │
├────────────────────────────────────┤
│ $(git-branch) main | staged: 3    │
│ [$(git-commit) Commit] [$(cloud-upload) Push] │
└────────────────────────────────────┘
```

---

## Appendix B: Report View Integration

Hiện tại có `ReportPanel` component cho detailed report. Trong UI mới:

### Option 1: Modal/Slide Panel (Recommended)
- Findings list có nút "View Full Report"
- Mở slide panel từ phải sang trái
- Chứa: charts, detailed analysis, export options

### Option 2: Separate Tab
- Command `devign.showReport` mở editor tab mới
- Full-width report với charts và tables

### Implementation
```tsx
// Trong App.tsx
const [showReport, setShowReport] = useState(false);

{showReport && (
  <SlidePanel onClose={() => setShowReport(false)}>
    <ReportPanel data={reportData} />
  </SlidePanel>
)}
```

---

## Appendix C: Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| xs | < 200px | Minimal mode - chỉ status + scan |
| sm | 200-300px | Stats cards 2x2, compact text |
| md | 300-400px | Stats cards 3x1, normal text |
| lg | > 400px | Full layout, all features |

**Min-width support**: 200px (sidebar có thể co nhỏ)

---

## Next Steps

1. ✅ Review plan với Oracle - DONE
2. ⏳ Approve design direction
3. ⏳ Bắt đầu Phase 1: Cleanup & Setup
4. ⏳ Iterative development với feedback

---

*Created: 2025-01-01*
*Author: Amp AI Assistant*
*Status: Draft v2 - Ready for Implementation*

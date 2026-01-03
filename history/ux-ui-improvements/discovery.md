# Discovery Report: UX/UI Improvements

**Feature**: Cải thiện UX/UI cho Devign Vulnerability Scanner Extension
**Date**: 2026-01-03
**Status**: Complete

---

## 1. Architecture Snapshot

### Component Structure

**Root**: `App.tsx` - Dashboard với 2 ViewModes: `dashboard` | `report`

| Component | Purpose | Lazy |
|-----------|---------|------|
| `Header` | Scan controls, status display | No |
| `StatsCards` | Severity summary (critical/high/medium/low) | No |
| `SecurityGateCompact` | Gate status, progress bar | No |
| `FindingsList` | Vulnerability list với filter/group/sort | Yes |
| `GitQuickActions` | Git commit/push/pull buttons | Yes |
| `ReportPanel` | Detailed report view | No |
| `ScanProgressOverlay` | Scan progress modal | No |
| `EmptyState` | Empty state placeholder | No |
| `ErrorState` | Error display | No |
| `VirtualizedVulnList` | Performance-optimized vuln list | No |

### UI Primitives (shadcn/ui)

18 components trong `components/ui/`:
- `alert`, `badge`, `button`, `card`, `collapsible`
- `dropdown-menu`, `empty`, `Icon`, `input`, `progress`
- `scroll-area`, `select`, `separator`, `skeleton`
- `spinner`, `tabs`, `tooltip`

### Shared Utilities

| Location | Purpose |
|----------|---------|
| `lib/utils.ts` | `cn()` - Tailwind class merging |
| `utilities/vscode.ts` | VS Code API wrapper |
| `utilities/messages.ts` | Typed messaging API |
| `utils/keyboard.ts` | Keyboard utilities |

---

## 2. Design System

### Token Categories (tokens.css)

| Category | Description |
|----------|-------------|
| Spacing | 4px grid scale (`--space-0` → `--space-16`) |
| Typography | Font sizes xs → 3xl, weights, line-heights |
| Colors | VS Code integration + custom severity colors |
| Severity | Critical/High/Medium/Low với bg, border, text variants |
| Motion | Duration, easing, transitions |
| Components | Cards, buttons, inputs, dropdowns, progress, etc. |

### Styling Approach (Hybrid)

1. **Inline styles + tokens**: `style={{ padding: 'var(--space-4)' }}`
2. **Tailwind + token refs**: `className="text-[var(--color-text-secondary)]"`
3. **CSS utility classes**: `.vuln-card`, `.severity-badge`

### Responsive Breakpoints

| Breakpoint | Width | Grid Columns |
|------------|-------|--------------|
| xs | <200px | 1 column |
| sm | 200-299px | 2 columns |
| md | 300-399px | 2 columns |
| lg | ≥400px | 4 columns |

Container Queries supported cho modern browsers.

---

## 3. Tech Stack & Constraints

### Core Dependencies

| Package | Version |
|---------|---------|
| react / react-dom | ^19.2.0 |
| vite | ^7.2.4 |
| tailwindcss | ^4.1.18 |
| tailwindcss-animate | ^1.0.7 |
| lucide-react | ^0.562.0 |
| clsx, tailwind-merge, cva | latest |

### Radix UI Primitives (shadcn foundation)

- `@radix-ui/react-collapsible`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-progress`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-select`
- `@radix-ui/react-tabs`
- `@radix-ui/react-tooltip`

### shadcn Configuration

- Style: `new-york`
- Base color: `neutral`
- CSS Variables: enabled
- Icon library: lucide

### ⚠️ Missing Dependencies

- **Toast/Notification**: KHÔNG có toast library
  - Options: `sonner` hoặc `react-hot-toast`

---

## 4. Existing Patterns

### State Management
- State lifting: App.tsx manages all state, passes via props
- Memoization: `useMemo`, `useCallback` cho derived data
- VS Code state persistence via `utilities/messages.ts`

### UI Patterns
- Lazy loading: `React.lazy()` cho heavy components
- VS Code theming: CSS variables (`--vscode-*`)
- Typed messaging: Extension ↔ Webview via `MessageType` enum

### Accessibility Patterns
- ARIA roles và labels trên major components
- Keyboard navigation với focus management
- `prefers-reduced-motion` support
- `.sr-only`, focus ring utilities

---

## 5. Problems Identified (from Oracle Analysis)

| # | Problem | Severity | Affected Files |
|---|---------|----------|----------------|
| 1 | Scan UX - dropdown thay vì split-button | Medium | Header.tsx |
| 2 | Tabs ARIA không đúng chuẩn | Medium | App.tsx |
| 3 | Thiếu feedback cho actions (Copy, Git) | High | FindingsList.tsx, App.tsx |
| 4 | StatsCards không hiển thị active filter | Low | StatsCards.tsx, App.tsx |
| 5 | Connecting overlay không có retry | Medium | App.tsx |
| 6 | Confusion Scan Status vs Gate Status | Low | Header.tsx, SecurityGateCompact.tsx |
| 7 | FindingsList cần compact mode | Low | FindingsList.tsx |
| 8 | Quá nhiều glassmorphism | Low | index.css |

---

## 6. Recommendations for Approach Phase

### Quick Wins (LOW risk)
- Fix ARIA tabs
- Add active filter state to StatsCards
- Reduce glassmorphism

### Medium Effort (MEDIUM risk)
- Split-button for Scan
- Retry button for connecting state
- Clarify Status vs Gate labels

### Requires New Dependency (HIGH risk)
- Toast notifications (need to add sonner/react-hot-toast)
- Compact mode for FindingsList (new UI pattern)

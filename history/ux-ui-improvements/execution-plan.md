# Execution Plan: UX/UI Improvements

**Feature**: Cải thiện UX/UI cho Devign Vulnerability Scanner Extension
**Date**: 2026-01-03
**Status**: Ready for Execution

---

## Epic Overview

**Epic ID**: vscode-devign-extension-127
**Title**: Epic: UX/UI Improvements
**Total Issues**: 8
**Ready Issues**: 2
**Blocked Issues**: 6

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │ #128 ARIA Tabs  │ ───────────────────────────────────┐
                    │ [P2, S, Ready]  │                                    │
                    └─────────────────┘                                    │
                                                                           │
┌─────────────────────┐                                                    │
│ #129 Glassmorphism  │ ─────────┬────────────┬──────────────┐             │
│ [P2, S, Ready]      │          │            │              │             │
└─────────────────────┘          │            │              │             │
                                 ▼            ▼              ▼             │
                    ┌─────────────────┐  ┌─────────────┐  ┌──────────────┐ │
                    │ #130 Toast      │  │ #131 Filter │  │ #133 Status  │ │
                    │ [P1, M]         │  │ [P2, S]     │  │ [P2, S]      │ │
                    └────────┬────────┘  └──────┬──────┘  └──────┬───────┘ │
                             │                  │                │         │
                             ▼                  │                ▼         │
                    ┌─────────────────┐         │      ┌──────────────────┐│
                    │ #132 Retry      │         │      │ #134 Split-btn   ││
                    │ [P1, M]         │         │      │ [P2, M]          ││
                    └────────┬────────┘         │      └────────┬─────────┘│
                             │                  │               │          │
                             │                  ▼               │          │
                             │         ┌──────────────────┐     │          │
                             │         │ #135 Compact     │     │          │
                             │         │ [P3, L]          │     │          │
                             │         └────────┬─────────┘     │          │
                             │                  │               │          │
                             └──────────────────┴───────────────┴──────────┘
                                                │
                                                ▼
                                    ┌─────────────────────┐
                                    │ #127 Epic Complete  │
                                    └─────────────────────┘
```

---

## Execution Tracks

### Track A: Foundation (Parallel)
| Agent | Issue | Priority | Effort | Status |
|-------|-------|----------|--------|--------|
| **BlueLake** | #128 Fix Tabs ARIA | P2 | S | Ready |
| **GreenCastle** | #129 Reduce Glassmorphism | P2 | S | Ready |

### Track B: Infrastructure (Sequential)
| Agent | Issue | Priority | Effort | Blocked By |
|-------|-------|----------|--------|------------|
| **RedStone** | #130 Toast System | P1 | M | #129 |
| **RedStone** | #132 Retry Overlay | P1 | M | #130 |

### Track C: Core UX (Parallel after #129)
| Agent | Issue | Priority | Effort | Blocked By |
|-------|-------|----------|--------|------------|
| **PurpleBear** | #131 Filter State | P2 | S | #129 |
| **PurpleBear** | #133 Status vs Gate | P2 | S | #129 |
| **PurpleBear** | #134 Split-Button | P2 | M | #133 |

### Track D: Polish (Final)
| Agent | Issue | Priority | Effort | Blocked By |
|-------|-------|----------|--------|------------|
| **SilverFox** | #135 Compact Mode | P3 | L | #129, #131 |

---

## File Scope per Track

### Track A (Foundation)
- `BlueLake`: webview-ui/src/App.tsx (tabs section only)
- `GreenCastle`: webview-ui/src/index.css, tokens.css

### Track B (Infrastructure)
- `RedStone`: 
  - webview-ui/src/lib/toast.ts (new)
  - webview-ui/src/App.tsx (Toaster, overlay)
  - webview-ui/package.json

### Track C (Core UX)
- `PurpleBear`:
  - webview-ui/src/components/StatsCards.tsx
  - webview-ui/src/components/Header.tsx
  - webview-ui/src/components/SecurityGateCompact.tsx
  - webview-ui/src/components/ScanSplitButton.tsx (new)

### Track D (Polish)
- `SilverFox`:
  - webview-ui/src/components/FindingsList.tsx
  - webview-ui/src/components/VirtualizedVulnList.tsx

---

## Sprint Plan

### Sprint 1 (Foundation + Infrastructure Start)
1. ✅ Track A: #128 + #129 (parallel, 2 agents)
2. ⏳ Track B: #130 starts after #129

**Deliverables**: ARIA fixed, visual cleanup, toast system ready

### Sprint 2 (Core UX)
1. Track B: #132 (retry overlay)
2. Track C: #131, #133 (parallel)
3. Track C: #134 (after #133)

**Deliverables**: All UX improvements except compact mode

### Sprint 3 (Polish)
1. Track D: #135 (compact mode)
2. Epic close

**Deliverables**: Complete UX/UI overhaul

---

## Quick Start Commands

```bash
# See ready work
bd ready

# Start working on an issue
bd update vscode-devign-extension-128 --status in_progress
bd update vscode-devign-extension-129 --status in_progress

# Check progress
bv --robot-triage

# After completing
bd close vscode-devign-extension-128 --reason "ARIA compliance fixed"
bd sync
```

---

## Success Metrics

- [ ] All 8 issues closed
- [ ] axe-core: 0 ARIA violations
- [ ] Toast feedback on all actions
- [ ] Scan: 1-click primary action
- [ ] Filter state visible
- [ ] Compact mode: +40% density
- [ ] VS Code theme integration maintained

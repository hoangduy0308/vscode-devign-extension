# Approach Document: UX/UI Improvements

**Feature**: Cải thiện UX/UI cho Devign Vulnerability Scanner Extension
**Date**: 2026-01-03
**Status**: Approved

---

## Executive Summary

Cải thiện 8 vấn đề UX/UI được phát hiện từ Oracle analysis. Thực hiện theo thứ tự: quick wins + infrastructure → critical UX → refinement.

---

## Gap Analysis & Approach

### 1. Tabs ARIA đúng chuẩn

| Aspect | Current | Desired |
|--------|---------|---------|
| ARIA | Missing proper roles | `role="tablist"`, `role="tab"`, `role="tabpanel"` |
| Keyboard | May not follow spec | Left/Right, Home/End per Radix |
| Labels | Generic | Clear descriptions |

**Approach**: Bám sát Radix + shadcn default, ensure không override props mặc định.

**Risk**: LOW | **Effort**: S | **Dependencies**: None

---

### 2. Giảm glassmorphism effects

| Aspect | Current | Desired |
|--------|---------|---------|
| Blur | Heavy backdrop-blur | Minimal or none |
| Background | Translucent | Solid with VS Code tokens |
| Contrast | May be low | High contrast |

**Approach**: Tokenize glassmorphism với `--surface-glass-opacity`, support `prefers-reduced-transparency`.

**Risk**: LOW | **Effort**: S | **Dependencies**: None

---

### 3. Toast system & action feedback

| Aspect | Current | Desired |
|--------|---------|---------|
| Copy feedback | None (console log) | Toast "Copied to clipboard" |
| Git feedback | None (console log) | Toast success/error |
| Library | None | sonner |

**Approach**: Install `sonner`, create wrapper `lib/toast.ts`, wire vào Copy/Git handlers.

**Risk**: HIGH | **Effort**: M | **Dependencies**: #8 (visual baseline)

---

### 4. StatsCards active filter state

| Aspect | Current | Desired |
|--------|---------|---------|
| Visual | No active state | Highlight when filtered |
| ARIA | Missing | `aria-pressed` on active |
| Interaction | Click filters | Toggle behavior |

**Approach**: Biến StatsCards thành toggle group với active state styling.

**Risk**: LOW | **Effort**: S | **Dependencies**: #8

---

### 5. Connecting overlay + Retry

| Aspect | Current | Desired |
|--------|---------|---------|
| State | Only "connecting" | connecting → failed → retrying |
| Actions | None | Retry button |
| Recovery | Manual reload | Auto/manual retry |

**Approach**: Add retry logic, use toast for feedback, timeout suggestion.

**Risk**: MEDIUM | **Effort**: M | **Dependencies**: #3 (toast)

---

### 6. Clarify Scan Status vs Gate

| Aspect | Current | Desired |
|--------|---------|---------|
| Terminology | Same words | Distinct: "Scan job" vs "Policy Gate" |
| Visual | Similar colors | Different: neutral vs severity |
| Placement | Unclear grouping | Clear visual separation |

**Approach**: Reword labels, add tooltips, reorganize layout.

**Risk**: MEDIUM | **Effort**: S | **Dependencies**: #8

---

### 7. Scan split-button UX

| Aspect | Current | Desired |
|--------|---------|---------|
| Interaction | Dropdown (2-3 clicks) | Split-button (1 click default) |
| Primary action | Hidden in menu | Visible "Scan Now" |
| Secondary | In dropdown | Dropdown via caret |

**Approach**: Build `ScanSplitButton` với Button + DropdownMenu.

**Risk**: MEDIUM | **Effort**: M | **Dependencies**: #6 (terminology)

---

### 8. FindingsList compact mode

| Aspect | Current | Desired |
|--------|---------|---------|
| Density | Spacious | Toggle compact/normal |
| Padding | Large | Reduced in compact |
| Metadata | All shown | Hide non-critical in compact |

**Approach**: Add compact mode toggle, density tokens, conditional styling.

**Risk**: HIGH | **Effort**: L | **Dependencies**: #4, #8

---

## Recommended Implementation Order

```
Phase 1: Foundation (Quick Wins)
├── #2 Tabs ARIA [LOW, S]
└── #8 Glassmorphism [LOW, S]

Phase 2: Infrastructure
└── #3 Toast System [HIGH, M]

Phase 3: Core UX
├── #4 StatsCards Filter [LOW, S]
├── #5 Retry Overlay [MEDIUM, M]
└── #6 Status vs Gate [MEDIUM, S]

Phase 4: Polish
├── #1 Split-button [MEDIUM, M]
└── #7 Compact Mode [HIGH, L]
```

---

## Dependency Graph

```
#2 ──────────────────────────────┐
                                 │
#8 ──────────────────────────────┼──> #3 ──> #5
                                 │      │
                                 │      └──> Git feedback
                                 │
#4 ◄─────────────────────────────┘
                                 
#6 ──────────────────────────────────> #1
                                 
#8 + #4 ─────────────────────────────> #7
```

---

## Effort Summary

| Size | Tasks | Total |
|------|-------|-------|
| S | #2, #4, #6, #8 | 4 tasks |
| M | #1, #3, #5 | 3 tasks |
| L | #7 | 1 task |

**Estimated Total**: ~2-3 sprints depending on team size

---

## Risk Mitigation

| Risk | Task | Mitigation |
|------|------|------------|
| Toast spam | #3 | Rate limit, queue, auto-dismiss |
| Theme conflict | #3 | Map to VS Code tokens |
| Virtualization break | #7 | Incremental testing |
| State desync | #5 | Clear state machine |

---

## Success Criteria

- [ ] All ARIA issues resolved (axe-core clean)
- [ ] Toast feedback on all user actions
- [ ] Split-button reduces scan to 1-click
- [ ] Filter state visible in StatsCards
- [ ] Retry works for connection failures
- [ ] Status vs Gate clearly distinguished
- [ ] Compact mode increases density 40%+
- [ ] Glassmorphism reduced, contrast improved

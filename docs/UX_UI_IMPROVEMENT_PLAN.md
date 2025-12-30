# UX/UI Improvement Plan - Devign Vulnerability Scanner

> **Document Version:** 3.0  
> **Created:** 2024-12-30  
> **Last Updated:** 2024-12-30  
> **Status:** Final Draft - Ready for Implementation

---

## 📋 Executive Summary

Bản đánh giá UX/UI của extension Devign Vulnerability Scanner, được review bởi Oracle và áp dụng Frontend Design principles, đã xác định các vấn đề và giải pháp toàn diện.

### Key Findings

| Category | Issues | Impact | Priority |
|----------|--------|--------|----------|
| **Design System** | No tokens, inconsistent patterns | Critical | P0 |
| **Theme Compatibility** | CSS vars on `:root` instead of `body` | Critical | P0 |
| **Error Handling** | Missing error/offline states | High | P0 |
| **Accessibility** | Keyboard gaps, missing ARIA | High | P0 |
| **State Persistence** | No webview state retention | High | P1 |
| **Performance** | No virtualization for large lists | Medium | P1 |
| **Motion & Feedback** | No loading states, abrupt transitions | Medium | P2 |

---

## 🎨 DESIGN SYSTEM SPECIFICATION

> **⚠️ CRITICAL: Tất cả tasks PHẢI tuân theo Design System này để đảm bảo consistency.**

### Design Direction: "Security Command Center"

Aesthetic phù hợp cho security tool:

| Aspect | Direction | Rationale |
|--------|-----------|-----------|
| **Tone** | Professional, precise, trustworthy | Security tools need credibility |
| **Visual Language** | Data-dense, scannable | Quick triage of vulnerabilities |
| **Color Strategy** | Monochrome base + semantic severity | Color = meaning only |
| **Hierarchy** | Left border accent + icon + label | Not full background fills |
| **Motion** | Subtle, functional | No flashy distractions |
| **Density** | Compact but accessible | Respect VS Code patterns |

### Design Principles (MANDATORY for all tasks)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. BLEND WITH VS CODE                                          │
│     - Use VS Code theme variables exclusively                   │
│     - Match native VS Code component patterns                   │
│     - Never fight the host environment                          │
├─────────────────────────────────────────────────────────────────┤
│  2. SEVERITY = VISUAL HIERARCHY                                 │
│     - Critical: Red left border + error icon                    │
│     - High: Orange left border + warning icon                   │
│     - Medium: Blue left border + info icon                      │
│     - Low: Gray left border + hint icon                         │
├─────────────────────────────────────────────────────────────────┤
│  3. PURPOSEFUL COLOR                                            │
│     - Color ONLY for semantic meaning                           │
│     - Never decorative colors                                   │
│     - High contrast, accessible                                 │
├─────────────────────────────────────────────────────────────────┤
│  4. INFORMATION DENSITY                                         │
│     - Show max info in min space                                │
│     - Progressive disclosure for details                        │
│     - Scannable at a glance                                     │
├─────────────────────────────────────────────────────────────────┤
│  5. MOTION WITH PURPOSE                                         │
│     - Loading = progress feedback                               │
│     - Transitions = orientation                                 │
│     - Never decorative animation                                │
│     - Always respect prefers-reduced-motion                     │
└─────────────────────────────────────────────────────────────────┘
```

### Anti-Patterns (FORBIDDEN)

```
❌ Hardcoded Tailwind colors (bg-red-500, text-blue-600)
❌ Full background fills for severity (use left border instead)
❌ Shadows in VS Code context (use borders)
❌ Emoji icons (use codicons)
❌ Inline styles with var() - use utility classes
❌ :root for CSS variables (use body)
❌ Generic "AI-generated" card layouts
❌ Decorative animations without purpose
```

---

## 🎯 MASTER DESIGN TOKENS

> **File: `webview-ui/src/styles/tokens.css`**
> 
> **⚠️ ALL components MUST use these tokens. No exceptions.**

```css
/* ═══════════════════════════════════════════════════════════════════
   DEVIGN DESIGN TOKENS v1.0
   
   IMPORTANT: Define on `body`, NOT `:root`
   VS Code theme variables are applied on body element.
   ═══════════════════════════════════════════════════════════════════ */

/* ───────────────────────────────────────────────────────────────────
   LAYER 1: FOUNDATION TOKENS
   Base primitives - spacing, typography, motion
   ─────────────────────────────────────────────────────────────────── */

body {
    /* Spacing Scale (4px base) */
    --space-0: 0;
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-8: 32px;
    --space-10: 40px;
    --space-12: 48px;

    /* Typography Scale */
    --font-size-2xs: 10px;
    --font-size-xs: 11px;
    --font-size-sm: 12px;
    --font-size-base: 13px;
    --font-size-lg: 14px;
    --font-size-xl: 16px;
    --font-size-2xl: 20px;
    --font-size-3xl: 24px;

    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;

    --line-height-none: 1;
    --line-height-tight: 1.25;
    --line-height-snug: 1.375;
    --line-height-normal: 1.5;
    --line-height-relaxed: 1.625;

    --letter-spacing-tight: -0.025em;
    --letter-spacing-normal: 0;
    --letter-spacing-wide: 0.025em;
    --letter-spacing-wider: 0.05em;
    --letter-spacing-widest: 0.1em;

    /* Border Radius */
    --radius-none: 0;
    --radius-sm: 2px;
    --radius-md: 4px;
    --radius-lg: 6px;
    --radius-xl: 8px;
    --radius-full: 9999px;

    /* Motion */
    --duration-instant: 0ms;
    --duration-fast: 100ms;
    --duration-normal: 200ms;
    --duration-slow: 300ms;
    --duration-slower: 500ms;

    --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
    --easing-in: cubic-bezier(0.4, 0, 1, 1);
    --easing-out: cubic-bezier(0, 0, 0.2, 1);
    --easing-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

    /* Z-Index Scale */
    --z-base: 0;
    --z-dropdown: 10;
    --z-sticky: 20;
    --z-overlay: 30;
    --z-modal: 40;
    --z-toast: 50;
}

/* ───────────────────────────────────────────────────────────────────
   LAYER 2: SEMANTIC TOKENS
   Map to VS Code theme variables
   ─────────────────────────────────────────────────────────────────── */

body {
    /* Surface Colors */
    --color-surface-0: var(--vscode-editor-background);
    --color-surface-1: var(--vscode-sideBar-background);
    --color-surface-2: var(--vscode-editorWidget-background);
    --color-surface-3: var(--vscode-input-background);

    /* Text Colors */
    --color-text-0: var(--vscode-foreground);
    --color-text-1: var(--vscode-descriptionForeground);
    --color-text-2: var(--vscode-disabledForeground);
    --color-text-link: var(--vscode-textLink-foreground);
    --color-text-link-hover: var(--vscode-textLink-activeForeground);

    /* Border Colors */
    --color-border-0: var(--vscode-panel-border);
    --color-border-1: var(--vscode-widget-border);
    --color-border-focus: var(--vscode-focusBorder);

    /* Interactive States */
    --color-interactive-hover: var(--vscode-list-hoverBackground);
    --color-interactive-active: var(--vscode-list-activeSelectionBackground);
    --color-interactive-focus: var(--vscode-focusBorder);

    /* Button Colors */
    --color-button-bg: var(--vscode-button-background);
    --color-button-fg: var(--vscode-button-foreground);
    --color-button-hover: var(--vscode-button-hoverBackground);
    --color-button-secondary-bg: var(--vscode-button-secondaryBackground);
    --color-button-secondary-fg: var(--vscode-button-secondaryForeground);
    --color-button-secondary-hover: var(--vscode-button-secondaryHoverBackground);

    /* Form Colors */
    --color-input-bg: var(--vscode-input-background);
    --color-input-fg: var(--vscode-input-foreground);
    --color-input-border: var(--vscode-input-border);
    --color-input-placeholder: var(--vscode-input-placeholderForeground);

    /* Status Colors - FOREGROUND BASED (not background fills) */
    --color-error: var(--vscode-editorError-foreground);
    --color-warning: var(--vscode-editorWarning-foreground);
    --color-info: var(--vscode-editorInfo-foreground);
    --color-success: var(--vscode-testing-iconPassed);

    /* Progress */
    --color-progress-bg: var(--vscode-progressBar-background);
}

/* ───────────────────────────────────────────────────────────────────
   LAYER 3: SEVERITY TOKENS
   Core visual language for vulnerability display
   
   DESIGN DECISION: Use foreground colors + left border accent
   NOT full background fills (better contrast, less visual noise)
   ─────────────────────────────────────────────────────────────────── */

body {
    /* Critical - Immediate action required */
    --severity-critical-fg: var(--vscode-editorError-foreground);
    --severity-critical-border: var(--vscode-editorError-foreground);
    --severity-critical-bg: transparent;
    --severity-critical-bg-subtle: var(--vscode-inputValidation-errorBackground);

    /* High - Urgent attention needed */
    --severity-high-fg: var(--vscode-editorWarning-foreground);
    --severity-high-border: var(--vscode-editorWarning-foreground);
    --severity-high-bg: transparent;
    --severity-high-bg-subtle: var(--vscode-inputValidation-warningBackground);

    /* Medium - Should address soon */
    --severity-medium-fg: var(--vscode-editorInfo-foreground);
    --severity-medium-border: var(--vscode-editorInfo-foreground);
    --severity-medium-bg: transparent;
    --severity-medium-bg-subtle: var(--vscode-inputValidation-infoBackground);

    /* Low - Informational */
    --severity-low-fg: var(--vscode-descriptionForeground);
    --severity-low-border: var(--vscode-panel-border);
    --severity-low-bg: transparent;
    --severity-low-bg-subtle: var(--vscode-editor-inactiveSelectionBackground);
}

/* ───────────────────────────────────────────────────────────────────
   LAYER 4: COMPONENT TOKENS
   Specific component configurations
   ─────────────────────────────────────────────────────────────────── */

body {
    /* Card Component */
    --card-bg: var(--color-surface-0);
    --card-border: var(--color-border-0);
    --card-border-hover: var(--color-border-focus);
    --card-radius: var(--radius-lg);
    --card-padding: var(--space-4);
    --card-gap: var(--space-3);

    /* Badge Component */
    --badge-radius: var(--radius-sm);
    --badge-padding-x: var(--space-2);
    --badge-padding-y: var(--space-1);
    --badge-font-size: var(--font-size-xs);
    --badge-font-weight: var(--font-weight-semibold);

    /* Vulnerability Card - Left border accent pattern */
    --vuln-border-width: 3px;
    --vuln-card-padding: var(--space-3);
    --vuln-card-gap: var(--space-2);
}

/* ───────────────────────────────────────────────────────────────────
   ANIMATIONS
   Purposeful motion only
   ─────────────────────────────────────────────────────────────────── */

@keyframes devign-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes devign-slide-up {
    from { 
        opacity: 0;
        transform: translateY(8px);
    }
    to { 
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes devign-scale-in {
    from {
        opacity: 0;
        transform: scale(0.96);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

@keyframes devign-progress-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

@keyframes devign-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* ───────────────────────────────────────────────────────────────────
   REDUCED MOTION
   Respect user preferences
   ─────────────────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
    body {
        --duration-instant: 0ms;
        --duration-fast: 0ms;
        --duration-normal: 0ms;
        --duration-slow: 0ms;
        --duration-slower: 0ms;
    }

    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}

/* ───────────────────────────────────────────────────────────────────
   UTILITY CLASSES
   Reusable patterns - use these in components
   ─────────────────────────────────────────────────────────────────── */

/* Typography */
.text-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-tight);
    color: var(--color-text-0);
}

.text-heading {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-tight);
    color: var(--color-text-0);
}

.text-subheading {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-wider);
    color: var(--color-text-1);
}

.text-body {
    font-size: var(--font-size-base);
    line-height: var(--line-height-normal);
    color: var(--color-text-0);
}

.text-caption {
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);
    color: var(--color-text-1);
}

.text-mono {
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: var(--font-size-sm);
}

/* Cards */
.card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--card-radius);
    padding: var(--card-padding);
    transition: border-color var(--duration-fast) var(--easing-default);
}

.card:hover {
    border-color: var(--card-border-hover);
}

.card-interactive {
    cursor: pointer;
}

.card-interactive:focus-visible {
    outline: 2px solid var(--color-interactive-focus);
    outline-offset: 2px;
}

/* Severity Cards - LEFT BORDER ACCENT PATTERN */
.vuln-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-left-width: var(--vuln-border-width);
    border-radius: var(--card-radius);
    padding: var(--vuln-card-padding);
    transition: all var(--duration-fast) var(--easing-default);
    cursor: pointer;
}

.vuln-card:hover {
    border-color: var(--card-border-hover);
    background: var(--color-interactive-hover);
}

.vuln-card:focus-visible {
    outline: 2px solid var(--color-interactive-focus);
    outline-offset: 2px;
}

.vuln-card--critical {
    border-left-color: var(--severity-critical-border);
}

.vuln-card--high {
    border-left-color: var(--severity-high-border);
}

.vuln-card--medium {
    border-left-color: var(--severity-medium-border);
}

.vuln-card--low {
    border-left-color: var(--severity-low-border);
}

/* Severity Badges */
.severity-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--badge-padding-y) var(--badge-padding-x);
    border-radius: var(--badge-radius);
    font-size: var(--badge-font-size);
    font-weight: var(--badge-font-weight);
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-wide);
}

.severity-badge--critical {
    color: var(--severity-critical-fg);
    background: var(--severity-critical-bg-subtle);
}

.severity-badge--high {
    color: var(--severity-high-fg);
    background: var(--severity-high-bg-subtle);
}

.severity-badge--medium {
    color: var(--severity-medium-fg);
    background: var(--severity-medium-bg-subtle);
}

.severity-badge--low {
    color: var(--severity-low-fg);
    background: var(--severity-low-bg-subtle);
}

/* Focus Ring */
.focus-ring:focus-visible {
    outline: 2px solid var(--color-interactive-focus);
    outline-offset: 2px;
}

/* Interactive element base */
.interactive {
    transition: all var(--duration-fast) var(--easing-default);
}

.interactive:hover {
    background: var(--color-interactive-hover);
}

/* Reveal on interact (for hidden actions) */
.reveal-on-interact {
    opacity: 0;
    transition: opacity var(--duration-fast) var(--easing-default);
}

.group:hover .reveal-on-interact,
.group:focus-within .reveal-on-interact,
.reveal-on-interact:focus-visible {
    opacity: 1;
}

/* Animation utilities */
.animate-fade-in {
    animation: devign-fade-in var(--duration-normal) var(--easing-default);
}

.animate-slide-up {
    animation: devign-slide-up var(--duration-normal) var(--easing-default);
}

.animate-scale-in {
    animation: devign-scale-in var(--duration-fast) var(--easing-default);
}

.animate-pulse {
    animation: devign-progress-pulse 2s var(--easing-default) infinite;
}

.animate-spin {
    animation: devign-spin 1s linear infinite;
}

/* Stagger children */
.stagger-children > * {
    animation: devign-slide-up var(--duration-normal) var(--easing-default) backwards;
}

.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 40ms; }
.stagger-children > *:nth-child(3) { animation-delay: 80ms; }
.stagger-children > *:nth-child(4) { animation-delay: 120ms; }
.stagger-children > *:nth-child(5) { animation-delay: 160ms; }
.stagger-children > *:nth-child(6) { animation-delay: 200ms; }
.stagger-children > *:nth-child(7) { animation-delay: 240ms; }
.stagger-children > *:nth-child(8) { animation-delay: 280ms; }
```

---

## 🗂️ TAILWIND CONFIGURATION

> **File: `webview-ui/tailwind.config.js`**
>
> Map CSS variables to Tailwind for readable classes.

```javascript
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Surfaces
                'surface-0': 'var(--color-surface-0)',
                'surface-1': 'var(--color-surface-1)',
                'surface-2': 'var(--color-surface-2)',
                
                // Text
                'text-0': 'var(--color-text-0)',
                'text-1': 'var(--color-text-1)',
                'text-2': 'var(--color-text-2)',
                'text-link': 'var(--color-text-link)',
                
                // Borders
                'border-0': 'var(--color-border-0)',
                'border-1': 'var(--color-border-1)',
                'border-focus': 'var(--color-border-focus)',
                
                // Interactive
                'interactive-hover': 'var(--color-interactive-hover)',
                'interactive-active': 'var(--color-interactive-active)',
                
                // Buttons
                'button': 'var(--color-button-bg)',
                'button-fg': 'var(--color-button-fg)',
                'button-hover': 'var(--color-button-hover)',
                
                // Severity
                'severity-critical': 'var(--severity-critical-fg)',
                'severity-high': 'var(--severity-high-fg)',
                'severity-medium': 'var(--severity-medium-fg)',
                'severity-low': 'var(--severity-low-fg)',
                
                // Status
                'error': 'var(--color-error)',
                'warning': 'var(--color-warning)',
                'info': 'var(--color-info)',
                'success': 'var(--color-success)',
            },
            spacing: {
                '0': 'var(--space-0)',
                '1': 'var(--space-1)',
                '2': 'var(--space-2)',
                '3': 'var(--space-3)',
                '4': 'var(--space-4)',
                '5': 'var(--space-5)',
                '6': 'var(--space-6)',
                '8': 'var(--space-8)',
            },
            borderRadius: {
                'sm': 'var(--radius-sm)',
                'md': 'var(--radius-md)',
                'lg': 'var(--radius-lg)',
                'xl': 'var(--radius-xl)',
            },
            fontSize: {
                '2xs': 'var(--font-size-2xs)',
                'xs': 'var(--font-size-xs)',
                'sm': 'var(--font-size-sm)',
                'base': 'var(--font-size-base)',
                'lg': 'var(--font-size-lg)',
                'xl': 'var(--font-size-xl)',
                '2xl': 'var(--font-size-2xl)',
            },
            transitionDuration: {
                'fast': 'var(--duration-fast)',
                'normal': 'var(--duration-normal)',
                'slow': 'var(--duration-slow)',
            },
            zIndex: {
                'dropdown': 'var(--z-dropdown)',
                'sticky': 'var(--z-sticky)',
                'overlay': 'var(--z-overlay)',
                'modal': 'var(--z-modal)',
                'toast': 'var(--z-toast)',
            },
        },
    },
    plugins: [],
}
```

---

## 📊 Priority Levels

| Priority | Meaning | Timeline | Hours |
|----------|---------|----------|-------|
| 🔴 **P0 - Critical** | Foundation, blocking issues | Week 1 | ~20h |
| 🟠 **P1 - High** | Core functionality, major UX | Week 1-2 | ~16h |
| 🟡 **P2 - Medium** | Polish, refinement | Week 2-3 | ~10h |
| 🟢 **P3 - Low** | Nice-to-have | Backlog | ~4h |

---

## 🔴 P0 - CRITICAL (Week 1)

### Task 0.1: Design Token System Setup

**Objective:** Create foundation for all UI consistency.

**Deliverables:**
- [ ] Create `webview-ui/src/styles/tokens.css` (full content above)
- [ ] Import tokens in `index.css`: `@import './styles/tokens.css';`
- [ ] Update `tailwind.config.js` with token mappings
- [ ] Remove `App.css` template content
- [ ] Verify tokens load on `body` element

**Design Rules:**
- ✅ All colors via `var(--color-*)` or Tailwind mapped classes
- ✅ All spacing via `var(--space-*)` or Tailwind mapped classes
- ❌ No hardcoded colors anywhere
- ❌ No `:root` declarations

**Estimated Effort:** 3-4 hours

---

### Task 0.2: Severity Visual System Refactor

**Objective:** Unified severity display across all components.

**Design Pattern - Left Border Accent:**
```
┌────────────────────────────────────────────────┐
│ ┃ CRITICAL  Buffer overflow in parse()        │
│ ┃ src/parser.c:142                            │
│ ┃ Confidence: 95%                             │
└────────────────────────────────────────────────┘
  ↑
  3px colored left border = severity indicator
```

**Files to Update:**
- [ ] `ScanResults.tsx` - Use `.vuln-card--{severity}` classes
- [ ] `ReportPanel.tsx` - Use `.vuln-card--{severity}` classes  
- [ ] `ReportPanel.tsx` - Use `.severity-badge--{severity}` classes
- [ ] Remove ALL hardcoded Tailwind colors (`bg-red-600`, `text-orange-500`, etc.)

**Code Example:**
```tsx
// ✅ CORRECT - Using design system
<div className={`vuln-card vuln-card--${severity.toLowerCase()}`}>
    <span className={`severity-badge severity-badge--${severity.toLowerCase()}`}>
        {severity}
    </span>
    {/* content */}
</div>

// ❌ WRONG - Hardcoded colors
<div className="bg-red-600 text-white">
    {severity}
</div>
```

**Estimated Effort:** 4-5 hours

---

### Task 0.3: Keyboard Accessibility Foundation

**Objective:** All interactive elements accessible via keyboard.

**Issues to Fix:**
| Component | Issue | Solution |
|-----------|-------|----------|
| GitPanel | Hidden stage/unstage buttons | Add `.reveal-on-interact` + `focus-within` |
| VulnerabilityCard | Only Enter, not Space | Add Space handler + `e.preventDefault()` |
| ReportPanel | Missing label associations | Add `id` + `htmlFor` |
| All | Inconsistent focus rings | Use `.focus-ring` class |

**Utility Function:**
```typescript
// webview-ui/src/utilities/keyboard.ts
export const handleActivation = (
    e: React.KeyboardEvent,
    callback: () => void
) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callback();
    }
};
```

**Estimated Effort:** 3-4 hours

---

### Task 0.4: Unified Messaging Architecture

**Objective:** Type-safe, consistent VS Code messaging.

**File: `webview-ui/src/utilities/messages.ts`**

```typescript
import { vscode } from './vscode';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export interface FileLocation {
    path: string;
    range?: {
        startLine: number;
        endLine?: number;
        startColumn?: number;
        endColumn?: number;
    };
}

export type ScanStatus = 'idle' | 'scanning' | 'completed' | 'error';

export interface ScanStatusPayload {
    status: ScanStatus;
    progress?: number; // 0-100
    message?: string;
    error?: string;
}

export type GitAction = 
    | 'commit' 
    | 'push' 
    | 'pull' 
    | 'stage' 
    | 'unstage' 
    | 'checkout' 
    | 'createBranch' 
    | 'deleteBranch';

// ═══════════════════════════════════════════════════════════════
// MESSAGE SENDERS
// ═══════════════════════════════════════════════════════════════

export const messages = {
    openFile: (location: FileLocation) => {
        vscode.postMessage({ type: 'OPEN_FILE', payload: location });
    },

    runScan: (options?: { files?: string[] }) => {
        vscode.postMessage({ type: 'RUN_SCAN', payload: options });
    },

    cancelScan: () => {
        vscode.postMessage({ type: 'CANCEL_SCAN' });
    },

    exportReport: (format: 'json' | 'html' | 'sarif' = 'json') => {
        vscode.postMessage({ type: 'EXPORT_REPORT', payload: { format } });
    },

    git: (action: GitAction, data?: unknown) => {
        vscode.postMessage({ type: 'GIT_ACTION', payload: { action, data } });
    },

    openSettings: () => {
        vscode.postMessage({ type: 'OPEN_SETTINGS' });
    },

    copyToClipboard: (text: string) => {
        vscode.postMessage({ type: 'COPY_TO_CLIPBOARD', payload: { text } });
    },
} as const;

// ═══════════════════════════════════════════════════════════════
// STATE PERSISTENCE
// ═══════════════════════════════════════════════════════════════

interface WebviewState {
    viewMode: 'dashboard' | 'report';
    selectedVulnId?: string;
    filters?: {
        severities: string[];
        searchQuery?: string;
    };
    scrollPosition?: number;
}

export const state = {
    get: (): WebviewState | undefined => {
        return vscode.getState() as WebviewState | undefined;
    },

    set: (newState: Partial<WebviewState>) => {
        const current = state.get() || {};
        vscode.setState({ ...current, ...newState });
    },

    clear: () => {
        vscode.setState(undefined);
    },
};
```

**Tasks:**
- [ ] Create `messages.ts` with typed API
- [ ] Refactor all components to use `messages.*`
- [ ] Remove all `@ts-ignore`
- [ ] Remove direct `window.vscode` access
- [ ] Implement `state.get/set` for persistence

**Estimated Effort:** 4-5 hours

---

### Task 0.5: Error State System

**Objective:** Handle all error scenarios gracefully.

**Error States to Implement:**

| Error | UI Treatment |
|-------|--------------|
| Scan failed | Error banner + retry button |
| Engine not installed | Setup wizard CTA |
| No workspace open | Instructional empty state |
| Permission denied | Explain + settings link |
| Network error | Retry button + offline indicator |
| Timeout | Partial results + continue option |

**Component: `webview-ui/src/components/ErrorState.tsx`**

```tsx
interface ErrorStateProps {
    type: 'scan-failed' | 'engine-missing' | 'no-workspace' | 
          'permission-denied' | 'network' | 'timeout';
    message?: string;
    onRetry?: () => void;
    onSettings?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    type,
    message,
    onRetry,
    onSettings
}) => {
    const config = ERROR_CONFIGS[type];
    
    return (
        <div className="card p-6 text-center animate-fade-in">
            <span 
                className={`codicon codicon-${config.icon} text-3xl mb-4 text-error`}
                aria-hidden="true"
            />
            <h3 className="text-heading mb-2">{config.title}</h3>
            <p className="text-caption mb-4 max-w-sm mx-auto">
                {message || config.description}
            </p>
            <div className="flex gap-2 justify-center">
                {onRetry && (
                    <button 
                        onClick={onRetry}
                        className="px-4 py-2 bg-button text-button-fg rounded-md 
                                   hover:bg-button-hover focus-ring"
                    >
                        Try Again
                    </button>
                )}
                {onSettings && (
                    <button 
                        onClick={onSettings}
                        className="px-4 py-2 bg-surface-2 text-text-0 rounded-md
                                   hover:bg-interactive-hover focus-ring"
                    >
                        Open Settings
                    </button>
                )}
            </div>
        </div>
    );
};

const ERROR_CONFIGS = {
    'scan-failed': {
        icon: 'error',
        title: 'Scan Failed',
        description: 'An error occurred while scanning. Please try again.',
    },
    'engine-missing': {
        icon: 'tools',
        title: 'Scanner Not Configured',
        description: 'The Devign scanner engine needs to be set up.',
    },
    'no-workspace': {
        icon: 'folder',
        title: 'No Workspace Open',
        description: 'Open a folder containing C/C++ files to scan.',
    },
    'permission-denied': {
        icon: 'lock',
        title: 'Permission Required',
        description: 'Devign needs permission to access your files.',
    },
    'network': {
        icon: 'cloud-offline',
        title: 'Connection Error',
        description: 'Could not connect to the scanning service.',
    },
    'timeout': {
        icon: 'watch',
        title: 'Scan Timed Out',
        description: 'The scan took too long. Try scanning fewer files.',
    },
};
```

**Estimated Effort:** 3-4 hours

---

## 🟠 P1 - HIGH PRIORITY (Week 1-2)

### Task 1.1: Scan Lifecycle UX

**Objective:** Full feedback during scan operations.

**States:**
```
IDLE → SCANNING → COMPLETED/ERROR
         ↓
    [Cancel available]
```

**Components Needed:**
- [ ] `ScanProgressOverlay.tsx` - Modal overlay during scan
- [ ] Update `SecurityGate` - Wire to real progress
- [ ] Update `App.tsx` - Handle `SCAN_STATUS` messages
- [ ] Add cancel functionality

**Design Spec:**
```tsx
const ScanProgressOverlay = ({ progress, message, onCancel }: Props) => (
    <div className="fixed inset-0 bg-surface-0/80 backdrop-blur-sm 
                    flex items-center justify-center z-overlay animate-fade-in">
        <div className="card p-8 text-center max-w-sm animate-scale-in">
            {/* Spinner */}
            <div className="w-12 h-12 mx-auto mb-4 border-2 border-border-0 
                            border-t-button rounded-full animate-spin" />
            
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden mb-3">
                <div 
                    className="h-full bg-button transition-all duration-slow"
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            {/* Status text */}
            <p className="text-body mb-1">{progress}% complete</p>
            <p className="text-caption mb-4">{message || 'Analyzing code...'}</p>
            
            {/* Cancel button */}
            <button 
                onClick={onCancel}
                className="px-4 py-2 text-sm text-text-1 hover:text-text-0 
                           hover:bg-interactive-hover rounded-md focus-ring"
            >
                Cancel
            </button>
        </div>
    </div>
);
```

**Estimated Effort:** 5-6 hours

---

### Task 1.2: State Persistence

**Objective:** UI state survives webview reload.

**State to Persist:**
- Current view mode (dashboard/report)
- Selected vulnerability ID
- Active filters (severities, search)
- Scroll position
- Collapsed/expanded sections

**Implementation:**
```typescript
// In App.tsx
useEffect(() => {
    // Restore state on mount
    const saved = state.get();
    if (saved) {
        setViewMode(saved.viewMode);
        setSelectedVulnId(saved.selectedVulnId);
        setFilters(saved.filters);
    }
}, []);

// Save state on changes
useEffect(() => {
    state.set({ viewMode, selectedVulnId, filters });
}, [viewMode, selectedVulnId, filters]);
```

**Estimated Effort:** 2-3 hours

---

### Task 1.3: Wire Real Data (Remove Mocks)

**Objective:** Connect to real extension data.

**Mock Data to Remove:**
```typescript
// ❌ Remove these from App.tsx
const [gateStatus] = useState<GateStatus>('PENDING');
const [gateProgress] = useState(0);
const [gitStatus] = useState({...});
```

**Message Handlers to Add:**
```typescript
case MessageType.GATE_STATUS:
    setGateStatus(message.payload.status);
    setGateProgress(message.payload.progress);
    break;

case MessageType.GIT_STATUS:
    setGitStatus(message.payload);
    break;
```

**Estimated Effort:** 3-4 hours

---

### Task 1.4: Triage UX Features

**Objective:** Efficient vulnerability management.

**Features:**
- [ ] Search by description/file/CWE
- [ ] Filter by severity (multi-select)
- [ ] Sort by severity/file/confidence
- [ ] Group by file
- [ ] Collapse/expand groups
- [ ] "Copy finding" action
- [ ] Keyboard shortcuts (j/k navigation)

**Design:**
```tsx
// Filter bar above results
<div className="flex items-center gap-3 p-3 border-b border-border-0">
    {/* Search */}
    <div className="flex-1 relative">
        <span className="codicon codicon-search absolute left-3 top-1/2 
                         -translate-y-1/2 text-text-1" />
        <input 
            type="text"
            placeholder="Search vulnerabilities..."
            className="w-full pl-9 pr-3 py-1.5 bg-surface-3 text-text-0 
                       border border-border-0 rounded-md text-sm
                       focus:border-border-focus focus:outline-none"
        />
    </div>
    
    {/* Severity filters */}
    <div className="flex gap-1">
        {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
            <button
                key={sev}
                onClick={() => toggleFilter(sev)}
                className={cn(
                    'severity-badge',
                    `severity-badge--${sev.toLowerCase()}`,
                    !filters.has(sev) && 'opacity-40'
                )}
                aria-pressed={filters.has(sev)}
            >
                {sev}
            </button>
        ))}
    </div>
    
    {/* Sort dropdown */}
    <select className="bg-surface-3 text-text-0 border border-border-0 
                       rounded-md px-2 py-1.5 text-sm">
        <option value="severity">Sort by Severity</option>
        <option value="file">Sort by File</option>
        <option value="confidence">Sort by Confidence</option>
    </select>
</div>
```

**Estimated Effort:** 5-6 hours

---

## 🟡 P2 - MEDIUM (Week 2-3)

### Task 2.1: Performance - Virtualization

**Objective:** Handle 1000+ vulnerabilities smoothly.

**Solution:** Use `react-window` for virtualized lists.

```tsx
import { FixedSizeList } from 'react-window';

const VirtualizedVulnList = ({ items }: Props) => (
    <FixedSizeList
        height={600}
        itemCount={items.length}
        itemSize={120}
        width="100%"
    >
        {({ index, style }) => (
            <div style={style}>
                <VulnerabilityCard vuln={items[index]} />
            </div>
        )}
    </FixedSizeList>
);
```

**Tasks:**
- [ ] Install `react-window`
- [ ] Create `VirtualizedVulnList` component
- [ ] Apply to ScanResults
- [ ] Apply to ReportPanel
- [ ] Memoize list items

**Estimated Effort:** 3-4 hours

---

### Task 2.2: Codicons Integration

**Objective:** Replace emojis with VS Code native icons.

**CSP Configuration Required:**
```typescript
// In extension's webview provider
const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 
        'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
);

// CSP must include:
// font-src ${webview.cspSource}
```

**Icons to Use:**
| Context | Icon |
|---------|------|
| Critical | `codicon-error` |
| High | `codicon-warning` |
| Medium | `codicon-info` |
| Low | `codicon-note` |
| Scan | `codicon-shield` |
| Export | `codicon-export` |
| Settings | `codicon-gear` |
| Success | `codicon-check` |
| Git | `codicon-git-branch` |

**Estimated Effort:** 3-4 hours (includes CSP setup)

---

### Task 2.3: Empty States Enhancement

**Component: `webview-ui/src/components/EmptyState.tsx`**

```tsx
interface EmptyStateProps {
    icon: string;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    action,
    secondaryAction
}) => (
    <div className="flex flex-col items-center justify-center py-12 px-8 
                    text-center border-2 border-dashed border-border-0 
                    rounded-lg animate-fade-in">
        <span 
            className={`codicon codicon-${icon} text-4xl mb-4 text-text-1`}
            aria-hidden="true" 
        />
        <h3 className="text-heading mb-2">{title}</h3>
        <p className="text-caption max-w-sm mb-6">{description}</p>
        
        <div className="flex gap-3">
            {action && (
                <button 
                    onClick={action.onClick}
                    className="px-4 py-2 bg-button text-button-fg rounded-md
                               hover:bg-button-hover focus-ring"
                >
                    {action.label}
                </button>
            )}
            {secondaryAction && (
                <button 
                    onClick={secondaryAction.onClick}
                    className="px-4 py-2 text-text-1 hover:text-text-0
                               hover:bg-interactive-hover rounded-md focus-ring"
                >
                    {secondaryAction.label}
                </button>
            )}
        </div>
    </div>
);

// Usage
<EmptyState 
    icon="shield"
    title="No scan results yet"
    description="Open a C/C++ file and run a security scan to detect vulnerabilities."
    action={{
        label: "Run Scan",
        onClick: () => messages.runScan()
    }}
    secondaryAction={{
        label: "Open Settings",
        onClick: () => messages.openSettings()
    }}
/>
```

**Estimated Effort:** 2 hours

---

### Task 2.4: Motion & Micro-interactions

**Objective:** Purposeful animations that enhance UX.

**Where to Apply:**

| Location | Animation | Trigger |
|----------|-----------|---------|
| Vulnerability list | `.stagger-children` | On load/filter change |
| New results | `.animate-fade-in` | After scan completes |
| Severity badges | `.animate-scale-in` | On appear |
| Progress bar | `.animate-pulse` | During scan |
| Cards | Hover border transition | Already in tokens |
| Overlays | `.animate-fade-in` + `.animate-scale-in` | On open |

**Estimated Effort:** 2 hours

---

## 🟢 P3 - LOW (Backlog)

### Task 3.1: Tab State Improvement

- [ ] Disable Report tab when no data
- [ ] Add "(empty)" indicator
- [ ] Consider auto-switch behavior

**Estimated Effort:** 1 hour

---

### Task 3.2: Content/Copy Consistency

- [ ] Unify Vietnamese/English usage
- [ ] Define terminology: "vulnerability" vs "finding" vs "issue"
- [ ] Standardize severity labels
- [ ] Add helpful microcopy throughout

**Estimated Effort:** 2 hours

---

### Task 3.3: CSP Hardening

- [ ] Audit current CSP
- [ ] Remove inline styles where possible
- [ ] Ensure no remote resources
- [ ] Sanitize HTML in findings
- [ ] Document CSP requirements

**Estimated Effort:** 2-3 hours

---

## 📁 FILES TO CREATE/MODIFY

### New Files

| File | Purpose |
|------|---------|
| `webview-ui/src/styles/tokens.css` | Design token system |
| `webview-ui/src/utilities/messages.ts` | Typed messaging API |
| `webview-ui/src/utilities/keyboard.ts` | Keyboard utilities |
| `webview-ui/src/components/EmptyState.tsx` | Empty state component |
| `webview-ui/src/components/ErrorState.tsx` | Error state component |
| `webview-ui/src/components/ScanProgressOverlay.tsx` | Scan progress UI |
| `webview-ui/src/components/VirtualizedVulnList.tsx` | Virtualized list |

### Files to Modify

| File | Changes |
|------|---------|
| `webview-ui/src/index.css` | Import tokens.css |
| `webview-ui/src/App.css` | Delete or empty |
| `webview-ui/tailwind.config.js` | Add token mappings |
| `webview-ui/src/App.tsx` | State management, remove mocks |
| `webview-ui/src/components/ScanResults.tsx` | Use design system classes |
| `webview-ui/src/components/ReportPanel.tsx` | Remove hardcoded colors |
| `webview-ui/src/components/GitPanel.tsx` | Fix accessibility, remove @ts-ignore |
| `webview-ui/src/components/Dashboard.tsx` | Use design system classes |
| `webview-ui/src/components/SecurityGate.tsx` | Wire to real data |

---

## 📅 IMPLEMENTATION TIMELINE

### Week 1: Foundation (20 hours)

| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | Task 0.1: Design Token System | 4h |
| 2 | Task 0.2: Severity Visual System | 5h |
| 3 | Task 0.3: Keyboard Accessibility | 4h |
| 4 | Task 0.4: Messaging Architecture | 4h |
| 5 | Task 0.5: Error State System | 3h |

### Week 2: Core UX (16 hours)

| Day | Tasks | Hours |
|-----|-------|-------|
| 1-2 | Task 1.1: Scan Lifecycle UX | 6h |
| 3 | Task 1.2: State Persistence | 3h |
| 4 | Task 1.3: Wire Real Data | 3h |
| 5 | Task 1.4: Triage UX (partial) | 4h |

### Week 3: Polish (10 hours)

| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | Task 2.1: Virtualization | 4h |
| 2 | Task 2.2: Codicons | 3h |
| 3 | Task 2.3: Empty States + Task 2.4: Motion | 3h |

---

## ✅ ACCEPTANCE CRITERIA

### Design System Compliance

- [ ] ALL colors use CSS custom properties (zero hardcoded values)
- [ ] ALL spacing follows 4px grid via tokens
- [ ] ALL typography uses defined scale
- [ ] ALL components use `.card`, `.severity-badge`, `.vuln-card` patterns
- [ ] Severity ALWAYS uses left-border accent pattern

### Theme Compatibility

- [ ] Works on Dark+ theme
- [ ] Works on Light+ theme
- [ ] Works on High Contrast Dark
- [ ] Works on High Contrast Light
- [ ] No color contrast issues (4.5:1 minimum)

### Accessibility (WCAG 2.1 AA)

- [ ] All interactive elements keyboard accessible
- [ ] Tab order is logical
- [ ] Focus rings visible (2px solid)
- [ ] ARIA labels on non-semantic elements
- [ ] Labels associated with form controls
- [ ] `prefers-reduced-motion` respected

### Code Quality

- [ ] Zero `@ts-ignore` statements
- [ ] Zero `eslint-disable` comments
- [ ] All messages use typed API
- [ ] State persisted via vscode.setState
- [ ] No mock/hardcoded data in production

---

## 🧪 TESTING CHECKLIST

### Theme Testing
```
□ Default Dark+
□ Default Light+
□ High Contrast Dark
□ High Contrast Light
□ One Dark Pro (community)
□ GitHub Light/Dark (community)
```

### Accessibility Testing
```
□ Tab through entire UI
□ All buttons reachable via keyboard
□ Focus visible on all elements
□ Screen reader announces correctly
□ Contrast ratio ≥ 4.5:1
```

### Functionality Testing
```
□ Scan starts and shows progress
□ Cancel works during scan
□ Error states display correctly
□ Results load and filter
□ Click opens file at line
□ State persists on reload
□ Large result sets (500+) perform well
```

---

## 📎 REFERENCES

### VS Code
- [Theme Color Reference](https://code.visualstudio.com/api/references/theme-color)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Codicons](https://microsoft.github.io/vscode-codicons/dist/codicon.html)
- [Webview UI Toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit)

### Accessibility
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [Inclusive Components](https://inclusive-components.design/)

### Performance
- [react-window](https://github.com/bvaughn/react-window)
- [Web Vitals](https://web.dev/vitals/)

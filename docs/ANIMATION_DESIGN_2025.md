# Animation & Design System Plan 2025

> Modern UI/UX design trends for Devign Vulnerability Scanner VS Code Extension

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Animation System](#animation-system)
3. [Micro-interactions](#micro-interactions)
4. [Component Enhancement Plan](#component-enhancement-plan)
5. [Implementation Phases](#implementation-phases)
6. [Shadcn Components Integration](#shadcn-components-integration)

---

## Design Philosophy

### Core Principles (2025 Trends)

| Principle | Description | Application |
|-----------|-------------|-------------|
| **Motion as Feedback** | Animations serve purpose, not decoration | Scan progress, status changes, user actions |
| **Subtle Glassmorphism** | Frosted-glass effects with depth | Overlays, elevated cards, modals |
| **Micro-interactions** | Small feedback animations | Hover states, button clicks, badge pulses |
| **Accessibility First** | Respect `prefers-reduced-motion` | All animations optional |
| **Performance** | GPU-accelerated, 60fps | Use `transform`, `opacity` only |

### Design Tokens Integration

Leverage existing `tokens.css` motion tokens:
- `--duration-fast`: 100ms (micro-interactions)
- `--duration-normal`: 200ms (state transitions)
- `--duration-slow`: 300ms (entrance animations)
- `--ease-out`: Standard easing
- `--ease-bounce`: Playful feedback

---

## Animation System

### Keyframes Library

Add to `tailwind.config.js`:

```javascript
keyframes: {
  // === ENTRANCE ANIMATIONS ===
  'fade-in': {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  'fade-in-up': {
    '0%': { opacity: '0', transform: 'translateY(8px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  'fade-in-down': {
    '0%': { opacity: '0', transform: 'translateY(-8px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  'scale-in': {
    '0%': { opacity: '0', transform: 'scale(0.95)' },
    '100%': { opacity: '1', transform: 'scale(1)' },
  },
  'slide-in-right': {
    '0%': { opacity: '0', transform: 'translateX(16px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' },
  },
  'slide-in-left': {
    '0%': { opacity: '0', transform: 'translateX(-16px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' },
  },

  // === EXIT ANIMATIONS ===
  'fade-out': {
    '0%': { opacity: '1' },
    '100%': { opacity: '0' },
  },
  'fade-out-down': {
    '0%': { opacity: '1', transform: 'translateY(0)' },
    '100%': { opacity: '0', transform: 'translateY(8px)' },
  },
  'scale-out': {
    '0%': { opacity: '1', transform: 'scale(1)' },
    '100%': { opacity: '0', transform: 'scale(0.95)' },
  },

  // === ATTENTION ANIMATIONS ===
  'pulse-glow': {
    '0%, 100%': { 
      opacity: '1',
      boxShadow: '0 0 0 0 currentColor',
    },
    '50%': { 
      opacity: '0.8',
      boxShadow: '0 0 0 4px transparent',
    },
  },
  'pulse-subtle': {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: '0.7' },
  },
  'shake': {
    '0%, 100%': { transform: 'translateX(0)' },
    '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
    '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' },
  },
  'bounce-subtle': {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-4px)' },
  },

  // === LOADING ANIMATIONS ===
  'shimmer': {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
  'spin-slow': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
  'progress-indeterminate': {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(400%)' },
  },

  // === EXPAND/COLLAPSE ===
  'accordion-down': {
    '0%': { height: '0', opacity: '0' },
    '100%': { height: 'var(--radix-accordion-content-height)', opacity: '1' },
  },
  'accordion-up': {
    '0%': { height: 'var(--radix-accordion-content-height)', opacity: '1' },
    '100%': { height: '0', opacity: '0' },
  },
  'collapsible-down': {
    '0%': { height: '0', opacity: '0' },
    '100%': { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
  },
  'collapsible-up': {
    '0%': { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
    '100%': { height: '0', opacity: '0' },
  },

  // === SEVERITY SPECIFIC ===
  'critical-pulse': {
    '0%, 100%': { 
      boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.4)',
    },
    '50%': { 
      boxShadow: '0 0 0 6px rgba(239, 68, 68, 0)',
    },
  },
  'scanning-pulse': {
    '0%, 100%': { 
      boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.4)',
    },
    '50%': { 
      boxShadow: '0 0 0 8px rgba(59, 130, 246, 0)',
    },
  },
},

animation: {
  // Entrance
  'fade-in': 'fade-in var(--duration-normal) var(--ease-out)',
  'fade-in-fast': 'fade-in var(--duration-fast) var(--ease-out)',
  'fade-in-up': 'fade-in-up var(--duration-normal) var(--ease-out)',
  'fade-in-down': 'fade-in-down var(--duration-normal) var(--ease-out)',
  'scale-in': 'scale-in var(--duration-normal) var(--ease-out)',
  'slide-in-right': 'slide-in-right var(--duration-slow) var(--ease-out)',
  'slide-in-left': 'slide-in-left var(--duration-slow) var(--ease-out)',
  
  // Exit
  'fade-out': 'fade-out var(--duration-normal) var(--ease-out)',
  'fade-out-down': 'fade-out-down var(--duration-normal) var(--ease-out)',
  'scale-out': 'scale-out var(--duration-normal) var(--ease-out)',
  
  // Attention
  'pulse-glow': 'pulse-glow 2s var(--ease-in-out) infinite',
  'pulse-subtle': 'pulse-subtle 2s var(--ease-in-out) infinite',
  'shake': 'shake 0.5s var(--ease-out)',
  'bounce-subtle': 'bounce-subtle 0.5s var(--ease-bounce)',
  
  // Loading
  'shimmer': 'shimmer 2s linear infinite',
  'spin-slow': 'spin-slow 2s linear infinite',
  'progress-indeterminate': 'progress-indeterminate 1.5s var(--ease-in-out) infinite',
  
  // Expand/Collapse
  'accordion-down': 'accordion-down var(--duration-normal) var(--ease-out)',
  'accordion-up': 'accordion-up var(--duration-normal) var(--ease-out)',
  'collapsible-down': 'collapsible-down var(--duration-normal) var(--ease-out)',
  'collapsible-up': 'collapsible-up var(--duration-normal) var(--ease-out)',
  
  // Severity
  'critical-pulse': 'critical-pulse 2s var(--ease-in-out) infinite',
  'scanning-pulse': 'scanning-pulse 1.5s var(--ease-in-out) infinite',
}
```

---

## Micro-interactions

### Hover Effects

| Element | Effect | CSS Classes |
|---------|--------|-------------|
| Buttons | Scale + brightness | `hover:scale-[1.02] hover:brightness-110 transition-all` |
| Cards | Lift + shadow | `hover:-translate-y-0.5 hover:shadow-token-md transition-all` |
| List items | Background + border | `hover:bg-bg-hover hover:border-border-focus transition-colors` |
| Links | Underline + color | `hover:underline hover:text-text-link-hover transition-colors` |
| Icons | Scale + opacity | `hover:scale-110 hover:opacity-80 transition-transform` |

### Click/Active Effects

| Element | Effect | CSS Classes |
|---------|--------|-------------|
| Buttons | Scale down | `active:scale-[0.98] transition-transform` |
| Cards | Slight press | `active:scale-[0.995] transition-transform` |
| Badges | Quick pulse | `active:animate-pulse-subtle` |

### Focus Effects

| Element | Effect | CSS Classes |
|---------|--------|-------------|
| All interactive | Ring + outline | `focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1` |
| Inputs | Border highlight | `focus:border-border-focus focus:ring-1 focus:ring-border-focus` |

---

## Component Enhancement Plan

### 1. StatsCards (Severity Counters)

**Current:** Static cards with numbers
**Enhanced:**
- Entrance: Staggered `fade-in-up` for each card
- Counter: Animated number count-up on load
- Hover: Lift effect with shadow
- Critical/High: Subtle pulse when count > 0

```tsx
// Animation classes
<Card className="animate-fade-in-up hover:-translate-y-0.5 hover:shadow-token-md transition-all">
  {/* For critical severity */}
  <Badge className={count > 0 ? 'animate-pulse-subtle' : ''}>
    {count}
  </Badge>
</Card>

// Staggered delay via style
style={{ animationDelay: `${index * 50}ms` }}
```

### 2. FindingsList

**Current:** Static list
**Enhanced:**
- Entrance: Staggered `fade-in-up` for each item
- Expand: Smooth `collapsible-down` animation
- Hover: Background highlight + border accent
- Actions: Scale on hover

```tsx
<Collapsible>
  <CollapsibleContent className="animate-collapsible-down data-[state=closed]:animate-collapsible-up">
    {/* Finding details */}
  </CollapsibleContent>
</Collapsible>
```

### 3. ScanProgressOverlay

**Current:** Basic progress bar
**Enhanced:**
- Overlay: `fade-in` + backdrop blur (glassmorphism)
- Progress bar: Shimmer effect on indeterminate
- Scanning indicator: `scanning-pulse` glow
- Cancel button: Hover scale

```tsx
<div className="animate-fade-in backdrop-blur-sm bg-black/50">
  <Progress className="animate-shimmer" />
  <div className="animate-scanning-pulse">Scanning...</div>
</div>
```

### 4. SecurityGateCompact

**Current:** Static status display
**Enhanced:**
- Status change: `scale-in` on update
- Passed: Brief success glow
- Failed: `critical-pulse` attention
- Icon: Rotate animation on loading

```tsx
<div className={cn(
  'transition-all',
  status === 'passed' && 'animate-scale-in',
  status === 'failed' && 'animate-critical-pulse'
)}>
  <Icon className={isLoading ? 'animate-spin-slow' : ''} />
</div>
```

### 5. Header

**Current:** Static header
**Enhanced:**
- Scan button: Hover glow, active press
- Dropdown: `fade-in-down` + `scale-in`
- Settings: Rotate icon on hover

```tsx
<Button className="hover:shadow-token-md active:scale-[0.98] transition-all">
  Start Scan
</Button>

<DropdownMenuContent className="animate-fade-in-down origin-top-left">
  {/* Menu items */}
</DropdownMenuContent>
```

### 6. Tabs (Dashboard/Report)

**Current:** Instant switch
**Enhanced:**
- Content: `fade-in` on tab change
- Indicator: Smooth slide with `transition-all`
- Hover: Subtle background

```tsx
<TabsContent className="animate-fade-in">
  {/* Tab content */}
</TabsContent>
```

### 7. Badges (Severity)

**Current:** Static colored badges
**Enhanced:**
- Critical: `critical-pulse` when active
- Count badges: `scale-in` on count change
- Hover: Brightness increase

```tsx
<Badge 
  variant="destructive" 
  className={cn(
    'transition-all hover:brightness-110',
    isCritical && 'animate-critical-pulse'
  )}
>
  Critical
</Badge>
```

### 8. Tooltips

**Current:** Default Radix animation
**Enhanced:**
- Entrance: `fade-in` + `scale-in`
- Quick delay: 200ms

```tsx
<TooltipContent className="animate-fade-in origin-[var(--radix-tooltip-content-transform-origin)]">
  {/* Tooltip content */}
</TooltipContent>
```

### 9. Empty State

**Current:** Static empty message
**Enhanced:**
- Icon: Gentle `bounce-subtle` loop
- Text: `fade-in-up` entrance

```tsx
<Empty className="animate-fade-in-up">
  <EmptyIcon className="animate-bounce-subtle" />
  <EmptyDescription>No vulnerabilities found</EmptyDescription>
</Empty>
```

### 10. Alerts

**Current:** Static alerts
**Enhanced:**
- Entrance: `slide-in-right`
- Error alerts: Brief shake
- Dismiss: `fade-out-down`

```tsx
<Alert className={cn(
  'animate-slide-in-right',
  variant === 'destructive' && 'animate-shake'
)}>
  {/* Alert content */}
</Alert>
```

---

## Glassmorphism Effects

### CSS Utilities (add to tokens.css)

```css
/* ============================================
   GLASSMORPHISM EFFECTS
   ============================================ */
body {
  /* Glass backgrounds */
  --glass-bg-light: rgba(255, 255, 255, 0.05);
  --glass-bg-medium: rgba(255, 255, 255, 0.1);
  --glass-bg-heavy: rgba(255, 255, 255, 0.15);
  
  /* Glass borders */
  --glass-border: rgba(255, 255, 255, 0.1);
  
  /* Glass shadows */
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* Utility classes */
.glass {
  background: var(--glass-bg-light);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
}

.glass-medium {
  background: var(--glass-bg-medium);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}

.glass-heavy {
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}
```

### Application

| Component | Glass Level | Usage |
|-----------|-------------|-------|
| ScanProgressOverlay | Heavy | Modal backdrop |
| Dropdowns | Medium | Elevated menus |
| Tooltips | Light | Subtle depth |
| Cards (hover) | Light | Elevated state |

---

## Implementation Phases

### Phase 1: Foundation (Priority: High)

1. **Update `tailwind.config.js`** with keyframes and animations
2. **Add glassmorphism tokens** to `tokens.css`
3. **Add `tailwindcss-animate` plugin** for additional utilities

```bash
npm install tailwindcss-animate
```

### Phase 2: Core Components (Priority: High)

1. **ScanProgressOverlay** - Glassmorphism + shimmer progress
2. **StatsCards** - Staggered entrance + hover effects
3. **Badge** - Severity pulses + hover brightness

### Phase 3: List & Interactions (Priority: Medium)

1. **FindingsList** - Staggered entrance + collapsible animations
2. **SecurityGateCompact** - Status change animations
3. **Header** - Button interactions + dropdown animations

### Phase 4: Polish (Priority: Low)

1. **Tabs** - Content transitions
2. **Tooltips** - Enhanced entrance
3. **Empty states** - Engaging animations
4. **Alerts** - Entrance/exit animations

---

## Shadcn Components Integration

### Available Components & Animation Recommendations

| Component | Animation | Notes |
|-----------|-----------|-------|
| `Badge` | `pulse-subtle`, hover brightness | Severity indicators |
| `Button` | Scale on hover/active | All interactive buttons |
| `Card` | `fade-in-up`, hover lift | Stats cards, finding cards |
| `Tabs` | Content `fade-in` | Dashboard/Report switching |
| `Progress` | `shimmer` on indeterminate | Scan progress |
| `DropdownMenu` | `fade-in-down` + `scale-in` | Scan scope, settings |
| `Collapsible` | `collapsible-down/up` | Finding details |
| `Tooltip` | `fade-in` + scale origin | All tooltips |
| `ScrollArea` | Native smooth scroll | Findings list |
| `Skeleton` | Built-in shimmer | Loading states |
| `Spinner` | `spin-slow` | Loading indicators |
| `Alert` | `slide-in-right`, shake on error | Notifications |
| `Input` | Focus ring animation | Search, filters |
| `Select` | Content `fade-in-down` | Filter/sort dropdowns |
| `Separator` | None needed | Static dividers |
| `Empty` | `fade-in-up`, icon bounce | Empty states |

### Custom Variants to Add

```tsx
// badge.tsx - Add animated variant
const badgeVariants = cva(
  "...",
  {
    variants: {
      // ... existing variants
      animated: {
        critical: "animate-critical-pulse",
        scanning: "animate-pulse-subtle",
      }
    }
  }
)

// button.tsx - Add interactive classes
const buttonVariants = cva(
  "... transition-all hover:scale-[1.02] active:scale-[0.98]",
  // ...
)
```

---

## Animation Delay Utilities

Add stagger support with custom utilities:

```css
/* In index.css or tokens.css */
.animation-delay-0 { animation-delay: 0ms; }
.animation-delay-50 { animation-delay: 50ms; }
.animation-delay-100 { animation-delay: 100ms; }
.animation-delay-150 { animation-delay: 150ms; }
.animation-delay-200 { animation-delay: 200ms; }
.animation-delay-300 { animation-delay: 300ms; }
.animation-delay-500 { animation-delay: 500ms; }

/* Fill mode for entrance animations */
.animation-fill-both { animation-fill-mode: both; }
.animation-fill-forwards { animation-fill-mode: forwards; }
```

---

## Performance Considerations

### Best Practices

1. **Use `transform` and `opacity`** only for animations (GPU-accelerated)
2. **Avoid animating** `width`, `height`, `margin`, `padding`
3. **Use `will-change`** sparingly for complex animations
4. **Prefer CSS animations** over JavaScript when possible
5. **Test with** Chrome DevTools Performance panel

### Reduced Motion Support

Already implemented in `tokens.css`:

```css
@media (prefers-reduced-motion: reduce) {
  body {
    --duration-instant: 0ms;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
    --duration-slower: 0ms;
  }
}
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `tailwind.config.js` | Add keyframes, animations, plugin |
| `tokens.css` | Add glassmorphism tokens, animation delays |
| `index.css` | Add utility classes |
| `components/ui/badge.tsx` | Add animated variants |
| `components/ui/button.tsx` | Add hover/active transitions |
| `components/StatsCards.tsx` | Staggered entrance, hover effects |
| `components/FindingsList.tsx` | Collapsible animations |
| `components/ScanProgressOverlay.tsx` | Glassmorphism, shimmer |
| `components/SecurityGateCompact.tsx` | Status animations |
| `components/Header.tsx` | Button interactions |

---

## References

- [Tailwind CSS Animate Plugin](https://github.com/jamiebuilds/tailwindcss-animate)
- [Framer Motion (optional for complex animations)](https://motion.dev)
- [Radix UI Animation](https://www.radix-ui.com/primitives)
- [2025 UI Trends Research](https://pixelmatters.com/blog/8-ui-design-trends-2025)

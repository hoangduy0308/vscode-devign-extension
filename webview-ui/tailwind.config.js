/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Spacing tokens mapping
      spacing: {
        'token-0': 'var(--space-0)',
        'token-1': 'var(--space-1)',
        'token-2': 'var(--space-2)',
        'token-3': 'var(--space-3)',
        'token-4': 'var(--space-4)',
        'token-5': 'var(--space-5)',
        'token-6': 'var(--space-6)',
        'token-8': 'var(--space-8)',
        'token-10': 'var(--space-10)',
        'token-12': 'var(--space-12)',
        'token-16': 'var(--space-16)',
        // Semantic spacing
        'inline-xs': 'var(--space-inline-xs)',
        'inline-sm': 'var(--space-inline-sm)',
        'inline-md': 'var(--space-inline-md)',
        'inline-lg': 'var(--space-inline-lg)',
        'stack-xs': 'var(--space-stack-xs)',
        'stack-sm': 'var(--space-stack-sm)',
        'stack-md': 'var(--space-stack-md)',
        'stack-lg': 'var(--space-stack-lg)',
        // Component spacing
        'card-padding': 'var(--space-card-padding)',
        'card-gap': 'var(--space-card-gap)',
        'section-gap': 'var(--space-section-gap)',
        'list-gap': 'var(--space-list-gap)',
      },

      // Typography tokens mapping
      fontFamily: {
        base: 'var(--font-family-base)',
        mono: 'var(--font-family-mono)',
      },
      fontSize: {
        'token-xs': 'var(--font-size-xs)',
        'token-sm': 'var(--font-size-sm)',
        'token-base': 'var(--font-size-base)',
        'token-md': 'var(--font-size-md)',
        'token-lg': 'var(--font-size-lg)',
        'token-xl': 'var(--font-size-xl)',
        'token-2xl': 'var(--font-size-2xl)',
        'token-3xl': 'var(--font-size-3xl)',
      },
      fontWeight: {
        'token-normal': 'var(--font-weight-normal)',
        'token-medium': 'var(--font-weight-medium)',
        'token-semibold': 'var(--font-weight-semibold)',
        'token-bold': 'var(--font-weight-bold)',
      },
      lineHeight: {
        'token-tight': 'var(--line-height-tight)',
        'token-base': 'var(--line-height-base)',
        'token-relaxed': 'var(--line-height-relaxed)',
        'token-loose': 'var(--line-height-loose)',
      },
      letterSpacing: {
        'token-tight': 'var(--letter-spacing-tight)',
        'token-normal': 'var(--letter-spacing-normal)',
        'token-wide': 'var(--letter-spacing-wide)',
        'token-wider': 'var(--letter-spacing-wider)',
      },

      // Color tokens mapping
      colors: {
        // Background colors
        'bg-primary': 'var(--color-bg-primary)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'bg-tertiary': 'var(--color-bg-tertiary)',
        'bg-elevated': 'var(--color-bg-elevated)',
        'bg-hover': 'var(--color-bg-hover)',
        'bg-active': 'var(--color-bg-active)',

        // Text colors
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'text-link': 'var(--color-text-link)',
        'text-link-hover': 'var(--color-text-link-hover)',

        // Border colors
        'border-default': 'var(--color-border-default)',
        'border-subtle': 'var(--color-border-subtle)',
        'border-focus': 'var(--color-border-focus)',

        // Interactive colors
        'interactive-primary': 'var(--color-interactive-primary)',
        'interactive-primary-hover': 'var(--color-interactive-primary-hover)',
        'interactive-secondary': 'var(--color-interactive-secondary)',
        'interactive-secondary-hover': 'var(--color-interactive-secondary-hover)',

        // Severity colors
        severity: {
          critical: {
            bg: 'var(--severity-critical-bg)',
            'bg-hover': 'var(--severity-critical-bg-hover)',
            border: 'var(--severity-critical-border)',
            text: 'var(--severity-critical-text)',
            icon: 'var(--severity-critical-icon)',
          },
          high: {
            bg: 'var(--severity-high-bg)',
            'bg-hover': 'var(--severity-high-bg-hover)',
            border: 'var(--severity-high-border)',
            text: 'var(--severity-high-text)',
            icon: 'var(--severity-high-icon)',
          },
          medium: {
            bg: 'var(--severity-medium-bg)',
            'bg-hover': 'var(--severity-medium-bg-hover)',
            border: 'var(--severity-medium-border)',
            text: 'var(--severity-medium-text)',
            icon: 'var(--severity-medium-icon)',
          },
          low: {
            bg: 'var(--severity-low-bg)',
            'bg-hover': 'var(--severity-low-bg-hover)',
            border: 'var(--severity-low-border)',
            text: 'var(--severity-low-text)',
            icon: 'var(--severity-low-icon)',
          },
          info: {
            bg: 'var(--severity-info-bg)',
            'bg-hover': 'var(--severity-info-bg-hover)',
            border: 'var(--severity-info-border)',
            text: 'var(--severity-info-text)',
            icon: 'var(--severity-info-icon)',
          },
          success: {
            bg: 'var(--severity-success-bg)',
            'bg-hover': 'var(--severity-success-bg-hover)',
            border: 'var(--severity-success-border)',
            text: 'var(--severity-success-text)',
            icon: 'var(--severity-success-icon)',
          },
        },
      },

      // Border radius tokens
      borderRadius: {
        'token-none': 'var(--radius-none)',
        'token-sm': 'var(--radius-sm)',
        'token-md': 'var(--radius-md)',
        'token-lg': 'var(--radius-lg)',
        'token-xl': 'var(--radius-xl)',
        'token-2xl': 'var(--radius-2xl)',
        'token-full': 'var(--radius-full)',
      },

      // Shadow tokens
      boxShadow: {
        'token-sm': 'var(--shadow-sm)',
        'token-md': 'var(--shadow-md)',
        'token-lg': 'var(--shadow-lg)',
        'token-xl': 'var(--shadow-xl)',
      },

      // Z-index tokens
      zIndex: {
        'token-base': 'var(--z-base)',
        'token-dropdown': 'var(--z-dropdown)',
        'token-sticky': 'var(--z-sticky)',
        'token-overlay': 'var(--z-overlay)',
        'token-modal': 'var(--z-modal)',
        'token-popover': 'var(--z-popover)',
        'token-tooltip': 'var(--z-tooltip)',
      },

      // Transition tokens
      transitionProperty: {
        'token-colors': 'color, background-color, border-color',
        'token-opacity': 'opacity',
        'token-transform': 'transform',
      },
      transitionDuration: {
        'token-instant': 'var(--duration-instant)',
        'token-fast': 'var(--duration-fast)',
        'token-normal': 'var(--duration-normal)',
        'token-slow': 'var(--duration-slow)',
        'token-slower': 'var(--duration-slower)',
      },
      transitionTimingFunction: {
        'token-linear': 'var(--ease-linear)',
        'token-in': 'var(--ease-in)',
        'token-out': 'var(--ease-out)',
        'token-in-out': 'var(--ease-in-out)',
        'token-bounce': 'var(--ease-bounce)',
      },
      // Animation Keyframes
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
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
}

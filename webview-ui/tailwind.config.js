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
    },
  },
  plugins: [],
}

/* Dynamic Tailwind compiler configuration mapping to Harmonica CSS variables */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface": "var(--color-surface)",
        "surface-dim": "var(--color-surface-dim)",
        "surface-bright": "var(--color-surface-bright)",
        "surface-container-lowest": "var(--color-surface-container-lowest)",
        "surface-container-low": "var(--color-surface-container-low)",
        "surface-container": "var(--color-surface-container)",
        "surface-container-high": "var(--color-surface-container-high)",
        "surface-container-highest": "var(--color-surface-container-highest)",
        "on-surface": "var(--color-on-surface)",
        "on-surface-variant": "var(--color-on-surface-variant)",
        "inverse-surface": "var(--color-inverse-surface)",
        "inverse-on-surface": "var(--color-inverse-on-surface)",
        "outline": "var(--color-outline)",
        "outline-variant": "var(--color-outline-variant)",
        "surface-tint": "var(--color-surface-tint)",
        
        "primary": "var(--color-primary)",
        "on-primary": "var(--color-on-primary)",
        "primary-container": "var(--color-primary-container)",
        "on-primary-container": "var(--color-on-primary-container)",
        "inverse-primary": "var(--color-inverse-primary)",
        
        "secondary": "var(--color-secondary)",
        "on-secondary": "var(--color-on-secondary)",
        "secondary-container": "var(--color-secondary-container)",
        "on-secondary-container": "var(--color-on-secondary-container)",
        
        "tertiary": "var(--color-tertiary)",
        "on-tertiary": "var(--color-on-tertiary)",
        "tertiary-container": "var(--color-tertiary-container)",
        "on-tertiary-container": "var(--color-on-tertiary-container)",
        
        "error": "var(--color-error)",
        "on-error": "var(--color-on-error)",
        "error-container": "var(--color-error-container)",
        "on-error-container": "var(--color-on-error-container)",
        
        "primary-fixed": "var(--color-primary-fixed)",
        "primary-fixed-dim": "var(--color-primary-fixed-dim)",
        "on-primary-fixed": "var(--color-on-primary-fixed)",
        "on-primary-fixed-variant": "var(--color-on-primary-fixed-variant)",
        
        "secondary-fixed": "var(--color-secondary-fixed)",
        "secondary-fixed-dim": "var(--color-secondary-fixed-dim)",
        "on-secondary-fixed": "var(--color-on-secondary-fixed)",
        "on-secondary-fixed-variant": "var(--color-on-secondary-fixed-variant)",
        
        "tertiary-fixed": "var(--color-tertiary-fixed)",
        "tertiary-fixed-dim": "var(--color-tertiary-fixed-dim)",
        "on-tertiary-fixed": "var(--color-on-tertiary-fixed)",
        "on-tertiary-fixed-variant": "var(--color-on-tertiary-fixed-variant)",
        
        "background": "var(--color-background)",
        "on-background": "var(--color-on-background)",
        "surface-variant": "var(--color-surface-variant)"
      },
      borderRadius: {
        "DEFAULT": "var(--rounded-default)",
        "lg": "var(--rounded-lg)",
        "xl": "var(--rounded-xl)",
        "full": "var(--rounded-full)"
      },
      spacing: {
        "unit": "var(--spacing-unit)",
        "gutter": "var(--spacing-gutter)",
        "margin-mobile": "var(--spacing-margin-mobile)",
        "margin-desktop": "var(--spacing-margin-desktop)",
        "sidebar-width": "var(--sidebar-width)",
        "inspector-width": "var(--inspector-width)"
      },
      fontSize: {
        "display-lg": ["2.25rem", { lineHeight: "2.75rem", letterSpacing: "-0.02em" }],
        "headline-md": ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-0.01em" }],
        "headline-sm": ["1.25rem", { lineHeight: "1.75rem" }],
        "body-md": ["0.95rem", { lineHeight: "1.5rem" }],
        "label-mono": ["0.8125rem", { lineHeight: "1.25rem" }],
        "label-caps": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.05em" }]
      },
      fontFamily: {
        "label-mono": ["var(--font-family-mono)", "monospace"],
        "headline-sm": ["var(--font-family-sans)", "sans-serif"],
        "headline-md": ["var(--font-family-sans)", "sans-serif"],
        "body-md": ["var(--font-family-sans)", "sans-serif"],
        "label-caps": ["var(--font-family-sans)", "sans-serif"],
        "display-lg": ["var(--font-family-sans)", "sans-serif"]
      }
    }
  }
};

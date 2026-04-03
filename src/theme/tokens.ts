/**
 * Design Tokens — Neurix Design System
 * Primary: #00F0FF (Electric Blue)
 * Secondary: #39FF14 (Neon Green)
 * Neutral: #0A0A0B (Near-black)
 */
export const tokens = {
  colors: {
    // === BRAND ===
    primary: "#00F0FF",
    secondary: "#39FF14",
    accent: "#00C8D4",
    electric: "#00F0FF",
    neon: "#39FF14",

    // Backgrounds
    background: {
      darkest: "#0A0A0B",
      darker: "#0D1117",
      dark: "#111827",
      light: "#1A2235",
    },

    // Text
    text: {
      primary: "#FFFFFF",
      secondary: "#A0AEC0",
      tertiary: "#718096",
      disabled: "#4A5568",
    },

    // Semantic
    success: "#39FF14",
    error: "#FF3B3B",
    warning: "#FFB800",
    info: "#00F0FF",

    // Status
    status: {
      pending: "#6B7280",
      running: "#00F0FF",
      completed: "#39FF14",
      failed: "#FF3B3B",
      timeout: "#FFB800",
    },

    // Surfaces
    surface: {
      base: "#111827",
      elevated: "#1A2235",
      overlay: "rgba(0, 240, 255, 0.04)",
      overlayHover: "rgba(0, 240, 255, 0.08)",
      overlayActive: "rgba(0, 240, 255, 0.12)",
      subtle: "rgba(255, 255, 255, 0.02)",
    },

    // Borders
    border: {
      default: "rgba(0, 240, 255, 0.12)",
      subtle: "rgba(0, 240, 255, 0.06)",
      hover: "rgba(0, 240, 255, 0.2)",
      focus: "#00F0FF",
      error: "#FF3B3B",
    },

    // Scrollbar
    scrollbar: {
      track: "transparent",
      thumb: "rgba(0, 240, 255, 0.2)",
      thumbHover: "rgba(0, 240, 255, 0.35)",
    },

    // Messages
    message: {
      user: "rgba(0, 240, 255, 0.08)",
      ai: "#111827",
      system: "#0D1117",
    },

    // Icons
    icon: {
      default: "#A0AEC0",
      muted: "#6B7280",
      active: "#00F0FF",
    },

    overlay: "rgba(0, 0, 0, 0.7)",
    backdrop: "rgba(10, 10, 11, 0.95)",
  },

  typography: {
    fontFamily: {
      primary: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      heading: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
      monospace: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
    "3xl": "4rem",
  },

  borderRadius: {
    sm: "2px",
    md: "4px",
    lg: "6px",
    xl: "8px",
    full: "9999px",
  },

  shadows: {
    none: "none",
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
    md: "0 4px 12px rgba(0, 0, 0, 0.4)",
    lg: "0 10px 30px rgba(0, 0, 0, 0.5)",
    xl: "0 20px 50px rgba(0, 0, 0, 0.6)",
    card: "0 4px 20px rgba(0, 0, 0, 0.5)",
    glow: {
      primary: "0 0 20px rgba(0, 240, 255, 0.35)",
      secondary: "0 0 20px rgba(57, 255, 20, 0.35)",
      accent: "0 0 20px rgba(0, 200, 212, 0.35)",
    },
  },

  transitions: {
    fast: "150ms ease-in-out",
    normal: "250ms ease-in-out",
    slow: "350ms ease-in-out",
  },

  animation: {
    duration: { micro: "150ms", short: "200ms", medium: "300ms", long: "500ms" },
    easing: {
      enter: "cubic-bezier(0.4, 0, 0.2, 1)",
      exit: "cubic-bezier(0.4, 0, 1, 1)",
      smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
    },
  },

  zIndex: {
    base: 0,
    dropdown: 1000,
    overlay: 1100,
    modal: 1200,
    popover: 1300,
    tooltip: 1400,
    toast: 1500,
  },

  breakpoints: {
    mobile: 640,
    tablet: 1024,
    desktop: 1280,
  },
} as const;

export type Tokens = typeof tokens;

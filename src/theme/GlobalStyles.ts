import { createGlobalStyle } from "styled-components";
import { tokens } from "./tokens";

export const GlobalStyles = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  /* ==== CUSTOM FONTS ====
     Drop .ttf/.woff2 into public/assets/fonts/ then uncomment:

  @font-face {
    font-family: 'AppFont';
    src: url('/assets/fonts/AppFont-Regular.ttf') format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  */

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent !important;
  }

  a, button, input, select, textarea, label,
  [role="button"], [role="link"], [role="tab"],
  [tabindex]:not([tabindex="-1"]) {
    -webkit-tap-highlight-color: transparent !important;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }

  button {
    user-select: none;
    -webkit-user-select: none;
  }

  html, body, #root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    touch-action: pan-x pan-y;
  }

  body {
    font-family: ${tokens.typography.fontFamily.primary};
    font-size: ${tokens.typography.fontSize.base};
    line-height: ${tokens.typography.lineHeight.normal};
    color: ${tokens.colors.text.primary};
    background: ${tokens.colors.background.darkest};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow: hidden;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${tokens.typography.fontFamily.heading};
  }

  html { scroll-behavior: smooth; }

  :focus-visible {
    outline: 2px solid ${tokens.colors.primary};
    outline-offset: 2px;
  }

  ::selection {
    background: ${tokens.colors.primary};
    color: ${tokens.colors.background.darkest};
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: ${tokens.colors.border.default};
    border-radius: ${tokens.borderRadius.full};
  }
  ::-webkit-scrollbar-thumb:hover { background: ${tokens.colors.border.hover}; }
`;

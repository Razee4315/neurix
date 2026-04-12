import { createGlobalStyle } from "styled-components";
import { tokens } from "./tokens";

export const GlobalStyles = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }

  a, button, input, select, textarea, label,
  [role="button"], [role="link"], [role="tab"],
  [tabindex]:not([tabindex="-1"]) {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }

  html, body, #root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  body {
    font-family: ${tokens.typography.fontFamily.body};
    font-size: ${tokens.typography.fontSize.base};
    line-height: ${tokens.typography.lineHeight.normal};
    color: ${tokens.colors.onSurface};
    background: ${tokens.colors.background};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${tokens.typography.fontFamily.headline};
  }

  ::selection {
    background: ${tokens.colors.primary};
    color: ${tokens.colors.onPrimary};
  }

  :focus-visible {
    outline: 2px solid ${tokens.colors.primary};
    outline-offset: 2px;
  }

  .material-symbols-outlined {
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: ${tokens.colors.surfaceContainerHighest};
    border-radius: 10px;
  }

  input:not([disabled]),
  textarea:not([disabled]) {
    cursor: text;
    user-select: text;
    -webkit-user-select: text;
  }
`;

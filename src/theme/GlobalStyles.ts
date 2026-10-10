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
    background: ${tokens.surfaces.page};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* The theme's surface texture (paper grain, scanlines) lies over the
     whole interface, dialogs included. It never takes input. */
  body::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 2000;
    pointer-events: none;
    background: var(--overlay, none);
    opacity: var(--overlay-opacity, 0);
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${tokens.typography.fontFamily.headline};
    letter-spacing: var(--headline-tracking, 0);
  }

  button, input, select, textarea {
    font-family: ${tokens.typography.fontFamily.label};
  }

  /* Per-theme character that variables alone cannot express. */

  /* Paper: set like a book. Headings in a lighter weight, links underlined. */
  html[data-theme="paper"] h1,
  html[data-theme="paper"] h2,
  html[data-theme="paper"] h3 {
    font-weight: 600;
  }
  html[data-theme="paper"] a { text-decoration: underline; text-underline-offset: 2px; }

  /* Phosphor: selected text inverts, as on a terminal. */
  html[data-theme="phosphor"] ::selection {
    background: rgb(var(--c-primary));
    color: rgb(var(--c-background));
  }

  ::selection {
    background: ${tokens.colors.primary};
    color: ${tokens.colors.onPrimary};
  }

  :focus-visible {
    outline: 2px solid ${tokens.colors.primary};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
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

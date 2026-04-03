import { tokens } from "./tokens";

export const theme = {
  name: "dark",
  ...tokens,
  colors: {
    ...tokens.colors,
    primary: tokens.colors.primary,
    secondary: tokens.colors.secondary,
    surface: tokens.colors.background.dark,
    surfaceHover: tokens.colors.background.light,
    textPrimary: tokens.colors.text.primary,
    textSecondary: tokens.colors.text.secondary,
    textTertiary: tokens.colors.text.tertiary,
    textDisabled: tokens.colors.text.disabled,
    borderDefault: tokens.colors.border.default,
    borderFocus: tokens.colors.border.focus,
  },
};

export type Theme = typeof theme;

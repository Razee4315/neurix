import { tokens } from "./tokens";

export const theme = {
	...tokens,
} as const;

export type Theme = typeof theme;

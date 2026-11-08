import { tokens } from "@/theme/tokens";
import { isMac, isMobile } from "@/utils/platform";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import styled from "styled-components";

/**
 * The desktop window's controls, drawn by the app. The window has no native
 * frame (`decorations: false`), and no separate title bar either: the app's
 * own top row is the title bar. The sidebar header and each page's top bar
 * carry `data-tauri-drag-region`, so they move the window and maximize it on
 * a double-click, and these buttons sit at the right end of that row.
 *
 * Two CSS variables tell the layout what to leave room for:
 *  - `--window-controls-w`: the buttons' width, kept clear at the right;
 *  - `--window-inset-left`: macOS's traffic lights, kept clear at the left
 *    (macOS keeps its own buttons, see tauri.macos.conf.json).
 * Phones have no window to manage: no buttons and no variables.
 */

const BUTTON_W = 46;
const CONTROLS_W = BUTTON_W * 3;
const MAC_LIGHTS_W = 72;

const Controls = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  /* Above every dialog and toast, so the window can always be closed, but
     under the theme's texture (z-index 2000 in GlobalStyles). */
  z-index: 1500;
  display: flex;
  user-select: none;
  -webkit-user-select: none;
`;

/* As tall as the page's top row, so the glyphs line up with its title. */
const Control = styled.button<{ $close?: boolean }>`
  width: ${BUTTON_W}px;
  height: 52px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 0;
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  cursor: default;
  transition: background 0.12s ease, color 0.12s ease;

  @media (min-width: ${tokens.breakpoints.wide}) {
    height: 48px;
  }

  svg {
    width: 10px;
    height: 10px;
    overflow: visible;
  }

  &:hover {
    background: ${({ $close }) => ($close ? "#c42b1c" : tokens.colors.surfaceContainerHigh)};
    color: ${({ $close }) => ($close ? "#ffffff" : tokens.colors.onSurface)};
  }

  &:active {
    background: ${({ $close }) => ($close ? "#a82618" : tokens.colors.surfaceContainerHighest)};
  }

  &:focus-visible {
    outline: 2px solid ${tokens.colors.primary};
    outline-offset: -2px;
  }
`;

/* Hairline glyphs, drawn to the pixel grid like the system's own. */
const MinimizeGlyph = () => (
	<svg viewBox="0 0 10 10" aria-hidden="true">
		<path d="M0 5.5h10" stroke="currentColor" strokeWidth="1" />
	</svg>
);

const MaximizeGlyph = () => (
	<svg viewBox="0 0 10 10" aria-hidden="true">
		<rect x="0.5" y="0.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
	</svg>
);

const RestoreGlyph = () => (
	<svg viewBox="0 0 10 10" aria-hidden="true">
		<rect x="0.5" y="2.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1" />
		<path
			d="M2.5 2.5V1.8c0-.7.6-1.3 1.3-1.3h4.4c.7 0 1.3.6 1.3 1.3v4.4c0 .7-.6 1.3-1.3 1.3h-.7"
			fill="none"
			stroke="currentColor"
			strokeWidth="1"
		/>
	</svg>
);

const CloseGlyph = () => (
	<svg viewBox="0 0 10 10" aria-hidden="true">
		<path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
	</svg>
);

/** The app window, or null where there is none (tests). */
function appWindow(): Window | null {
	try {
		return getCurrentWindow();
	} catch {
		return null;
	}
}

/** Whether this is the desktop app, which manages its own window frame. */
function isDesktopApp(): boolean {
	return "__TAURI_INTERNALS__" in window && !isMobile();
}

export function TitleBar() {
	const [desktop] = useState(isDesktopApp);
	const [maximized, setMaximized] = useState(false);
	const mac = isMac();

	useEffect(() => {
		if (!desktop) return;
		const root = document.documentElement;
		const name = mac ? "--window-inset-left" : "--window-controls-w";
		root.style.setProperty(name, `${mac ? MAC_LIGHTS_W : CONTROLS_W}px`);
		return () => {
			root.style.removeProperty(name);
		};
	}, [desktop, mac]);

	useEffect(() => {
		const win = desktop && !mac ? appWindow() : null;
		if (!win) return;
		let stop: (() => void) | undefined;
		let gone = false;
		const sync = () => win.isMaximized().then(setMaximized).catch(() => {});
		sync();
		win.onResized(sync)
			.then((unlisten) => {
				if (gone) unlisten();
				else stop = unlisten;
			})
			.catch(() => {});
		return () => {
			gone = true;
			stop?.();
		};
	}, [desktop, mac]);

	if (!desktop || mac) return null;

	const act = (fn: (w: Window) => Promise<void>) => () => {
		const win = appWindow();
		if (win) fn(win).catch(() => {});
	};

	return (
		<Controls>
			<Control type="button" aria-label="Minimize" title="Minimize" onClick={act((w) => w.minimize())}>
				<MinimizeGlyph />
			</Control>
			<Control
				type="button"
				aria-label={maximized ? "Restore" : "Maximize"}
				title={maximized ? "Restore" : "Maximize"}
				onClick={act((w) => w.toggleMaximize())}
			>
				{maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
			</Control>
			<Control type="button" $close aria-label="Close" title="Close" onClick={act((w) => w.close())}>
				<CloseGlyph />
			</Control>
		</Controls>
	);
}

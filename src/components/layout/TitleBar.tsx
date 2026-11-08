import { tokens } from "@/theme/tokens";
import { isMac, isMobile } from "@/utils/platform";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import styled from "styled-components";

/**
 * The desktop window's own title bar, drawn by the app so it matches the
 * interface instead of the system's. The window has no native frame
 * (`decorations: false`), so this bar is what moves it (drag), maximizes it
 * (double-click) and holds the minimize, maximize and close buttons.
 *
 * macOS keeps its own traffic lights over the bar (see
 * tauri.macos.conf.json), so there the bar only leaves room for them.
 * Phones have no window to manage and get no bar.
 */

const HEIGHT = 34;

const Bar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: ${HEIGHT}px;
  /* Above every dialog and toast, so the window can always be moved and
     closed, but under the theme's texture (z-index 2000 in GlobalStyles),
     so the bar is grained and tinted like the rest of the window. */
  z-index: 1500;
  display: flex;
  align-items: stretch;
  user-select: none;
  -webkit-user-select: none;
  background: transparent;
`;

/* Continues the sidebar's colour up into the bar, so the two read as one
   column on wide windows. */
const SidebarCap = styled.div`
  display: none;

  @media (min-width: ${tokens.breakpoints.wide}) {
    display: block;
    width: 264px;
    flex-shrink: 0;
    background: ${tokens.colors.surfaceContainerLow};
  }
`;

const Drag = styled.div`
  flex: 1;
  min-width: 0;
`;

const Controls = styled.div`
  display: flex;
  flex-shrink: 0;
`;

const Control = styled.button<{ $close?: boolean }>`
  width: 46px;
  height: ${HEIGHT}px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 0;
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  cursor: default;
  transition: background 0.12s ease, color 0.12s ease;

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
		<path d="M2.5 2.5V1.8c0-.7.6-1.3 1.3-1.3h4.4c.7 0 1.3.6 1.3 1.3v4.4c0 .7-.6 1.3-1.3 1.3h-.7" fill="none" stroke="currentColor" strokeWidth="1" />
	</svg>
);

const CloseGlyph = () => (
	<svg viewBox="0 0 10 10" aria-hidden="true">
		<path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
	</svg>
);

/** The app window, or null where there is none (browser preview, tests). */
function appWindow(): Window | null {
	try {
		return getCurrentWindow();
	} catch {
		return null;
	}
}

/** Whether this is the desktop app, which draws its own title bar. */
function hasCustomTitleBar(): boolean {
	return "__TAURI_INTERNALS__" in window && !isMobile();
}

export function TitleBar() {
	const [shown] = useState(hasCustomTitleBar);
	const [maximized, setMaximized] = useState(false);
	const mac = isMac();

	// The rest of the interface sizes itself to the window minus this bar.
	useEffect(() => {
		if (!shown) return;
		const root = document.documentElement;
		root.style.setProperty("--titlebar-h", `${HEIGHT}px`);
		return () => {
			root.style.removeProperty("--titlebar-h");
		};
	}, [shown]);

	useEffect(() => {
		const win = shown && !mac ? appWindow() : null;
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
	}, [shown, mac]);

	if (!shown) return null;

	const act = (fn: (w: Window) => Promise<void>) => () => {
		const win = appWindow();
		if (win) fn(win).catch(() => {});
	};

	return (
		<Bar data-tauri-drag-region>
			<SidebarCap data-tauri-drag-region />
			<Drag data-tauri-drag-region />
			{!mac && (
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
			)}
		</Bar>
	);
}

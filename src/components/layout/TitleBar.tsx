import { Icon } from "@/components/ui/Icon";
import { useAppContext } from "@/context/AppContext";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { isMac, isMobile } from "@/utils/platform";
import { type Window, getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";

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

/* As tall as the page's top row (52px narrow, 40px on desktop), so the
   glyphs line up with its title. Square hover fills edge to edge, as in
   Windows 11's own caption buttons. */
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
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};

  @media (min-width: ${tokens.breakpoints.wide}) {
    height: 40px;
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

/* ── Engine status chip, for the top bar on desktop ── */

const breathe = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;

const Chip = styled.span<{ $warming: boolean }>`
  display: none;
  align-items: center;
  gap: 0.375rem;
  height: 24px;
  max-width: 16rem;
  padding: 0 0.5rem;
  border: 1px solid
    ${({ $warming }) => ($warming ? alpha(tokens.colors.secondary, "55") : tokens.colors.outlineVariant)};
  border-radius: ${tokens.borderRadius.circle};
  background: ${tokens.colors.surfaceContainerLow};
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize["2xs"]};
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;

  @media (min-width: ${tokens.breakpoints.wide}) {
    display: inline-flex;
  }

  > i {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $warming }) => ($warming ? tokens.colors.secondary : tokens.colors.primary)};
    animation: ${({ $warming }) => ($warming ? breathe : "none")} 1.4s ease-in-out infinite;
  }

  > span { overflow: hidden; text-overflow: ellipsis; }

  > b {
    font-family: ${tokens.typography.fontFamily.mono};
    font-weight: 500;
    color: ${tokens.colors.secondary};
  }
`;

/**
 * A quiet pill showing what the engine is doing: brass and breathing while a
 * model warms up, a teal dot with its KV precision once it is ready. Hidden
 * when nothing is loaded, and on phones (the chat header says it there).
 */
export function EngineStatusChip() {
	const { modelStatus, settings } = useAppContext();
	if (modelStatus.kind === "idle") return null;
	const warming = modelStatus.kind === "loading";
	const quant = warming ? undefined : modelStatus.model.kv_cache_quant?.toUpperCase();
	const airGap = settings?.air_gap === true;
	return (
		<Chip $warming={warming} role="status" aria-live="polite" data-tauri-drag-region>
			<i />
			<span>{warming ? "Warming up model..." : "Local engine ready"}</span>
			{quant && <b>{quant}</b>}
			{airGap && <Icon name="shield" size={11} />}
		</Chip>
	);
}

import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { saveFileAs } from "@/services/fileService";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { copyText, isMobile } from "@/utils/platform";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";

/* A look at a page the model wrote, in a drawer beside the chat (a full
   sheet on a phone). The frame may run the page's scripts, but it is
   sandboxed without same-origin, so nothing in it can reach the app, its
   storage or the device. Saving it and opening it in a browser shows it
   with nothing held back. */

const slideIn = keyframes`
  from { transform: translateX(24px); opacity: 0; }
  to { transform: none; opacity: 1; }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${tokens.zIndex.overlay};
  display: flex;
  justify-content: flex-end;
  background: rgb(0 0 0 / 0.45);

  @media (max-width: 600px) { background: rgb(0 0 0 / 0.6); }
`;

const Drawer = styled.div`
  display: flex;
  flex-direction: column;
  width: min(52rem, 58vw);
  min-width: min(28rem, 100vw);
  height: 100%;
  background: ${tokens.colors.surfaceContainer};
  border-left: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  animation: ${slideIn} 240ms cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 900px) { width: 100%; min-width: 0; border-left: none; }
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Top = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 48px;
  padding: calc(env(safe-area-inset-top, 0px) + 0.375rem) 0.5rem 0.375rem 1rem;
  border-bottom: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurface};

  strong {
    font-weight: ${tokens.typography.fontWeight.semibold};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
`;

const Grow = styled.span`
  flex: 1;
  min-width: 0.5rem;
`;

const Segment = styled.div`
  display: inline-flex;
  flex-shrink: 0;
  padding: 2px;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerLowest};
`;

const SegmentBtn = styled.button<{ $on: boolean }>`
  height: 28px;
  padding: 0 0.625rem;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  background: ${({ $on }) => ($on ? tokens.colors.surfaceContainerHighest : "transparent")};
  color: ${({ $on }) => ($on ? tokens.colors.onSurface : tokens.colors.onSurfaceVariant)};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};
`;

const ToolBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  flex-shrink: 0;
  height: 32px;
  min-width: 32px;
  padding: 0 0.5rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.xs};
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; color: ${tokens.colors.onSurface}; }

  @media (max-width: 480px) { > span { display: none; } }
`;

const Note = styled.div`
  padding: 0.375rem 1rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  background: ${tokens.colors.surfaceContainerLow};
`;

const Frame = styled.iframe`
  flex: 1;
  width: 100%;
  border: none;
  background: #ffffff;
`;

const Source = styled.pre`
  flex: 1;
  margin: 0;
  padding: 0.875rem 1rem;
  overflow: auto;
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: 0.8rem;
  line-height: 1.55;
  color: ${tokens.colors.onSurface};
  background: ${tokens.colors.surfaceContainerLowest};
  white-space: pre;
`;

function fileNameFor(title: string): string {
	const base = title.trim().replace(/[\\/:*?"<>|]+/g, "-");
	if (!base || base === "Page preview") return "page.html";
	return /\.html?$/i.test(base) ? base : `${base}.html`;
}

export function HtmlPreview({ title, html, onClose }: { title: string; html: string; onClose: () => void }) {
	const { showToast } = useToast();
	const [view, setView] = useState<"preview" | "source">("preview");
	const closeRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		closeRef.current?.focus();
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	const copy = async () => {
		if (await copyText(html)) showToast("Page copied", "success");
		else showToast("Couldn't copy to the clipboard", "error");
	};

	const save = async () => {
		try {
			const path = await saveFileAs(fileNameFor(title), html);
			if (path) showToast(`Saved to ${path}`, "success");
		} catch (err) {
			showToast(err instanceof Error ? err.message : String(err), "error");
		}
	};

	return createPortal(
		<Backdrop onClick={onClose}>
			<Drawer role="dialog" aria-modal="true" aria-label={`Preview of ${title}`} onClick={(e) => e.stopPropagation()}>
				<Top>
					<strong>{title}</strong>
					<Grow />
					<Segment role="group" aria-label="Show">
						<SegmentBtn type="button" $on={view === "preview"} aria-pressed={view === "preview"} onClick={() => setView("preview")}>
							Preview
						</SegmentBtn>
						<SegmentBtn type="button" $on={view === "source"} aria-pressed={view === "source"} onClick={() => setView("source")}>
							Source
						</SegmentBtn>
					</Segment>
					<ToolBtn type="button" onClick={copy} aria-label="Copy page source" title="Copy">
						<Icon name="content_copy" size={15} />
						<span>Copy</span>
					</ToolBtn>
					{!isMobile() && (
						<ToolBtn type="button" onClick={save} aria-label="Save page as a file" title="Save">
							<Icon name="download" size={15} />
							<span>Save</span>
						</ToolBtn>
					)}
					<ToolBtn ref={closeRef} type="button" aria-label="Close preview" title="Close" onClick={onClose}>
						<Icon name="close" size={16} />
					</ToolBtn>
				</Top>
				{view === "preview" ? (
					<>
						<Note>Sandboxed: the page runs on its own and can't reach Neurix or your files.</Note>
						<Frame title={title} sandbox="allow-scripts" srcDoc={html} />
					</>
				) : (
					<Source>{html}</Source>
				)}
			</Drawer>
		</Backdrop>,
		document.body,
	);
}

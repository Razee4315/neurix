import { Icon } from "@/components/ui/Icon";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";

/* A look at a page the model wrote. The frame is fully sandboxed, so what a
   model produced can't run scripts or reach the app. Saving it and opening it
   in a browser shows it working. */

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${tokens.zIndex.overlay};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgb(0 0 0 / 0.6);

  @media (max-width: 600px) { padding: 0; }
`;

const Sheet = styled.div`
  display: flex;
  flex-direction: column;
  width: min(60rem, 100%);
  height: min(44rem, 100%);
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.xl};
  overflow: hidden;
`;

const Top = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurface};

  strong {
    font-weight: ${tokens.typography.fontWeight.semibold};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    margin-right: auto;
    font-size: ${tokens.typography.fontSize.xs};
    color: ${tokens.colors.onSurfaceVariant};
    flex-shrink: 0;
  }
`;

const Close = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; color: ${tokens.colors.onSurface}; }
`;

const Frame = styled.iframe`
  flex: 1;
  width: 100%;
  border: none;
  background: #ffffff;
`;

export function HtmlPreview({ title, html, onClose }: { title: string; html: string; onClose: () => void }) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	return createPortal(
		<Backdrop onClick={onClose}>
			<Sheet role="dialog" aria-label={`Preview of ${title}`} onClick={(e) => e.stopPropagation()}>
				<Top>
					<strong>{title}</strong>
					<span>Preview, scripts off</span>
					<Close type="button" aria-label="Close preview" onClick={onClose}>
						<Icon name="close" size={16} />
					</Close>
				</Top>
				<Frame title={title} sandbox="" srcDoc={html} />
			</Sheet>
		</Backdrop>,
		document.body,
	);
}

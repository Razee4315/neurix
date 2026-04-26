import { tokens } from "@/theme/tokens";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";

/* ── Styles ── */

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.6);
  animation: ${fadeIn} 0.15s ease-out;
`;

const Dialog = styled.div`
  width: 100%;
  max-width: 320px;
  background: ${tokens.colors.surfaceContainerHigh};
  border-radius: ${tokens.borderRadius.xl};
  overflow: hidden;
  animation: ${slideUp} 0.2s ease-out;
`;

const Body = styled.div`
  padding: 1.5rem 1.25rem 1rem;
`;

const DialogTitle = styled.h3`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.lg};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin-bottom: 0.5rem;
`;

const DialogMessage = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem 1.25rem;
`;

const Btn = styled.button<{ $danger?: boolean; $primary?: boolean }>`
  padding: 0.625rem 1.125rem;
  min-height: 40px;
  border-radius: ${tokens.borderRadius.md};
  border: none;
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, transform ${tokens.transitions.fast}, filter 80ms ease-out;
  /* Disable browser default tap highlight; we provide our own feedback */
  -webkit-tap-highlight-color: transparent;

  background: ${({ $danger, $primary }) =>
		$danger
			? tokens.colors.error
			: $primary
				? tokens.colors.primary
				: tokens.colors.surfaceContainerHighest};
  color: ${({ $danger, $primary }) =>
		$danger
			? "#fff"
			: $primary
				? tokens.colors.onPrimary
				: tokens.colors.onSurface};

  &:hover { filter: brightness(1.05); }

  /* Stronger press feedback than scale alone — darken + slight scale.
     Easy to feel on a finger tap, where transform: scale(0.96) was subtle. */
  &:active {
    transform: scale(0.94);
    filter: brightness(0.85);
  }

  &:focus-visible {
    outline: 2px solid ${tokens.colors.primary};
    outline-offset: 2px;
  }
`;

/* ── Context ── */

interface DialogOptions {
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
}

type ShowConfirm = (options: DialogOptions) => Promise<boolean>;
type ShowAlert = (title: string, message: string) => Promise<void>;

const ConfirmContext = createContext<{ showConfirm: ShowConfirm; showAlert: ShowAlert }>({
	showConfirm: () => Promise.resolve(false),
	showAlert: () => Promise.resolve(),
});

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
	const [dialog, setDialog] = useState<(DialogOptions & { resolve: (v: boolean) => void }) | null>(null);
	const previouslyFocused = useRef<HTMLElement | null>(null);
	const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

	const showConfirm = useCallback((options: DialogOptions): Promise<boolean> => {
		return new Promise((resolve) => {
			previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
			setDialog({ ...options, resolve });
		});
	}, []);

	const showAlert = useCallback((title: string, message: string): Promise<void> => {
		return new Promise((resolve) => {
			previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
			setDialog({
				title,
				message,
				confirmLabel: "OK",
				cancelLabel: undefined,
				danger: false,
				resolve: () => resolve(),
			});
		});
	}, []);

	const closeDialog = useCallback(() => {
		setDialog(null);
		// Restore focus to the trigger element so keyboard users don't get stranded.
		queueMicrotask(() => {
			previouslyFocused.current?.focus();
			previouslyFocused.current = null;
		});
	}, []);

	const handleConfirm = useCallback(() => {
		dialog?.resolve(true);
		closeDialog();
	}, [dialog, closeDialog]);

	const handleCancel = useCallback(() => {
		dialog?.resolve(false);
		closeDialog();
	}, [dialog, closeDialog]);

	// Move focus to primary action when dialog opens.
	useEffect(() => {
		if (dialog) confirmBtnRef.current?.focus();
	}, [dialog]);

	// Escape closes (= cancel for confirm, = OK for alert).
	useEffect(() => {
		if (!dialog) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				if (dialog.cancelLabel !== undefined) handleCancel();
				else handleConfirm();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [dialog, handleCancel, handleConfirm]);

	return (
		<ConfirmContext.Provider value={{ showConfirm, showAlert }}>
			{children}
			{dialog && (
				<Overlay onClick={handleCancel}>
					<Dialog
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="confirm-title"
						aria-describedby="confirm-message"
						onClick={(e) => e.stopPropagation()}
					>
						<Body>
							<DialogTitle id="confirm-title">{dialog.title}</DialogTitle>
							<DialogMessage id="confirm-message">{dialog.message}</DialogMessage>
						</Body>
						<Actions>
							{dialog.cancelLabel !== undefined ? (
								<>
									<Btn onClick={handleCancel}>{dialog.cancelLabel || "Cancel"}</Btn>
									<Btn
										ref={confirmBtnRef}
										$danger={dialog.danger}
										$primary={!dialog.danger}
										onClick={handleConfirm}
									>
										{dialog.confirmLabel || "Confirm"}
									</Btn>
								</>
							) : (
								<Btn ref={confirmBtnRef} $primary onClick={handleConfirm}>
									{dialog.confirmLabel || "OK"}
								</Btn>
							)}
						</Actions>
					</Dialog>
				</Overlay>
			)}
		</ConfirmContext.Provider>
	);
}

export function useConfirm() {
	return useContext(ConfirmContext);
}

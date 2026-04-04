import { tokens } from "@/theme/tokens";
import { createContext, useCallback, useContext, useState } from "react";
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
  padding: 0.5rem 1rem;
  border-radius: ${tokens.borderRadius.md};
  border: none;
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  transition: all ${tokens.transitions.fast};

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

  &:active { transform: scale(0.96); }
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

	const showConfirm = useCallback((options: DialogOptions): Promise<boolean> => {
		return new Promise((resolve) => {
			setDialog({ ...options, resolve });
		});
	}, []);

	const showAlert = useCallback((title: string, message: string): Promise<void> => {
		return new Promise((resolve) => {
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

	const handleConfirm = () => {
		dialog?.resolve(true);
		setDialog(null);
	};

	const handleCancel = () => {
		dialog?.resolve(false);
		setDialog(null);
	};

	return (
		<ConfirmContext.Provider value={{ showConfirm, showAlert }}>
			{children}
			{dialog && (
				<Overlay onClick={handleCancel}>
					<Dialog onClick={(e) => e.stopPropagation()}>
						<Body>
							<DialogTitle>{dialog.title}</DialogTitle>
							<DialogMessage>{dialog.message}</DialogMessage>
						</Body>
						<Actions>
							{dialog.cancelLabel !== undefined ? (
								<>
									<Btn onClick={handleCancel}>{dialog.cancelLabel || "Cancel"}</Btn>
									<Btn $danger={dialog.danger} $primary={!dialog.danger} onClick={handleConfirm}>
										{dialog.confirmLabel || "Confirm"}
									</Btn>
								</>
							) : (
								<Btn $primary onClick={handleConfirm}>{dialog.confirmLabel || "OK"}</Btn>
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

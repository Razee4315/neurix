import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/theme/tokens";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";

/* ── Types ── */

type ToastVariant = "success" | "error" | "info";

interface ToastAction {
	label: string;
	onAction: () => void;
}

interface ToastData {
	id: number;
	message: string;
	variant: ToastVariant;
	action?: ToastAction;
}

interface ToastContextValue {
	/**
	 * Show a transient message. Pass `action` for an inline button such as
	 * "Undo"; toasts with an action stay up longer so it can be reached.
	 */
	showToast: (message: string, variant?: ToastVariant, action?: ToastAction) => void;
}

const DURATION_MS = 2500;
const DURATION_WITH_ACTION_MS = 6000;
const EXIT_MS = 250;

/* ── Animations ── */

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const slideOut = keyframes`
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(-10px) scale(0.96); }
`;

/* ── Styles ── */

const ToastContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: ${tokens.zIndex.toast};
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  padding: 0.75rem 1rem;
  padding-top: max(0.75rem, env(safe-area-inset-top, 0px));
  gap: 0.5rem;
`;

const VARIANT_COLORS: Record<ToastVariant, { accent: string; icon: string }> = {
	success: { accent: tokens.colors.secondary, icon: "check_circle" },
	error: { accent: tokens.colors.error, icon: "error" },
	info: { accent: tokens.colors.primary, icon: "info" },
};

const ToastItem = styled.div<{ $variant: ToastVariant; $exiting: boolean }>`
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: ${tokens.borderRadius.xl};
  background: ${tokens.colors.surfaceContainerHighest};
  border: 1px solid ${tokens.colors.outlineVariant};
  border-left: 3px solid ${({ $variant }) => VARIANT_COLORS[$variant].accent};
  box-shadow: ${tokens.shadows.elevated};
  max-width: 24rem;
  width: 100%;
  animation: ${({ $exiting }) => ($exiting ? slideOut : slideIn)} 0.25s ease-out forwards;
`;

const ToastMessage = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
  line-height: ${tokens.typography.lineHeight.snug};
  flex: 1;
  min-width: 0;
`;

const ActionBtn = styled.button`
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: ${tokens.colors.primary};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  padding: 0.375rem 0.5rem;
  border-radius: ${tokens.borderRadius.lg};
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceBright}; }
`;

/* ── Context ── */

const ToastContext = createContext<ToastContextValue>({
	showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<(ToastData & { exiting: boolean })[]>([]);
	const idRef = useRef(0);

	const dismiss = useCallback((id: number) => {
		setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, EXIT_MS);
	}, []);

	const showToast = useCallback(
		(message: string, variant: ToastVariant = "info", action?: ToastAction) => {
			const id = ++idRef.current;
			setToasts((prev) => {
				// Keep max 3 toasts visible
				const visible = prev.length >= 3 ? prev.slice(1) : prev;
				return [...visible, { id, message, variant, action, exiting: false }];
			});
			setTimeout(() => dismiss(id), action ? DURATION_WITH_ACTION_MS : DURATION_MS);
		},
		[dismiss],
	);

	const value = useMemo(() => ({ showToast }), [showToast]);

	return (
		<ToastContext.Provider value={value}>
			{children}
			{/* Always mounted so screen readers register the live region before
			    the first message arrives. */}
			<ToastContainer role="status" aria-live="polite">
				{toasts.map((toast) => (
					<ToastItem key={toast.id} $variant={toast.variant} $exiting={toast.exiting}>
						<Icon
							name={VARIANT_COLORS[toast.variant].icon}
							size={20}
							fill
							color={VARIANT_COLORS[toast.variant].accent}
						/>
						<ToastMessage>{toast.message}</ToastMessage>
						{toast.action && (
							<ActionBtn
								type="button"
								onClick={() => {
									toast.action?.onAction();
									dismiss(toast.id);
								}}
							>
								{toast.action.label}
							</ActionBtn>
						)}
					</ToastItem>
				))}
			</ToastContainer>
		</ToastContext.Provider>
	);
}

export function useToast() {
	return useContext(ToastContext);
}

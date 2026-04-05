import { tokens } from "@/theme/tokens";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";

/* ── Types ── */

type ToastVariant = "success" | "error" | "info";

interface ToastData {
	id: number;
	message: string;
	variant: ToastVariant;
}

interface ToastContextValue {
	showToast: (message: string, variant?: ToastVariant) => void;
}

/* ── Animations ── */

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const slideOut = keyframes`
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(-10px) scale(0.95); }
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
  padding-top: env(safe-area-inset-top, 0.75rem);
  gap: 0.5rem;
`;

const VARIANT_COLORS: Record<ToastVariant, { bg: string; accent: string; icon: string }> = {
	success: {
		bg: `${tokens.colors.secondaryContainer}`,
		accent: tokens.colors.secondary,
		icon: "check_circle",
	},
	error: {
		bg: `${tokens.colors.errorContainer}`,
		accent: tokens.colors.error,
		icon: "error",
	},
	info: {
		bg: `${tokens.colors.surfaceContainerHigh}`,
		accent: tokens.colors.primary,
		icon: "info",
	},
};

const ToastItem = styled.div<{ $variant: ToastVariant; $exiting: boolean }>`
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $variant }) => VARIANT_COLORS[$variant].bg};
  border-left: 3px solid ${({ $variant }) => VARIANT_COLORS[$variant].accent};
  max-width: 22rem;
  width: 100%;
  animation: ${({ $exiting }) => ($exiting ? slideOut : slideIn)} 0.25s ease-out forwards;
`;

const ToastIcon = styled.span<{ $variant: ToastVariant }>`
  font-family: "Material Symbols Outlined";
  font-size: 20px;
  color: ${({ $variant }) => VARIANT_COLORS[$variant].accent};
  flex-shrink: 0;
  font-variation-settings: "FILL" 1;
`;

const ToastMessage = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
  line-height: ${tokens.typography.lineHeight.snug};
  flex: 1;
  min-width: 0;
`;

/* ── Context ── */

const ToastContext = createContext<ToastContextValue>({
	showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<(ToastData & { exiting: boolean })[]>([]);
	const idRef = useRef(0);

	const showToast = useCallback((message: string, variant: ToastVariant = "info") => {
		const id = ++idRef.current;
		setToasts((prev) => {
			// Keep max 3 toasts visible
			const visible = prev.length >= 3 ? prev.slice(1) : prev;
			return [...visible, { id, message, variant, exiting: false }];
		});

		// Start exit animation after 2.5s
		setTimeout(() => {
			setToasts((prev) =>
				prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
			);
			// Remove from DOM after animation
			setTimeout(() => {
				setToasts((prev) => prev.filter((t) => t.id !== id));
			}, 250);
		}, 2500);
	}, []);

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			{toasts.length > 0 && (
				<ToastContainer>
					{toasts.map((toast) => (
						<ToastItem key={toast.id} $variant={toast.variant} $exiting={toast.exiting}>
							<ToastIcon $variant={toast.variant}>
								{VARIANT_COLORS[toast.variant].icon}
							</ToastIcon>
							<ToastMessage>{toast.message}</ToastMessage>
						</ToastItem>
					))}
				</ToastContainer>
			)}
		</ToastContext.Provider>
	);
}

export function useToast() {
	return useContext(ToastContext);
}

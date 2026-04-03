import { tokens } from "@/theme/tokens";
import styled, { css } from "styled-components";

export interface ButtonProps {
	children: React.ReactNode;
	onClick?: () => void;
	type?: "button" | "submit" | "reset";
	variant?: "primary" | "secondary" | "ghost" | "danger";
	loading?: boolean;
	loadingText?: string;
	disabled?: boolean;
	fullWidth?: boolean;
	icon?: React.ReactNode;
	className?: string;
	"data-testid"?: string;
}

const primaryStyles = css`
  background: linear-gradient(135deg, ${tokens.colors.primary} 0%, ${tokens.colors.primaryContainer} 100%);
  color: ${tokens.colors.onPrimaryFixed};
  border: none;
  box-shadow: ${tokens.shadows.glow.primary};
  &:hover:not(:disabled) { box-shadow: 0 0 30px rgba(143, 245, 255, 0.25); }
  &:active:not(:disabled) { transform: scale(0.98); }
`;

const secondaryStyles = css`
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurface};
  border: 1px solid rgba(72, 72, 73, 0.1);
  &:hover:not(:disabled) { background: ${tokens.colors.surfaceBright}; }
  &:active:not(:disabled) { transform: scale(0.98); }
`;

const ghostStyles = css`
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  border: none;
  &:hover:not(:disabled) { color: ${tokens.colors.onSurface}; }
`;

const dangerStyles = css`
  background: transparent;
  color: ${tokens.colors.error};
  border: 1px solid rgba(255, 113, 108, 0.2);
  &:hover:not(:disabled) { background: rgba(255, 113, 108, 0.05); }
  &:active:not(:disabled) { transform: scale(0.98); }
`;

const variantMap = {
	primary: primaryStyles,
	secondary: secondaryStyles,
	ghost: ghostStyles,
	danger: dangerStyles,
};

const StyledButton = styled.button<{
	$variant: keyof typeof variantMap;
	$fullWidth: boolean;
}>`
  min-height: 44px;
  padding: 0.875rem 1.5rem;
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  font-family: ${tokens.typography.fontFamily.label};
  letter-spacing: ${tokens.typography.letterSpacing.wider};
  text-transform: uppercase;
  border-radius: ${tokens.borderRadius.md};
  cursor: pointer;
  transition: all ${tokens.transitions.normal};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};

  ${({ $variant }) => variantMap[$variant]}

  &:disabled { opacity: 0.4; cursor: not-allowed; }

  &:focus-visible {
    outline: 2px solid ${tokens.colors.primary};
    outline-offset: 2px;
  }
`;

const Spinner = styled.span`
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export function Button({
	children,
	onClick,
	type = "button",
	variant = "primary",
	loading = false,
	loadingText,
	disabled = false,
	fullWidth = false,
	icon,
	className,
	"data-testid": testId,
}: ButtonProps) {
	return (
		<StyledButton
			type={type}
			onClick={!loading && !disabled ? onClick : undefined}
			disabled={disabled || loading}
			$variant={variant}
			$fullWidth={fullWidth}
			className={className}
			data-testid={testId}
		>
			{loading && <Spinner aria-label="Loading" />}
			{icon && !loading && icon}
			{loading && loadingText ? loadingText : children}
		</StyledButton>
	);
}

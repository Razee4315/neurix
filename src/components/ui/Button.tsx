import type React from "react";
import styled from "styled-components";
import { tokens } from "@/theme/tokens";

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

const StyledButton = styled.button<{
  $variant: "primary" | "secondary" | "ghost";
  $fullWidth: boolean;
  $loading: boolean;
}>`
  min-height: 44px;
  padding: 0.75rem 1.5rem;
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.semibold};
  font-family: ${tokens.typography.fontFamily.heading};
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};
  position: relative;

  ${({ $variant }) =>
    $variant === "primary" &&
    `
    background: transparent;
    color: ${tokens.colors.primary};
    border: 1px solid ${tokens.colors.primary};
    box-shadow: inset 0 0 0 0 ${tokens.colors.primary}22;
    &:hover:not(:disabled) {
      background: ${tokens.colors.surface.overlay};
      box-shadow: ${tokens.shadows.glow.primary};
    }
    &:active:not(:disabled) {
      background: ${tokens.colors.surface.overlayHover};
    }
  `}

  ${({ $variant }) =>
    $variant === "secondary" &&
    `
    background: transparent;
    color: ${tokens.colors.secondary};
    border: 1px solid ${tokens.colors.secondary};
    &:hover:not(:disabled) {
      background: rgba(57, 255, 20, 0.06);
      box-shadow: ${tokens.shadows.glow.secondary};
    }
  `}

  ${({ $variant }) =>
    $variant === "ghost" &&
    `
    background: transparent;
    color: ${tokens.colors.text.secondary};
    border: 1px solid ${tokens.colors.border.default};
    &:hover:not(:disabled) {
      color: ${tokens.colors.text.primary};
      border-color: ${tokens.colors.border.hover};
      background: ${tokens.colors.surface.overlay};
    }
  `}

  &:disabled { opacity: 0.4; cursor: not-allowed; }
  ${({ $loading }) => $loading && `cursor: wait; pointer-events: none;`}

  &:focus-visible {
    outline: 2px solid ${tokens.colors.border.focus};
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

export const Button: React.FC<ButtonProps> = ({
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
  ...rest
}) => (
  <StyledButton
    type={type}
    onClick={!loading && !disabled ? onClick : undefined}
    disabled={disabled || loading}
    $variant={variant}
    $fullWidth={fullWidth}
    $loading={loading}
    className={className}
    data-testid={testId}
    {...rest}
  >
    {loading && <Spinner aria-label="Loading" />}
    {icon && !loading && icon}
    {loading && loadingText ? loadingText : children}
  </StyledButton>
);

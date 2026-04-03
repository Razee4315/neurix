import type React from "react";
import styled from "styled-components";
import { tokens } from "@/theme/tokens";

export interface InputProps {
  label?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  "data-testid"?: string;
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 100%;
`;

const Label = styled.label`
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.text.secondary};
`;

const Field = styled.input<{ $hasError: boolean }>`
  min-height: 44px;
  padding: 0.75rem 1rem;
  font-size: ${tokens.typography.fontSize.base};
  font-family: inherit;
  color: ${tokens.colors.text.primary};
  background: ${tokens.colors.surface.base};
  border: 1px solid ${({ $hasError }) =>
    $hasError ? tokens.colors.error : tokens.colors.border.default};
  border-radius: ${tokens.borderRadius.md};
  outline: none;
  transition: border-color ${tokens.transitions.fast};
  width: 100%;

  &::placeholder { color: ${tokens.colors.text.disabled}; }
  &:focus {
    border-color: ${({ $hasError }) =>
      $hasError ? tokens.colors.error : tokens.colors.border.focus};
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ErrorText = styled.span`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.error};
`;

export const Input: React.FC<InputProps> = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  autoFocus = false,
  "data-testid": testId,
}) => (
  <Wrapper>
    {label && <Label>{label}</Label>}
    <Field
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      $hasError={!!error}
      data-testid={testId}
    />
    {error && <ErrorText>{error}</ErrorText>}
  </Wrapper>
);

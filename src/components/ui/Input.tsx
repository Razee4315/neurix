import { tokens } from "@/theme/tokens";
import styled from "styled-components";

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
  color: ${tokens.colors.onSurfaceVariant};
`;

const Field = styled.input<{ $hasError: boolean }>`
  min-height: 44px;
  padding: 0.75rem 1rem;
  font-size: ${tokens.typography.fontSize.base};
  font-family: inherit;
  color: ${tokens.colors.onSurface};
  background: ${tokens.colors.surfaceContainerHighest};
  border: none;
  border-bottom: 1px solid ${({ $hasError }) =>
		$hasError ? tokens.colors.error : "transparent"};
  border-radius: ${tokens.borderRadius.lg};
  outline: none;
  transition: border-color ${tokens.transitions.fast};
  width: 100%;

  &::placeholder { color: ${tokens.colors.outline}; }
  &:focus {
    border-bottom-color: ${({ $hasError }) =>
			$hasError ? tokens.colors.error : tokens.colors.primary};
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ErrorText = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.error};
`;

export function Input({
	label,
	type = "text",
	value,
	onChange,
	placeholder,
	error,
	disabled = false,
	autoFocus = false,
	"data-testid": testId,
}: InputProps) {
	return (
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
}

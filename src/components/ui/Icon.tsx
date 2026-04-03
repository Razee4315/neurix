import styled from "styled-components";

interface IconProps {
	name: string;
	size?: number;
	fill?: boolean;
	weight?: number;
	color?: string;
	className?: string;
}

const StyledIcon = styled.span<{
	$size: number;
	$fill: boolean;
	$weight: number;
	$color?: string;
}>`
  font-family: "Material Symbols Outlined";
  font-size: ${({ $size }) => $size}px;
  font-variation-settings:
    "FILL" ${({ $fill }) => ($fill ? 1 : 0)},
    "wght" ${({ $weight }) => $weight},
    "GRAD" 0,
    "opsz" ${({ $size }) => Math.min(48, Math.max(20, $size))};
  color: ${({ $color }) => $color || "inherit"};
  user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  flex-shrink: 0;
`;

export function Icon({
	name,
	size = 24,
	fill = false,
	weight = 400,
	color,
	className,
}: IconProps) {
	return (
		<StyledIcon
			className={className}
			$size={size}
			$fill={fill}
			$weight={weight}
			$color={color}
			aria-hidden="true"
		>
			{name}
		</StyledIcon>
	);
}

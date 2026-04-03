interface NeurixLogoProps {
	size?: number;
	className?: string;
}

export function NeurixLogo({ size = 40, className }: NeurixLogoProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 100 100"
			xmlns="http://www.w3.org/2000/svg"
			aria-label="Neurix logo"
			className={className}
		>
			<title>Neurix</title>
			<rect width="100" height="100" fill="#0e0e0f" rx="18" />
			<path
				d="M 35 20 L 20 20 L 20 80 L 35 80"
				stroke="#8ff5ff"
				strokeWidth="8"
				fill="none"
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			<path
				d="M 65 20 L 80 20 L 80 80 L 65 80"
				stroke="#8ff5ff"
				strokeWidth="8"
				fill="none"
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			<circle cx="50" cy="50" r="10" fill="#2ff801" />
		</svg>
	);
}

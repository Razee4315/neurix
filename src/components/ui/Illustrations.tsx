import { tokens } from "@/theme/tokens";
import styled, { keyframes } from "styled-components";

/**
 * Theme-aware SVG artwork. Every color comes from the active theme's CSS
 * variables, so the illustrations recolor with the theme and need no assets.
 */

const twinkle = keyframes`
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
`;

const drift = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const C = {
	primary: "rgb(var(--c-primary))",
	secondary: "rgb(var(--c-secondary))",
	tertiary: "rgb(var(--c-tertiary))",
	bg: "rgb(var(--c-background))",
	low: "rgb(var(--c-surface-container-low))",
	high: "rgb(var(--c-surface-container-high))",
	highest: "rgb(var(--c-surface-container-highest))",
	outline: "rgb(var(--c-outline-variant))",
	onVariant: "rgb(var(--c-on-surface-variant))",
	onSurface: "rgb(var(--c-on-surface))",
};

/* ── Mountain scene: a camp below a Karakoram peak, no signal needed ──

   A flat picture in a frame: a night sky with stars and a crescent moon, a
   far range, a second summit, then the main peak with one face in light and
   one in shadow and snow on its shoulders. In front, the ground and a
   single lit tent. The tent is the point of the picture: someone is out
   here with no signal, and the light is on.

   Every shape is a solid fill. Depth comes from overlap and from how much
   of the accent color each layer carries, not from glows or fades. */

const SceneSvg = styled.svg`
  display: block;
  width: 100%;
  max-width: 340px;
  height: auto;
  overflow: hidden;
  border-radius: calc(${tokens.borderRadius.xl} * 1.5);
  border: 1px solid ${tokens.colors.outlineVariant};
  background: ${tokens.colors.surfaceContainerLow};

  .star { animation: ${twinkle} 3.2s ease-in-out infinite; }
  .star:nth-of-type(2n) { animation-delay: 0.8s; }
  .star:nth-of-type(3n) { animation-delay: 1.6s; }

  /* Snow is light in every theme: the pale text color on dark themes,
     white on a light one (where the text color is ink). */
  .snow { fill: rgb(var(--c-on-surface)); }
  html[data-mode="light"] & .snow { fill: #ffffff; }
`;

const STARS: ReadonlyArray<[number, number, number]> = [
	[22, 34, 1.2],
	[58, 18, 0.9],
	[84, 52, 1],
	[118, 26, 1.3],
	[176, 14, 1],
	[206, 40, 0.8],
	[286, 22, 1.1],
	[304, 66, 0.9],
	[36, 76, 0.8],
	[270, 84, 0.7],
];

/** Four-point stars: [x, y, size]. */
const GLINTS: ReadonlyArray<[number, number, number]> = [
	[46, 44, 5],
	[196, 66, 4],
	[296, 44, 3.5],
];

function glint(x: number, y: number, r: number): string {
	const k = r * 0.22;
	return `M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`;
}

export function MountainScene({ className }: { className?: string }) {
	return (
		<SceneSvg
			viewBox="0 0 320 200"
			className={className}
			role="img"
			aria-label="A lit tent below a snow-capped peak at night"
		>
			<defs>
				{/* A crescent: a disc with a bite taken out of it. */}
				<mask id="mtn-crescent">
					<circle cx="250" cy="44" r="15" fill="#fff" />
					<circle cx="243" cy="39" r="13" fill="#000" />
				</mask>
			</defs>

			{STARS.map(([x, y, r]) => (
				<circle
					key={`${x}-${y}`}
					className="star"
					cx={x}
					cy={y}
					r={r}
					fill={C.onVariant}
				/>
			))}
			{GLINTS.map(([x, y, r]) => (
				<path
					key={`g-${x}-${y}`}
					className="star"
					d={glint(x, y, r)}
					fill={C.onSurface}
				/>
			))}

			<circle
				cx="250"
				cy="44"
				r="15"
				fill={C.onSurface}
				mask="url(#mtn-crescent)"
			/>

			{/* Far range */}
			<path
				d="M0 152 L24 130 L44 142 L70 108 L92 128 L118 100 L140 124 L170 96 L196 126 L222 104 L250 134 L276 112 L300 136 L320 122 L320 200 L0 200 Z"
				fill={C.tertiary}
				fillOpacity="0.22"
			/>

			{/* Second summit, behind the main one */}
			<path
				d="M238 88 L206 138 L190 176 L246 176 L241 124 Z"
				fill={C.primary}
				fillOpacity="0.5"
			/>
			<path
				d="M238 88 L241 124 L246 176 L304 176 L272 130 L260 134 Z"
				fill={C.primary}
				fillOpacity="0.26"
			/>
			<path
				className="snow"
				d="M238 88 L228 104 L234 101 L239 109 L241 124 L247 111 L252 110 Z"
				opacity="0.6"
			/>

			{/* Main peak: the face in light, then the face in shadow */}
			<path
				d="M36 176 L70 146 L94 152 L122 98 L134 106 L150 42 L156 92 L146 128 L160 176 Z"
				fill={C.primary}
				fillOpacity="0.9"
			/>
			<path
				d="M150 42 L170 86 L182 80 L208 134 L226 128 L264 176 L160 176 L146 128 L156 92 Z"
				fill={C.primary}
				fillOpacity="0.45"
			/>
			{/* Snow: bright where it catches the light, dimmer in shadow */}
			<path
				className="snow"
				d="M150 42 L134 106 L138 96 L145 100 L149 84 L156 92 Z"
			/>
			<path
				className="snow"
				d="M150 42 L156 92 L162 80 L167 90 L170 86 Z"
				opacity="0.6"
			/>
			<path
				className="snow"
				d="M122 98 L112 118 L119 113 L125 121 L134 106 Z"
				opacity="0.7"
			/>

			{/* Ground, and the camp */}
			<path
				d="M0 200 L0 172 Q40 158 86 169 T180 173 T262 165 T320 173 L320 200 Z"
				fill={C.highest}
			/>
			<path d="M82 173 L96 151 L110 173 Z" fill={C.secondary} />
			<path d="M96 160 L91 173 L101 173 Z" fill={C.bg} />
		</SceneSvg>
	);
}

/* ── Setup art: a model, living inside the device ── */

const SetupSvg = styled.svg`
  width: 132px;
  height: 96px;
  overflow: visible;

  .float { animation: ${drift} 5s ease-in-out infinite; }
  .float.late { animation-delay: 1.4s; }
  .ring { animation: ${spin} 40s linear infinite; transform-origin: 66px 50px; }
`;

export function SetupArt({ className }: { className?: string }) {
	return (
		<SetupSvg
			viewBox="0 0 132 96"
			fill="none"
			className={className}
			aria-hidden="true"
		>
			{/* Nothing leaves this circle: the model's whole world is the device. */}
			<circle
				className="ring"
				cx="66"
				cy="50"
				r="44"
				stroke={C.outline}
				strokeWidth="1"
				strokeDasharray="2 6"
				strokeLinecap="round"
			/>

			{/* The device */}
			<rect
				x="43"
				y="6"
				width="46"
				height="84"
				rx="10"
				fill={C.low}
				stroke={C.primary}
				strokeWidth="1.5"
			/>
			<rect x="60" y="11" width="12" height="2.5" rx="1.25" fill={C.outline} />

			{/* The model, inside it */}
			<g className="float">
				<path
					d="M66 33 L80 40.5 L66 48 L52 40.5 Z"
					fill={C.primary}
					fillOpacity="0.35"
					stroke={C.primary}
					strokeWidth="1.25"
					strokeLinejoin="round"
				/>
				<path
					d="M52 40.5 L52 56 L66 63.5 L66 48 Z"
					fill={C.highest}
					stroke={C.primary}
					strokeWidth="1.25"
					strokeLinejoin="round"
				/>
				<path
					d="M80 40.5 L80 56 L66 63.5 L66 48 Z"
					fill={C.high}
					stroke={C.primary}
					strokeWidth="1.25"
					strokeLinejoin="round"
				/>
			</g>

			{/* Ready */}
			<circle cx="88" cy="80" r="9" fill={C.secondary} />
			<path
				d="M84 80 L87 83 L92.5 77"
				stroke={C.bg}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>

			<path
				className="float late"
				d="M20 26 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z"
				fill={C.secondary}
			/>
			<circle className="float late" cx="112" cy="24" r="3" fill={C.tertiary} />
			<circle className="float" cx="16" cy="64" r="2" fill={C.primary} />
		</SetupSvg>
	);
}

/* ── Empty-state art ── */

const ArtSvg = styled.svg`
  width: 132px;
  height: 96px;
  overflow: visible;

  .float { animation: ${drift} 5s ease-in-out infinite; }
  .float.late { animation-delay: 1.2s; }
`;

export type EmptyArtKind = "models" | "chats" | "search" | "characters";

export function EmptyArt({ kind }: { kind: EmptyArtKind }) {
	return (
		<ArtSvg viewBox="0 0 132 96" fill="none" aria-hidden="true">
			<ellipse cx="66" cy="86" rx="46" ry="5" fill={C.high} />
			{kind === "models" && (
				<>
					<g className="float">
						<path
							d="M66 14 L96 30 L66 46 L36 30 Z"
							fill={C.primary}
							fillOpacity="0.25"
							stroke={C.primary}
							strokeWidth="1.5"
							strokeLinejoin="round"
						/>
						<path
							d="M36 30 L36 58 L66 74 L66 46 Z"
							fill={C.highest}
							stroke={C.primary}
							strokeWidth="1.5"
							strokeLinejoin="round"
						/>
						<path
							d="M96 30 L96 58 L66 74 L66 46 Z"
							fill={C.high}
							stroke={C.primary}
							strokeWidth="1.5"
							strokeLinejoin="round"
						/>
					</g>
					<circle
						className="float late"
						cx="108"
						cy="22"
						r="4"
						fill={C.secondary}
					/>
					<circle
						className="float late"
						cx="22"
						cy="44"
						r="3"
						fill={C.tertiary}
					/>
				</>
			)}
			{kind === "chats" && (
				<>
					<g className="float">
						<rect
							x="22"
							y="16"
							width="62"
							height="36"
							rx="12"
							fill={C.highest}
							stroke={C.outline}
							strokeWidth="1.5"
						/>
						<path
							d="M34 52 L34 62 L46 52 Z"
							fill={C.highest}
							stroke={C.outline}
							strokeWidth="1.5"
							strokeLinejoin="round"
						/>
						<rect
							x="32"
							y="28"
							width="34"
							height="4"
							rx="2"
							fill={C.onVariant}
							fillOpacity="0.5"
						/>
						<rect
							x="32"
							y="37"
							width="22"
							height="4"
							rx="2"
							fill={C.onVariant}
							fillOpacity="0.3"
						/>
					</g>
					<g className="float late">
						<rect
							x="58"
							y="40"
							width="54"
							height="32"
							rx="11"
							fill={C.primary}
							fillOpacity="0.2"
							stroke={C.primary}
							strokeWidth="1.5"
						/>
						<circle cx="74" cy="56" r="3" fill={C.primary} />
						<circle cx="85" cy="56" r="3" fill={C.primary} fillOpacity="0.7" />
						<circle cx="96" cy="56" r="3" fill={C.primary} fillOpacity="0.4" />
					</g>
				</>
			)}
			{kind === "search" && (
				<g className="float">
					<circle
						cx="58"
						cy="40"
						r="22"
						fill={C.highest}
						stroke={C.primary}
						strokeWidth="2"
					/>
					<path
						d="M74 56 L92 74"
						stroke={C.primary}
						strokeWidth="5"
						strokeLinecap="round"
					/>
					<path
						d="M50 34 L66 46 M66 34 L50 46"
						stroke={C.onVariant}
						strokeWidth="2.5"
						strokeLinecap="round"
					/>
				</g>
			)}
			{kind === "characters" && (
				<>
					<g className="float">
						<circle
							cx="66"
							cy="34"
							r="14"
							fill={C.primary}
							fillOpacity="0.2"
							stroke={C.primary}
							strokeWidth="1.5"
						/>
						<path
							d="M40 76 Q40 54 66 54 Q92 54 92 76"
							fill={C.highest}
							stroke={C.primary}
							strokeWidth="1.5"
						/>
					</g>
					<path
						className="float late"
						d="M104 18 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z"
						fill={C.secondary}
					/>
				</>
			)}
		</ArtSvg>
	);
}

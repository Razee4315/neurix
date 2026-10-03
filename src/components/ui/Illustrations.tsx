import { Icon } from "@/components/ui/Icon";
import { alpha } from "@/theme/alpha";
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

const breathe = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.55; }
  50% { transform: scale(1.06); opacity: 0.9; }
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
};

/* ── Mountain scene: the Karakoram at night, no signal needed ── */

const SceneSvg = styled.svg`
  width: 100%;
  max-width: 340px;
  height: auto;
  overflow: visible;

  .star { animation: ${twinkle} 3.2s ease-in-out infinite; }
  .star:nth-of-type(2n) { animation-delay: 0.8s; }
  .star:nth-of-type(3n) { animation-delay: 1.6s; }
  .orb { animation: ${drift} 6s ease-in-out infinite; transform-origin: center; }
`;

const STARS: ReadonlyArray<[number, number, number]> = [
	[28, 30, 1.4], [70, 58, 1], [112, 22, 1.6], [150, 48, 1], [262, 28, 1.5],
	[296, 62, 1.1], [226, 74, 0.9], [44, 84, 0.9], [188, 16, 1.1],
];

export function MountainScene({ className }: { className?: string }) {
	return (
		<SceneSvg viewBox="0 0 320 200" className={className} role="img" aria-label="Mountains under a night sky">
			<defs>
				<radialGradient id="mtn-glow" cx="50%" cy="50%" r="50%">
					<stop offset="0%" stopColor={C.primary} stopOpacity="0.55" />
					<stop offset="100%" stopColor={C.primary} stopOpacity="0" />
				</radialGradient>
				<linearGradient id="mtn-far" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={C.tertiary} stopOpacity="0.5" />
					<stop offset="100%" stopColor={C.tertiary} stopOpacity="0.08" />
				</linearGradient>
				<linearGradient id="mtn-near" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={C.primary} stopOpacity="0.7" />
					<stop offset="100%" stopColor={C.primary} stopOpacity="0.12" />
				</linearGradient>
			</defs>

			{STARS.map(([x, y, r]) => (
				<circle key={`${x}-${y}`} className="star" cx={x} cy={y} r={r} fill={C.onVariant} />
			))}

			<g className="orb">
				<circle cx="218" cy="62" r="46" fill="url(#mtn-glow)" />
				<circle cx="218" cy="62" r="15" fill={C.primary} opacity="0.9" />
				<circle cx="218" cy="62" r="5" fill={C.secondary} />
			</g>

			<path d="M0 168 L46 104 L78 136 L124 70 L168 130 L206 96 L258 150 L292 118 L320 146 L320 200 L0 200 Z" fill="url(#mtn-far)" />
			<path d="M0 200 L0 176 L52 128 L92 164 L146 96 L186 150 L232 120 L282 172 L320 150 L320 200 Z" fill="url(#mtn-near)" />
			{/* Snow caps */}
			<path d="M146 96 L132 114 L142 110 L150 120 L158 112 Z" fill={C.bg} opacity="0.55" />
			<path d="M124 70 L112 88 L122 84 L128 92 L136 86 Z" fill={C.bg} opacity="0.4" />
			<path d="M0 200 L0 188 Q80 172 160 186 T320 180 L320 200 Z" fill={C.low} />
		</SceneSvg>
	);
}

/* ── Chat scene: the active character inside orbiting rings ── */

const Orb = styled.div<{ $accent: string }>`
  position: relative;
  width: 112px;
  height: 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ $accent }) => $accent};

  svg.rings {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    animation: ${spin} 28s linear infinite;
  }

  .halo {
    position: absolute;
    inset: 14px;
    border-radius: 50%;
    background: radial-gradient(circle, ${({ $accent }) => alpha($accent, "55")} 0%, transparent 70%);
    animation: ${breathe} 4s ease-in-out infinite;
  }

  .core {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({ $accent }) => alpha($accent, "26")};
    border: 1px solid ${({ $accent }) => alpha($accent, "80")};
  }
`;

export function ChatScene({ accent, icon }: { accent: string; icon: string }) {
	return (
		<Orb $accent={accent} aria-hidden="true">
			<svg className="rings" viewBox="0 0 112 112" fill="none" aria-hidden="true">
				<circle cx="56" cy="56" r="52" stroke="currentColor" strokeOpacity="0.18" strokeDasharray="2 7" />
				<circle cx="56" cy="56" r="40" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="14 10" />
				<circle cx="56" cy="4" r="3" fill="currentColor" />
				<circle cx="96" cy="56" r="2" fill="currentColor" fillOpacity="0.6" />
			</svg>
			<span className="halo" />
			<span className="core">
				<Icon name={icon} size={26} />
			</span>
		</Orb>
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
						<path d="M66 14 L96 30 L66 46 L36 30 Z" fill={C.primary} fillOpacity="0.25" stroke={C.primary} strokeWidth="1.5" strokeLinejoin="round" />
						<path d="M36 30 L36 58 L66 74 L66 46 Z" fill={C.highest} stroke={C.primary} strokeWidth="1.5" strokeLinejoin="round" />
						<path d="M96 30 L96 58 L66 74 L66 46 Z" fill={C.high} stroke={C.primary} strokeWidth="1.5" strokeLinejoin="round" />
					</g>
					<circle className="float late" cx="108" cy="22" r="4" fill={C.secondary} />
					<circle className="float late" cx="22" cy="44" r="3" fill={C.tertiary} />
				</>
			)}
			{kind === "chats" && (
				<>
					<g className="float">
						<rect x="22" y="16" width="62" height="36" rx="12" fill={C.highest} stroke={C.outline} strokeWidth="1.5" />
						<path d="M34 52 L34 62 L46 52 Z" fill={C.highest} stroke={C.outline} strokeWidth="1.5" strokeLinejoin="round" />
						<rect x="32" y="28" width="34" height="4" rx="2" fill={C.onVariant} fillOpacity="0.5" />
						<rect x="32" y="37" width="22" height="4" rx="2" fill={C.onVariant} fillOpacity="0.3" />
					</g>
					<g className="float late">
						<rect x="58" y="40" width="54" height="32" rx="11" fill={C.primary} fillOpacity="0.2" stroke={C.primary} strokeWidth="1.5" />
						<circle cx="74" cy="56" r="3" fill={C.primary} />
						<circle cx="85" cy="56" r="3" fill={C.primary} fillOpacity="0.7" />
						<circle cx="96" cy="56" r="3" fill={C.primary} fillOpacity="0.4" />
					</g>
				</>
			)}
			{kind === "search" && (
				<g className="float">
					<circle cx="58" cy="40" r="22" fill={C.highest} stroke={C.primary} strokeWidth="2" />
					<path d="M74 56 L92 74" stroke={C.primary} strokeWidth="5" strokeLinecap="round" />
					<path d="M50 34 L66 46 M66 34 L50 46" stroke={C.onVariant} strokeWidth="2.5" strokeLinecap="round" />
				</g>
			)}
			{kind === "characters" && (
				<>
					<g className="float">
						<circle cx="66" cy="34" r="14" fill={C.primary} fillOpacity="0.2" stroke={C.primary} strokeWidth="1.5" />
						<path d="M40 76 Q40 54 66 54 Q92 54 92 76" fill={C.highest} stroke={C.primary} strokeWidth="1.5" />
					</g>
					<path className="float late" d="M104 18 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill={C.secondary} />
				</>
			)}
		</ArtSvg>
	);
}

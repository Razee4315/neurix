import { tokens } from "@/theme/tokens";
import styled from "styled-components";

/**
 * Artwork.
 *
 * The hero, onboarding and two empty states use the bespoke Karakoram
 * paintings in `public/assets/art`. They sit in flat frames with a 1px
 * hairline in the theme's outline color, so they belong to whichever theme
 * is active. The remaining empty states are small flat SVGs whose colors
 * come from the theme's CSS variables. Nothing loops or floats while idle
 * (MOTION.md).
 */

const ART = {
	hero: "/assets/art/hero-karakoram-camp.webp",
	setup: "/assets/art/onboarding-device-peak.webp",
	models: "/assets/art/empty-models.webp",
	connectors: "/assets/art/empty-connectors.webp",
} as const;

const C = {
	primary: "rgb(var(--c-primary))",
	secondary: "rgb(var(--c-secondary))",
	high: "rgb(var(--c-surface-container-high))",
	highest: "rgb(var(--c-surface-container-highest))",
	outline: "rgb(var(--c-outline-variant))",
	onVariant: "rgb(var(--c-on-surface-variant))",
};

/* ── Mountain scene: a lit camp below a Karakoram peak, no signal needed ── */

const HeroFrame = styled.img`
  display: block;
  width: 100%;
  max-width: 380px;
  height: auto;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.xl};
  background: ${tokens.colors.surfaceContainerLow};
`;

export function MountainScene({ className }: { className?: string }) {
	return (
		<HeroFrame
			src={ART.hero}
			className={className}
			alt="A lit tent below a snow-capped Karakoram peak at night"
			width={1040}
			height={585}
			decoding="async"
			draggable={false}
		/>
	);
}

/* ── Setup art: a device standing on the peaks, the model inside it ── */

/* A basalt frame with the top-right corner cut off: an instrument plate,
   not a rounded card. */
const SetupFrame = styled.span`
  display: block;
  width: 100%;
  max-width: 22rem;
  padding: 1px;
  background: ${tokens.colors.outlineVariant};
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
  border-radius: ${tokens.borderRadius.md};

  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    background: ${tokens.colors.surfaceContainerLowest};
    clip-path: polygon(0 0, calc(100% - 13.5px) 0, 100% 13.5px, 100% 100%, 0 100%);
    border-radius: ${tokens.borderRadius.sm};
  }
`;

export function SetupArt({ className }: { className?: string }) {
	return (
		<SetupFrame className={className}>
			<img
				src={ART.setup}
				alt=""
				aria-hidden="true"
				width={880}
				height={550}
				decoding="async"
				draggable={false}
			/>
		</SetupFrame>
	);
}

/* ── Empty-state art ── */

export type EmptyArtKind = "models" | "chats" | "search" | "characters" | "connectors";

const ArtImage = styled.img`
  display: block;
  width: 120px;
  height: 120px;
  object-fit: cover;
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerLow};
`;

const ArtSvg = styled.svg`
  display: block;
  width: 120px;
  height: 88px;
`;

export function EmptyArt({ kind }: { kind: EmptyArtKind }) {
	if (kind === "models" || kind === "connectors") {
		return (
			<ArtImage
				src={ART[kind]}
				alt=""
				aria-hidden="true"
				width={520}
				height={520}
				decoding="async"
				draggable={false}
			/>
		);
	}
	return (
		<ArtSvg viewBox="0 0 132 96" fill="none" aria-hidden="true">
			<rect x="20" y="84" width="92" height="1" fill={C.outline} />
			{kind === "chats" && (
				<>
					<rect x="22" y="16" width="62" height="36" rx="6" fill={C.highest} stroke={C.outline} />
					<path d="M34 52 L34 62 L46 52 Z" fill={C.highest} stroke={C.outline} strokeLinejoin="round" />
					<rect x="32" y="28" width="34" height="3" rx="1.5" fill={C.onVariant} fillOpacity="0.55" />
					<rect x="32" y="37" width="22" height="3" rx="1.5" fill={C.onVariant} fillOpacity="0.3" />
					<rect x="58" y="42" width="54" height="30" rx="6" fill={C.high} stroke={C.primary} />
					<rect x="68" y="55" width="6" height="4" rx="1" fill={C.primary} />
					<rect x="78" y="55" width="6" height="4" rx="1" fill={C.primary} fillOpacity="0.65" />
					<rect x="88" y="55" width="6" height="4" rx="1" fill={C.primary} fillOpacity="0.35" />
				</>
			)}
			{kind === "search" && (
				<>
					<circle cx="58" cy="40" r="22" fill={C.highest} stroke={C.primary} strokeWidth="1.5" />
					<path d="M74 56 L92 74" stroke={C.primary} strokeWidth="4" strokeLinecap="square" />
					<path d="M48 40 L68 40" stroke={C.onVariant} strokeWidth="2" strokeLinecap="round" />
					<path
						d="M52 47 L64 47"
						stroke={C.onVariant}
						strokeOpacity="0.5"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</>
			)}
			{kind === "characters" && (
				<>
					<circle cx="66" cy="34" r="14" fill={C.high} stroke={C.primary} strokeWidth="1.5" />
					<path
						d="M40 78 Q40 54 66 54 Q92 54 92 78 Z"
						fill={C.highest}
						stroke={C.primary}
						strokeWidth="1.5"
					/>
					<path d="M100 20 L104 28 L108 20 Z" fill={C.secondary} />
				</>
			)}
		</ArtSvg>
	);
}

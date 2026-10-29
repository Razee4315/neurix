import { NeurixGlyph } from "@/components/ui/NeurixLogo";
import {
	ALargeSmall,
	ArrowDown,
	ArrowDownToLine,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	ArrowUpRight,
	BookOpen,
	BookText,
	Box,
	Braces,
	Brain,
	BrainCircuit,
	Briefcase,
	Calendar,
	Check,
	ChevronDown,
	ChevronRight,
	CircleAlert,
	CircleCheck,
	CircleUserRound,
	CloudOff,
	Code,
	Compass,
	Copy,
	CornerDownLeft,
	Cpu,
	Download,
	Dumbbell,
	EllipsisVertical,
	Eraser,
	ExternalLink,
	FlaskConical,
	Flower2,
	FolderOpen,
	Gamepad2,
	Gauge,
	Github,
	GraduationCap,
	HardDrive,
	Hash,
	Heart,
	History,
	Info,
	Layers,
	Lightbulb,
	LockKeyhole,
	Mail,
	type LucideIcon,
	MessageSquare,
	Mountain,
	Music,
	Palette,
	Pause,
	Pencil,
	PiggyBank,
	Plane,
	Play,
	Plug,
	Plus,
	Pointer,
	Power,
	RefreshCw,
	Rocket,
	RotateCcw,
	ScrollText,
	Search,
	Settings,
	Share,
	Shield,
	ShieldCheck,
	Smile,
	Sparkle,
	Square,
	SquarePen,
	Store,
	Trash2,
	TriangleAlert,
	Undo2,
	Upload,
	Users,
	Utensils,
	Wifi,
	X,
	Zap,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Icons are looked up by name. The names are the ones stored with user data
 * (a character's icon), so they stay stable even though the artwork behind
 * them has changed over time. Unknown names fall back to a neutral glyph.
 *
 * The artwork is Lucide: one even line weight and plain geometric shapes,
 * the quiet style of desktop AI tools. A filled state is drawn with a
 * slightly heavier stroke instead of a solid shape.
 */
type Glyph = LucideIcon | ComponentType<{ size?: number; className?: string; color?: string }>;

/** Icons are decoration: the text next to them carries the meaning. */
const DECORATIVE: Record<string, string> = { "aria-hidden": "true", focusable: "false" };

const ICONS = new Map<string, Glyph>(Object.entries({
	add: Plus,
	airplanemode_active: Plane,
	arrow_back: ArrowLeft,
	arrow_downward: ArrowDown,
	arrow_forward: ArrowRight,
	arrow_outward: ArrowUpRight,
	arrow_upward: ArrowUp,
	auto_awesome: Sparkle,
	bolt: Zap,
	business_center: Briefcase,
	chat: MessageSquare,
	chat_bubble: MessageSquare,
	check: Check,
	check_circle: CircleCheck,
	chevron_right: ChevronRight,
	close: X,
	cloud_off: CloudOff,
	code: Code,
	content_copy: Copy,
	data_object: Braces,
	delete: Trash2,
	delete_sweep: Eraser,
	deployed_code: Layers,
	diversity_3: Users,
	download: Download,
	downloading: ArrowDownToLine,
	edit: Pencil,
	edit_square: SquarePen,
	emoji_objects: Lightbulb,
	enhanced_encryption: LockKeyhole,
	error: CircleAlert,
	error_outline: CircleAlert,
	expand_more: ChevronDown,
	favorite: Heart,
	fitness_center: Dumbbell,
	format_size: ALargeSmall,
	history: History,
	history_edu: ScrollText,
	info: Info,
	ios_share: Share,
	keyboard_return: CornerDownLeft,
	landscape: Mountain,
	lightbulb: Lightbulb,
	memory: Cpu,
	menu_book: BookOpen,
	more_vert: EllipsisVertical,
	music_note: Music,
	neurology: Brain,
	open_in_new: ExternalLink,
	palette: Palette,
	pause: Pause,
	person: CircleUserRound,
	play_arrow: Play,
	power_settings_new: Power,
	psychology: BrainCircuit,
	refresh: RefreshCw,
	restart_alt: RotateCcw,
	restaurant: Utensils,
	rocket_launch: Rocket,
	school: GraduationCap,
	science: FlaskConical,
	search: Search,
	self_improvement: Flower2,
	sentiment_satisfied: Smile,
	smart_toy: NeurixGlyph,
	settings: Settings,
	share: Share,
	shield: Shield,
	speed: Gauge,
	sports_esports: Gamepad2,
	savings: PiggyBank,
	stop_circle: Square,
	storage: HardDrive,
	storefront: Store,
	touch_app: Pointer,
	travel_explore: Compass,
	undo: Undo2,
	upload: Upload,
	verified_user: ShieldCheck,
	warning: TriangleAlert,
	wifi: Wifi,
	model: Box,
	mail: Mail,
	folder_open: FolderOpen,
	calendar: Calendar,
	tag: Hash,
	notes: BookText,
	github: Github,
	plug: Plug,
}));

export function isKnownIcon(name: string): boolean {
	return ICONS.has(name);
}

/** At and below this size a slightly heavier line keeps the icon crisp. */
const SMALL = 16;

interface IconProps {
	name: string;
	size?: number;
	/** Emphasised state (selected tab, active toggle): a heavier line. */
	fill?: boolean;
	color?: string;
	className?: string;
}

export function Icon({ name, size = 24, fill = false, color, className }: IconProps) {
	const Glyph = (ICONS.get(name) ?? Sparkle) as LucideIcon;
	const strokeWidth = fill ? 2.25 : size <= SMALL ? 2 : 1.75;
	return (
		<Glyph
			className={className}
			size={size}
			color={color ?? "currentColor"}
			strokeWidth={strokeWidth}
			absoluteStrokeWidth={false}
			style={{ flexShrink: 0 }}
			{...DECORATIVE}
		/>
	);
}

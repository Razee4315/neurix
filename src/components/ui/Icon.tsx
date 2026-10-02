import {
	ArrowDown,
	ArrowDownToLine,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	ArrowUpRight,
	BookOpen,
	Box,
	Brain,
	BrainCircuit,
	Briefcase,
	Check,
	ChevronDown,
	ChevronRight,
	CircleAlert,
	CircleCheck,
	CircleStop,
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
	FileJson,
	FlaskConical,
	Flower2,
	Gamepad2,
	Gauge,
	GraduationCap,
	HardDrive,
	Heart,
	History,
	Info,
	Lightbulb,
	LockKeyhole,
	type LucideIcon,
	MessageSquare,
	MessagesSquare,
	Mountain,
	Music,
	Palette,
	Pause,
	Pencil,
	PiggyBank,
	Plane,
	Play,
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
	Share2,
	Shield,
	ShieldCheck,
	Smile,
	Sparkles,
	SquarePen,
	Store,
	Trash2,
	TriangleAlert,
	Type,
	Undo2,
	Upload,
	User,
	Users,
	Utensils,
	Wifi,
	X,
	Zap,
} from "lucide-react";

/**
 * Icon names are kept from the previous icon font so stored data (custom
 * characters save their icon by name) and shared character files keep
 * working. Unknown names fall back to a neutral glyph.
 */
const ICONS = new Map<string, LucideIcon>(Object.entries({
	add: Plus,
	airplanemode_active: Plane,
	arrow_back: ArrowLeft,
	arrow_downward: ArrowDown,
	arrow_forward: ArrowRight,
	arrow_outward: ArrowUpRight,
	arrow_upward: ArrowUp,
	auto_awesome: Sparkles,
	bolt: Zap,
	business_center: Briefcase,
	chat: MessagesSquare,
	chat_bubble: MessageSquare,
	check: Check,
	check_circle: CircleCheck,
	chevron_right: ChevronRight,
	close: X,
	cloud_off: CloudOff,
	code: Code,
	content_copy: Copy,
	data_object: FileJson,
	delete: Trash2,
	delete_sweep: Eraser,
	deployed_code: Box,
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
	format_size: Type,
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
	person: User,
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
	settings: Settings,
	share: Share2,
	shield: Shield,
	speed: Gauge,
	sports_esports: Gamepad2,
	savings: PiggyBank,
	stop_circle: CircleStop,
	storage: HardDrive,
	storefront: Store,
	touch_app: Pointer,
	travel_explore: Compass,
	undo: Undo2,
	upload: Upload,
	verified_user: ShieldCheck,
	warning: TriangleAlert,
	wifi: Wifi,
}));

export function isKnownIcon(name: string): boolean {
	return ICONS.has(name);
}

interface IconProps {
	name: string;
	size?: number;
	/** Adds a soft tint inside the outline, for selected / emphasised states. */
	fill?: boolean;
	color?: string;
	className?: string;
}

export function Icon({ name, size = 24, fill = false, color, className }: IconProps) {
	const Glyph = ICONS.get(name) ?? Sparkles;
	return (
		<Glyph
			className={className}
			size={size}
			color={color ?? "currentColor"}
			strokeWidth={size <= 16 ? 2 : 1.8}
			fill={fill ? "currentColor" : "none"}
			fillOpacity={fill ? 0.2 : undefined}
			aria-hidden="true"
			focusable="false"
			style={{ flexShrink: 0 }}
		/>
	);
}

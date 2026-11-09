import { CharacterPicker } from "@/components/character/CharacterPicker";
import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useCharacters } from "@/context/CharacterContext";
import { chatService, historyService, modelService } from "@/services";
import { InferenceAborted } from "@/services/chatService";
import { pickFolder } from "@/services/connectorService";
import { notifyReplyReady } from "@/services/notificationService";
import { saveFileAs } from "@/services/fileService";
import { CHAT_STARTED } from "@/services/historyService";
import type { Character, InferenceEvent } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { accentOf } from "@/utils/characterAccent";
import { cleanResponse } from "@/utils/cleanResponse";
import { readDraft, writeDraft } from "@/utils/drafts";
import { CREATE_INSTRUCTIONS, CREATE_MAX_TOKENS, fenceBareFiles } from "@/utils/fileBlocks";
import { learnedFacts, mergeMemories, undoLearning, withFriendFacts, withMemories } from "@/utils/friendMemory";
import { copyText, isMobile, isTouchPrimary, vibrate } from "@/utils/platform";
import { getPrefs, usePrefs } from "@/utils/prefs";
import { relationshipOf } from "@/utils/persona";
import { useDelayedFlag } from "@/utils/useDelayedFlag";
import { useMediaQuery } from "@/utils/useMediaQuery";
import {
	connectorContext,
	setAllDocsEnabled,
	setFolderEnabled,
	setGmailEnabled,
	setRepoEnabled,
	useConnectors,
	withContext,
} from "@/utils/connectors";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NeurixMark } from "@/components/ui/NeurixLogo";
import { MemoryRing, QueueList, SlashMenu, UserMessage, estimateTokens } from "./chat/ComposerExtras";
import { FileCards } from "./chat/FileCards";
import { FindBar } from "./chat/FindBar";
import { Markdown } from "./chat/Markdown";
import { ModelSelect } from "./chat/ModelSelect";
import { type SlashCommand, matchSlashCommands, recallPrompt } from "./chat/composerKeys";
import {
	type ChatTurnAction,
	type ChatTurnState,
	type TurnRequest,
	chatTurnReducer,
	initialChatTurn,
	isBusy,
	isGenerating as isGeneratingTurn,
	nextQueued,
	runIdOf,
} from "./chat/turn";
import {
	ComposerTools,
	ReadingFill,
	ReadingLine,
	ReadingTrack,
	Reasoning,
	ThinkChip,
	ToolHint,
	ToolLink,
} from "./chat/Reasoning";
import {
	type Message,
	NEW_STYLE_NOTE,
	buildHistory,
	createMessage,
	cutShortLabel,
	fromStored,
	persistable,
	plainEarlierReplies,
	spokenByAnother,
	toConversation,
	wasCutShort,
} from "./chat/messages";
import {
	Bubble,
	BubbleBody,
	ComposerBar,
	FriendAvatar,
	FriendGreeting,
	FriendHero,
	FriendMeta,
	FriendName,
	ComposerBox,
	ComposerChips,
	FolderChip,
	ComposerNote,
	BubbleLabel,
	BubbleWrap,
	CharCounter,
	ChatContainer,
	CoachClose,
	Coachmark,
	ContextNotice,
	ContinueBtn,
	CutShort,
	HeaderAvatar,
	HeaderCharName,
	HeaderPill,
	HeaderTextStack,
	InputBar,
	JumpBtn,
	MessageActions,
	MessagesArea,
	MsgActionBtn,
	PrimaryCta,
	RoundBtn,
	SecondaryCta,
	SourcesLine,
	SpeedBadge,
	StarterChip,
	StartersGrid,
	TextInput,
	TopBarBtn,
	TypingDots,
	Welcome,
	WelcomeText,
	WelcomeTitle,
} from "./chat/styles";

// Soft cap on prompt length. Models choke well before this; it mainly guards
// against an accidental paste of a huge file. Enforced by the textarea.
const MAX_PROMPT_LENGTH = 16_000;
const COACH_KEY = "neurix.coach.subtitle.v2";
const THINK_KEY = "neurix.chat.think";
const CREATE_KEY = "neurix.chat.create";
const CREATE_FOLDER_KEY = "neurix.chat.createFolder";
/** Share of the context window at which the chat is called "nearly full". */
const CONTEXT_WARN_RATIO = 0.85;
/** The usual reply limit, and what a computer can comfortably write instead. */
const USUAL_REPLY_TOKENS = 512;
const DESKTOP_REPLY_TOKENS = 1024;
/** How close to the bottom (px) still counts as "following" the stream. */
const FOLLOW_THRESHOLD = 96;
/** How often a reply in progress is saved, so a crash loses little of it. */
const CHECKPOINT_MS = 8000;
/** A reply this slow is worth a notification when the app is out of sight. */
const NOTIFY_AFTER_MS = 10_000;

/* ── Small pieces ── */

function CopyAction({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	const { showToast } = useToast();

	const handleCopy = async () => {
		if (await copyText(text)) {
			vibrate(5);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} else {
			showToast("Couldn't copy to the clipboard", "error");
		}
	};

	return (
		<MsgActionBtn
			type="button"
			onClick={handleCopy}
			$active={copied}
			title={copied ? "Copied" : "Copy"}
			aria-label={copied ? "Copied" : "Copy"}
		>
			<Icon name={copied ? "check" : "content_copy"} size={15} />
		</MsgActionBtn>
	);
}

interface StarterListProps {
	starters: string[];
	accent: string;
	onPick: (text: string) => void;
	hero?: boolean;
}

function StarterList({ starters, accent, onPick, hero }: StarterListProps) {
	return (
		<StartersGrid $hero={hero}>
			{starters.map((starter) => (
				<StarterChip key={starter} type="button" $accent={accent} onClick={() => onPick(starter)}>
					<span>{starter}</span>
					<Icon name="arrow_outward" size={14} />
				</StarterChip>
			))}
		</StartersGrid>
	);
}

function readStored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStored(key: string, value: string | null) {
	try {
		if (value) localStorage.setItem(key, value);
		else localStorage.removeItem(key);
	} catch {
		// Not persisted: the choice just resets next launch.
	}
}

function readThink(): boolean {
	try {
		return localStorage.getItem(THINK_KEY) === "1";
	} catch {
		return false;
	}
}

/** Speed of the most recent reply, shown under it when the setting is on. */
interface ReplyStats {
	messageId: string;
	tokensPerSecond: number;
	tokens: number;
}

interface RunOptions {
	prompt: string;
	/** Conversation up to, but not including, the prompt being answered. */
	context: Message[];
	/** Existing reply text to extend (the "Continue" action). */
	prefix?: string;
	/** What the reply being extended looked at. */
	used?: string[];
	/** The messages to show again if the reply is stopped before the model is asked. */
	restore?: Message[];
}

/**
 * A friend opens every chat with its greeting, which is shown but is not
 * part of the history the model sees. Tell it what it said, so a reply to
 * the greeting ("good, you?") makes sense.
 */
function withGreeting(character: Character | null | undefined, systemPrompt: string): string {
	const greeting = character?.persona ? character.greeting?.trim() : "";
	return greeting ? `${systemPrompt}\nYou started this chat by saying: "${greeting}"` : systemPrompt;
}

/* ── Component ── */

export function ChatPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { activeModel, activeModelId, activeModelInfo, loadingModelId, settings, loadModel, refreshActiveModel } =
		useAppContext();
	const { activeCharacter, allCharacters, setActiveCharacter, saveCustom, loaded: charactersLoaded } = useCharacters();
	const { showToast } = useToast();
	const prefs = usePrefs();
	const connectors = useConnectors();
	const connectedFolders = connectors.folders;
	const docsOn = connectors.docs.some((d) => d.enabled);

	const [messages, setMessages] = useState<Message[]>([]);
	// Which draft belongs here is known once the chat has opened, unless this
	// is a new chat or one picked from a list.
	const [input, setInput] = useState(() => {
		const opening = location.state as { conversationId?: string; freshChat?: boolean } | null;
		if (opening?.conversationId) return readDraft(opening.conversationId);
		return opening?.freshChat ? readDraft(null) : "";
	});
	// The turn (model, sources, reply) and the queue behind it: see chat/turn.ts.
	// Mirrored in a ref so long-lived callbacks read the state as it is now.
	const [chat, setChat] = useState<ChatTurnState>(initialChatTurn);
	const chatRef = useRef(chat);
	const dispatchTurn = useCallback((action: ChatTurnAction) => {
		const next = chatTurnReducer(chatRef.current, action);
		if (next !== chatRef.current) {
			chatRef.current = next;
			setChat(next);
		}
		return next;
	}, []);
	const { turn, queue, paused: queuePaused } = chat;
	const isGenerating = isGeneratingTurn(turn);
	const busy = isBusy(turn);
	const isLoadingModel = turn.kind === "preparing";
	const loadProblem = turn.kind === "load-failed" ? turn.problem : null;
	/** Percent of the conversation read so far, while that is the wait. */
	const reading = turn.kind === "reading" ? turn.percent : null;
	const [pickerOpen, setPickerOpen] = useState(false);
	const [showCoach, setShowCoach] = useState(false);
	const [streamedText, setStreamedText] = useState("");
	const [streamedReasoning, setStreamedReasoning] = useState("");
	const [thinkOn, setThinkOn] = useState(readThink);
	const [createFolder, setCreateFolder] = useState(() => readStored(CREATE_FOLDER_KEY));
	const [createOn, setCreateOn] = useState(() => !isMobile() && readStored(CREATE_KEY) === "1" && !!createFolder);
	const [replyStats, setReplyStats] = useState<ReplyStats | null>(null);
	const [tokensPerSecond, setTokensPerSecond] = useState(0);
	const [openActionsId, setOpenActionsId] = useState<string | null>(null);
	const [contextNotice, setContextNotice] = useState<string | null>(null);
	const [following, setFollowing] = useState(true);
	const [findOpen, setFindOpen] = useState(false);
	const [slashActive, setSlashActive] = useState(0);
	/** Tokens the last reply reported, so the memory ring needn't estimate. */
	const [reportedTokens, setReportedTokens] = useState(0);
	const showLoading = useDelayedFlag(isLoadingModel);
	const roomy = useMediaQuery(`(min-width: ${tokens.breakpoints.wide})`);

	const scrollRef = useRef<HTMLDivElement>(null);
	const composerRef = useRef<HTMLDivElement>(null);
	const recallRef = useRef<number | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const followingRef = useRef(true);

	// Long-lived callbacks (inference events, unmount cleanup) outlive the
	// render that created them. Everything they need is read through this
	// ref so they always see current values instead of a stale snapshot.
	const live = useRef({
		messages,
		conversationId: null as string | null,
		activeModel,
		activeModelId,
		saveHistory: settings?.save_history ?? false,
		character: activeCharacter,
		modelInfo: activeModelInfo,
		thinkOn,
		createIn: null as string | null,
		/** The model a chat is saved under: the loaded one, or the last one while switching. */
		historyModel: activeModelId && activeModel ? { id: activeModelId, name: activeModel } : null,
		loadingModelId,
	});
	live.current.modelInfo = activeModelInfo;
	live.current.thinkOn = thinkOn;
	live.current.createIn = createOn ? createFolder : null;
	live.current.activeModel = activeModel;
	live.current.activeModelId = activeModelId;
	live.current.loadingModelId = loadingModelId;
	if (activeModelId && activeModel) live.current.historyModel = { id: activeModelId, name: activeModel };
	live.current.saveHistory = settings?.save_history ?? false;
	live.current.character = activeCharacter;

	// Hands out run ids (see chat/turn.ts).
	const runIdRef = useRef(0);
	// False once the page has closed: late events and results are dropped.
	const aliveRef = useRef(true);
	// Ends the wait for a busy model when the reply is stopped.
	const abortRef = useRef<AbortController | null>(null);
	// Tokens arrive faster than the screen refreshes; they are buffered here
	// and flushed to state once per animation frame.
	const streamRef = useRef({ text: "", prefix: "", reasoning: "", frame: 0 });
	// Saves run one at a time, so a slow one can't land over a newer one.
	const saveChainRef = useRef<Promise<void>>(Promise.resolve());

	const characterName = activeCharacter?.name ?? "Neurix";
	const accent = accentOf(activeCharacter);

	/* ── Persistence ── */

	const persist = useCallback((msgs: Message[]) => {
		const s = live.current;
		const toSave = persistable(msgs);
		// Every message deleted: the chat itself goes.
		if (toSave.length === 0) {
			const id = s.conversationId;
			s.conversationId = null;
			if (id) historyService.deleteConversation(id).catch(() => showToast("Couldn't delete this conversation", "error"));
			return;
		}
		const model = s.historyModel;
		if (!s.saveHistory || !model) return;
		if (!s.conversationId) s.conversationId = crypto.randomUUID();
		const conversation = toConversation(toSave, {
			id: s.conversationId,
			modelId: model.id,
			modelName: model.name,
			characterId: s.character?.id,
			characterName: s.character?.name,
		});
		saveChainRef.current = saveChainRef.current
			.then(() => historyService.saveConversation(conversation))
			.catch(() => {
				showToast("Couldn't save this conversation", "error");
			});
	}, [showToast]);

	/** Update the visible list (and the copy long-lived callbacks read). */
	const show = useCallback((next: Message[]) => {
		live.current.messages = next;
		setMessages(next);
	}, []);

	/** Update the list and save it. */
	const commit = useCallback((next: Message[]) => {
		show(next);
		persist(next);
	}, [show, persist]);

	/* ── Scrolling ── */

	const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
		const el = scrollRef.current;
		if (el) el.scrollTo({ top: el.scrollHeight, behavior });
	}, []);

	const handleScroll = () => {
		const el = scrollRef.current;
		if (!el) return;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD;
		followingRef.current = atBottom;
		setFollowing(atBottom);
	};

	// Follow new content only while the reader is already at the bottom, so
	// scrolling up to re-read is never yanked back down by the stream.
	// biome-ignore lint/correctness/useExhaustiveDependencies: must re-run whenever the rendered content grows
	useEffect(() => {
		if (followingRef.current) scrollToBottom();
	}, [messages.length, streamedText, streamedReasoning, isGenerating, scrollToBottom]);

	// Keep the latest message visible when the on-screen keyboard opens.
	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const onResize = () => {
			if (followingRef.current) scrollToBottom();
		};
		vv.addEventListener("resize", onResize);
		return () => vv.removeEventListener("resize", onResize);
	}, [scrollToBottom]);

	const autoResize = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
	}, []);

	// Size the box for a restored draft.
	useEffect(() => {
		autoResize();
	}, [autoResize]);

	/* ── First-run coachmark ── */

	useEffect(() => {
		try {
			if (localStorage.getItem(COACH_KEY)) return;
		} catch {
			return;
		}
		const t = setTimeout(() => setShowCoach(true), 800);
		return () => clearTimeout(t);
	}, []);

	const dismissCoach = useCallback(() => {
		setShowCoach(false);
		try {
			localStorage.setItem(COACH_KEY, new Date().toISOString());
		} catch {
			// Not persisted: the tip shows again next launch, which is harmless.
		}
	}, []);

	useEffect(() => {
		if (!showCoach) return;
		const t = setTimeout(dismissCoach, 6000);
		return () => clearTimeout(t);
	}, [showCoach, dismissCoach]);

	/* ── Character change notice ── */

	const lastCharIdRef = useRef<string | null>(null);
	const suppressCharToastRef = useRef(false);
	useEffect(() => {
		const prev = lastCharIdRef.current;
		const next = activeCharacter?.id ?? null;
		lastCharIdRef.current = next;
		if (suppressCharToastRef.current) {
			suppressCharToastRef.current = false;
			return;
		}
		if (prev && next && prev !== next && live.current.messages.length > 0) {
			showToast(`Now using ${activeCharacter?.name}. The next reply will use this style.`, "info");
		}
	}, [activeCharacter?.id, activeCharacter?.name, showToast]);

	/* ── Loading a conversation ── */

	const openedRef = useRef(false);
	useEffect(() => {
		// Wait for characters so a conversation's character can be restored.
		if (openedRef.current || !charactersLoaded) return;
		openedRef.current = true;

		const state = location.state as { conversationId?: string; freshChat?: boolean } | null;
		if (state?.freshChat) return;

		(async () => {
			try {
				// Open the requested conversation, or pick up the most recent one.
				const id = state?.conversationId ?? (await historyService.getConversations())[0]?.id;
				if (!id) {
					setInput((typed) => typed || readDraft(null));
					return;
				}
				const conv = await historyService.loadConversation(id);
				// Don't overwrite a conversation the user already started here.
				if (!conv || live.current.messages.length > 0) return;

				live.current.conversationId = conv.id;
				show(fromStored(conv.messages));
				// Anything typed while the chat was opening stays.
				setInput((typed) => typed || readDraft(conv.id));

				// A conversation continues with the character it was held with.
				const convCharacter = conv.character_id;
				if (
					convCharacter &&
					convCharacter !== live.current.character?.id &&
					allCharacters.some((c) => c.id === convCharacter)
				) {
					suppressCharToastRef.current = true;
					await setActiveCharacter(convCharacter).catch(() => {
						suppressCharToastRef.current = false;
					});
				}
			} catch {
				if (state?.conversationId) showToast("Couldn't open that conversation", "error");
			}
		})();
	}, [charactersLoaded, location.state, allCharacters, setActiveCharacter, showToast, show]);

	/* ── Inference ── */

	const flushStream = useCallback(() => {
		const s = streamRef.current;
		s.frame = 0;
		setStreamedText(s.prefix + s.text);
		setStreamedReasoning(s.reasoning);
	}, []);

	const resetStream = useCallback(() => {
		if (streamRef.current.frame) cancelAnimationFrame(streamRef.current.frame);
		streamRef.current = { text: "", prefix: "", reasoning: "", frame: 0 };
		setStreamedText("");
		setStreamedReasoning("");
	}, []);

	const run = useCallback(async ({ prompt, context, prefix = "", used = [], restore }: RunOptions) => {
		const character = live.current.character;
		let lookedAt = used;
		let thinkingFrom = 0;
		let thoughtMs = 0;
		let savedAt = Date.now();
		const startedAt = Date.now();
		const runId = ++runIdRef.current;
		// Only the run the turn is in may act; a stopped or superseded run, or
		// one whose page has closed, is ignored.
		const isCurrent = () => aliveRef.current && runIdOf(chatRef.current.turn) === runId;
		// Refused when another turn is under way: then this one does nothing.
		if (runIdOf(dispatchTurn({ type: "RUN_STARTED", runId }).turn) !== runId) return;
		const abort = new AbortController();
		abortRef.current = abort;

		resetStream();
		streamRef.current.prefix = prefix;
		if (prefix) setStreamedText(prefix);
		setTokensPerSecond(0);
		followingRef.current = true;
		setFollowing(true);

		// A run finishes exactly once, whichever of the event or the
		// rejection reports the end first.
		let finished = false;
		const finish = (extra: Message[], failed = false) => {
			if (finished) return;
			finished = true;
			resetStream();
			dispatchTurn({ type: "RUN_ENDED", runId, failed });
			if (extra.length > 0) commit([...live.current.messages, ...extra]);
		};

		// A stop pressed before the backend had started the reply found
		// nothing to stop; the first sign of life gets it again.
		let stopResent = false;
		const handleEvent = (event: InferenceEvent) => {
			if (!isCurrent()) return;
			if (chatRef.current.turn.kind === "stopping" && !stopResent) {
				stopResent = true;
				chatService.stopInference().catch(() => {});
			}
			switch (event.event) {
				case "PromptProgress":
					dispatchTurn({
						type: "PROMPT_PROGRESS",
						runId,
						percent: Math.round((event.data.processed / Math.max(event.data.total, 1)) * 100),
					});
					break;
				case "ReasoningGenerated": {
					const s = streamRef.current;
					s.reasoning += event.data.token;
					if (!s.frame) s.frame = requestAnimationFrame(flushStream);
					dispatchTurn({ type: "TOKEN", runId });
					if (!thinkingFrom) thinkingFrom = Date.now();
					break;
				}
				case "TokenGenerated": {
					const s = streamRef.current;
					s.text += event.data.token;
					if (!s.frame) s.frame = requestAnimationFrame(flushStream);
					dispatchTurn({ type: "TOKEN", runId });
					setTokensPerSecond(event.data.tokens_per_second);
					if (thinkingFrom && !thoughtMs) thoughtMs = Date.now() - thinkingFrom;
					// Saved as it goes, so a crash or a killed app keeps the reply.
					if (Date.now() - savedAt > CHECKPOINT_MS) {
						savedAt = Date.now();
						const partial = cleanResponse(s.prefix + s.text);
						const checkpoint = createMessage("ai", partial, {
							stopReason: "cancelled",
							reasoning: s.reasoning.trim() || undefined,
							sources: lookedAt,
							thoughtMs,
						});
						persist([...live.current.messages, checkpoint]);
					}
					break;
				}
				case "GenerationComplete": {
					const { total_tokens, duration_ms, stop_reason, prompt_tokens } = event.data;
					const cleaned = cleanResponse(streamRef.current.prefix + streamRef.current.text);
					const reasoning = streamRef.current.reasoning.trim();
					const speed = duration_ms > 0 ? total_tokens / (duration_ms / 1000) : 0;

					if (cleaned) {
						const createIn = live.current.createIn ?? undefined;
						const reply = createMessage("ai", createIn ? fenceBareFiles(cleaned, stop_reason === "eos") : cleaned, {
							stopReason: stop_reason,
							reasoning: reasoning || undefined,
							createIn,
							sources: lookedAt,
							characterId: character?.id,
							thoughtMs,
						});
						if (speed > 0) {
							setReplyStats({ messageId: reply.id, tokensPerSecond: speed, tokens: total_tokens });
						}
						finish([reply]);
						if (getPrefs().autoCopy && stop_reason !== "cancelled") void copyText(cleaned);
						const away = document.hidden || !document.hasFocus();
						if (away && getPrefs().notifyReplies && Date.now() - startedAt > NOTIFY_AFTER_MS) {
							void notifyReplyReady(character?.name ?? "Neurix");
						}
					} else if (reasoning && stop_reason !== "cancelled") {
						// The whole reply budget went on thinking.
						finish([
							createMessage(
								"error",
								"The model ran out of room while thinking and never reached an answer. Try again, or ask a narrower question.",
							),
						]);
					} else {
						finish([]);
					}

					setReportedTokens(prompt_tokens + total_tokens);
					const contextWindow = live.current.modelInfo?.context_length ?? 0;
					if (contextWindow > 0 && (prompt_tokens + total_tokens) / contextWindow >= CONTEXT_WARN_RATIO) {
						setContextNotice(
							"This chat has nearly filled the model's memory. Older messages will start to drop. A new chat keeps answers sharp.",
						);
						setTimeout(() => setContextNotice(null), 8000);
					}
					break;
				}
				case "ContextTrimmed": {
					const n = event.data.pairs_dropped;
					setContextNotice(
						`Long chat: the ${n} oldest exchange${n === 1 ? "" : "s"} no longer fit in the model's memory.`,
					);
					setTimeout(() => setContextNotice(null), 5000);
					break;
				}
				case "Error":
					finish([createMessage("error", event.data.message)], true);
					break;
			}
		};

		try {
			// Continuing a reply reads no sources, so it goes straight to the model.
			const sources = prefix ? null : await connectorContext(prompt);
			if (!isCurrent()) {
				// Stopped while the sources were read: the model was never asked,
				// so the chat goes back to how it was.
				if (aliveRef.current) {
					resetStream();
					if (restore) show(restore);
				}
				return;
			}
			for (const warning of sources?.warnings ?? []) showToast(warning, "error");
			if (sources) lookedAt = sources.used;
			const asked = withFriendFacts(character, prompt);
			const styled = spokenByAnother(context, character?.id) ? `${asked}\n\n${NEW_STYLE_NOTE}` : asked;
			const usual = character?.max_tokens ?? settings?.max_tokens ?? USUAL_REPLY_TOKENS;
			const replyLimit = !isMobile() && !character?.persona && usual === USUAL_REPLY_TOKENS ? DESKTOP_REPLY_TOKENS : usual;
			dispatchTurn({ type: "INFERENCE_STARTED", runId });
			await chatService.runInference(
				{
					prompt: withContext(sources?.text ?? "", styled, sources?.noMatch),
					systemPrompt: [
						withGreeting(character, character?.system_prompt ?? settings?.system_prompt ?? ""),
						...(live.current.createIn ? [CREATE_INSTRUCTIONS] : []),
					].join("\n"),
					history: buildHistory(plainEarlierReplies(context, character?.id)),
					temperature: character?.temperature ?? settings?.temperature ?? 0.7,
					topP: character?.top_p ?? settings?.top_p ?? 0.9,
					maxTokens: Math.max(replyLimit, live.current.createIn ? CREATE_MAX_TOKENS : 0),
					assistantPrefix: prefix || undefined,
					enableThinking: live.current.thinkOn && live.current.modelInfo?.reasoning === "optional",
				},
				handleEvent,
				abort.signal,
			);
		} catch (err) {
			if (finished || !isCurrent()) return;
			// Keep whatever had streamed before the failure.
			const partial = cleanResponse(streamRef.current.prefix + streamRef.current.text);
			if (err instanceof InferenceAborted) {
				// Stopped while waiting for the model to come free: nothing ran.
				finish(partial ? [createMessage("ai", partial, { stopReason: "cancelled" })] : []);
				return;
			}
			const message = err instanceof Error ? err.message : String(err);
			finish([...(partial ? [createMessage("ai", partial)] : []), createMessage("error", message)], true);
			// A failed run can leave the backend without a model; resync so the
			// header and the next send reflect that.
			refreshActiveModel();
		} finally {
			if (abortRef.current === abort) abortRef.current = null;
		}
	}, [commit, persist, show, flushStream, resetStream, dispatchTurn, refreshActiveModel, showToast, settings?.system_prompt, settings?.temperature, settings?.top_p, settings?.max_tokens]);

	/**
	 * Make sure a model is loaded, loading the last-used one if needed. While
	 * it loads the turn is "preparing"; if it can't, the turn shows why and
	 * keeps `request` for Try again.
	 */
	const ensureModel = useCallback(async (request: TurnRequest): Promise<boolean> => {
		if (live.current.activeModelId) return true;
		if (dispatchTurn({ type: "PREPARE", request }).turn.kind !== "preparing") return false;
		try {
			// A load already under way (a switch from the picker, say) is
			// joined rather than started twice.
			const pending = live.current.loadingModelId;
			if (pending) {
				await loadModel(pending);
				const ready = await refreshActiveModel();
				if (ready) {
					live.current.activeModelId = ready.id;
					live.current.activeModel = ready.name;
					return true;
				}
			}
			const installed = await modelService.getDownloadedModels();
			if (installed.length === 0) {
				dispatchTurn({ type: "PREPARE_FAILED", problem: { kind: "no-models" } });
				return false;
			}
			const preferred = installed.find((m) => m.id === settings?.last_model_id) ?? installed[0];
			await loadModel(preferred.id);
			live.current.activeModelId = preferred.id;
			live.current.activeModel = preferred.name;
			live.current.historyModel = { id: preferred.id, name: preferred.name };
			return true;
		} catch (err) {
			dispatchTurn({
				type: "PREPARE_FAILED",
				problem: { kind: "failed", message: err instanceof Error ? err.message : String(err) },
			});
			return false;
		}
	}, [dispatchTurn, loadModel, refreshActiveModel, settings?.last_model_id]);

	/** Keep what a message says about the user, if a friend is listening. */
	const learnFrom = (text: string) => {
		const friend = live.current.character;
		if (!friend?.persona || friend.is_preset || !getPrefs().friendsLearn) return;
		const { memories, added, replaced } = mergeMemories(friend.persona.memories, learnedFacts(text));
		if (added.length === 0) return;
		saveCustom(withMemories(friend, memories))
			.then(() =>
				showToast(`${friend.name} will remember: ${added.join("; ")}`, "info", {
					label: "Undo",
					onAction: () => {
						const current = live.current.character;
						const latest = current?.id === friend.id ? current : friend;
						const left = undoLearning(latest.persona?.memories ?? [], added, replaced);
						saveCustom(withMemories(latest, left)).catch(() => showToast("Couldn't undo that", "error"));
					},
				}),
			)
			.catch(() => {
				// Not saved: the chat goes on, and the fact stays in this conversation.
			});
	};

	const clearComposer = () => {
		setInput("");
		writeDraft(live.current.conversationId, "");
		recallRef.current = null;
		if (textareaRef.current) textareaRef.current.style.height = "auto";
	};

	/**
	 * Send one message. If no model can be made ready, the turn shows why;
	 * a message typed in the box stays there, a queued one waits in the
	 * failure screen (and goes back to the queue on Dismiss).
	 */
	const sendMessage = async (text: string, fromComposer: boolean): Promise<void> => {
		vibrate(10);
		// No await when a model is ready, so the turn is busy before anything else can run.
		if (!live.current.activeModelId && !(await ensureModel({ kind: "send", text, fromComposer }))) return;

		// Loading can take a while: anything typed meanwhile stays in the box.
		if (fromComposer && textareaRef.current?.value.trim() === text) clearComposer();
		const context = live.current.messages;
		const sent = [...context, createMessage("user", text)];
		show(sent);
		// List a new chat in the sidebar right away, before the reply.
		if (live.current.saveHistory && !live.current.conversationId) {
			live.current.conversationId = crypto.randomUUID();
			window.dispatchEvent(
				new CustomEvent(CHAT_STARTED, {
					detail: { id: live.current.conversationId, title: text.slice(0, 80) },
				}),
			);
		}
		// Saved now, so a stopped or failed reply can't lose the message.
		persist(sent);
		learnFrom(text);
		setOpenActionsId(null);
		await run({ prompt: text, context });
	};

	/** The model is busy: this one waits its turn, and the box is free again. */
	const queueMessage = (text: string) => {
		dispatchTurn({ type: "QUEUE_ADD", item: { id: crypto.randomUUID(), text } });
		clearComposer();
	};

	const handleSend = () => {
		const text = input.trim();
		if (!text || isLoadingModel || loadingModelId) return;
		const now = chatRef.current;
		if (isBusy(now.turn) || now.queue.length > 0) queueMessage(text);
		else void sendMessage(text, true);
	};

	// Send what is waiting, one message each time the chat comes free.
	// biome-ignore lint/correctness/useExhaustiveDependencies: sendMessage is rebuilt each render and only runs on these changes
	useEffect(() => {
		const next = nextQueued(chat, loadingModelId !== null);
		if (!next) return;
		dispatchTurn({ type: "QUEUE_REMOVE", id: next.id });
		void sendMessage(next.text, false);
	}, [chat, loadingModelId, dispatchTurn]);

	const handleStop = () => {
		vibrate(12);
		const before = chatRef.current.turn;
		dispatchTurn({ type: "STOP" });
		if (before.kind === "starting" || before.kind === "reading" || before.kind === "streaming") {
			abortRef.current?.abort();
			chatService.stopInference().catch(() => {});
		}
	};

	/** The last AI reply and the user message it answers, if the chat ends with one. */
	const lastExchange = () => {
		const msgs = live.current.messages;
		const aiIdx = msgs.length - 1;
		if (aiIdx < 1 || msgs[aiIdx].role !== "ai") return null;
		for (let i = aiIdx - 1; i >= 0; i--) {
			if (msgs[i].role === "user") return { msgs, userIdx: i, aiIdx };
		}
		return null;
	};

	/** Re-answer the last prompt; with `extend`, keep the reply and continue it. */
	const redoLast = async (extend: boolean) => {
		// Checked synchronously: a double tap must not start two turns.
		if (isBusy(chatRef.current.turn) || !lastExchange()) return;
		if (!live.current.activeModelId && !(await ensureModel({ kind: "redo", extend }))) return;
		const ex = lastExchange();
		if (!ex) {
			dispatchTurn({ type: "CANCEL_PREPARE" });
			return;
		}
		const { msgs, userIdx, aiIdx } = ex;
		show(msgs.slice(0, aiIdx));
		setOpenActionsId(null);
		await run({
			prompt: msgs[userIdx].text,
			context: msgs.slice(0, userIdx),
			prefix: extend ? msgs[aiIdx].text : undefined,
			used: extend ? msgs[aiIdx].sources : undefined,
			restore: msgs,
		});
	};

	/** "Try again" after a failed load: repeat exactly what was asked. */
	const retryTurn = () => {
		const turn = chatRef.current.turn;
		if (turn.kind !== "load-failed") return;
		const { request } = turn;
		if (request.kind === "send") void sendMessage(request.text, request.fromComposer);
		else void redoLast(request.extend);
	};

	const dismissLoadProblem = () => dispatchTurn({ type: "DISMISS", requeueId: crypto.randomUUID() });

	const handleDeleteMessage = (id: string) => {
		const before = live.current.messages;
		const target = before.find((m) => m.id === id);
		commit(before.filter((m) => m.id !== id));
		setOpenActionsId(null);
		if (target && target.role !== "error") {
			showToast("Message deleted", "info", { label: "Undo", onAction: () => commit(before) });
		}
	};

	/**
	 * Edit-and-resend a user message: drops it and everything after it, and
	 * puts its text back in the input. Editing a turn invalidates every
	 * reply that depended on it.
	 */
	const handleEditMessage = (id: string) => {
		if (isBusy(chatRef.current.turn)) return;
		const msgs = live.current.messages;
		const idx = msgs.findIndex((m) => m.id === id);
		if (idx < 0 || msgs[idx].role !== "user") return;
		setOpenActionsId(null);
		// Editing the first message empties the view but keeps the saved chat
		// until the new text is sent, so changing your mind loses nothing.
		if (idx === 0) show([]);
		else commit(msgs.slice(0, idx));
		fillInput(msgs[idx].text);
	};

	const handleShareChat = async () => {
		const text = persistable(messages)
			.map((m) => `${m.role === "user" ? "You" : characterName}: ${m.text}`)
			.join("\n\n");
		if (!text) return;

		if (navigator.share) {
			try {
				await navigator.share({ title: "Neurix chat", text });
				return;
			} catch (err) {
				// Dismissing the share sheet is not an error worth a fallback.
				if (err instanceof Error && err.name === "AbortError") return;
			}
		}
		if (await copyText(text)) showToast("Conversation copied to the clipboard", "success");
		else showToast("Couldn't copy the conversation", "error");
	};

	// The same route the sidebar takes, which also clears the Recents highlight.
	const handleNewChat = () => navigate("/chat", { state: { freshChat: true } });

	// Leaving mid-generation: stop the model and keep what it wrote so far
	// in the same conversation (if history is on).
	useEffect(() => {
		aliveRef.current = true;
		return () => {
			aliveRef.current = false;
			const { turn, queue: waitingItems } = chatRef.current;
			// Messages still waiting go back to the draft rather than vanish,
			// including one held by a failed model load.
			const held =
				turn.kind === "load-failed" && turn.request.kind === "send" && !turn.request.fromComposer
					? [turn.request.text]
					: [];
			const waiting = [...held, ...waitingItems.map((item) => item.text)];
			if (waiting.length > 0) {
				const draft = readDraft(live.current.conversationId);
				writeDraft(live.current.conversationId, [draft, ...waiting].filter(Boolean).join("\n\n"));
			}
			if (!isGeneratingTurn(turn)) return;
			abortRef.current?.abort();
			chatService.stopInference().catch(() => {});
			const s = streamRef.current;
			const partial = cleanResponse(s.prefix + s.text);
			if (partial) persist([...live.current.messages, createMessage("ai", partial)]);
		};
	}, [persist]);

	/* ── Input handling ── */

	const updateInput = (text: string) => {
		setInput(text);
		writeDraft(live.current.conversationId, text);
		requestAnimationFrame(autoResize);
	};

	const slashCommands = matchSlashCommands(input, !isMobile());
	const slashIndex = Math.min(slashActive, Math.max(0, slashCommands.length - 1));

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.nativeEvent.isComposing) return;

		if (slashCommands.length > 0) {
			const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
			if (step !== 0) {
				e.preventDefault();
				setSlashActive((slashIndex + step + slashCommands.length) % slashCommands.length);
				return;
			}
			if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
				e.preventDefault();
				runSlashCommand(slashCommands[slashIndex]);
				return;
			}
			if (e.key === "Escape") {
				e.preventDefault();
				updateInput("");
				return;
			}
		}

		if (e.key === "Escape" && isGenerating) {
			e.preventDefault();
			handleStop();
			return;
		}

		if (e.key === "ArrowUp" || e.key === "ArrowDown") {
			const box = e.currentTarget;
			const end = box.value.length;
			const collapsed = box.selectionStart === box.selectionEnd;
			const onRecalled = recallRef.current !== null;
			const recalled = recallPrompt({
				key: e.key,
				input,
				caretAtStart: collapsed && (box.selectionStart === 0 || (onRecalled && box.selectionStart === end)),
				caretAtEnd: collapsed && (box.selectionStart === end || (onRecalled && box.selectionStart === 0)),
				history: live.current.messages.filter((m) => m.role === "user").map((m) => m.text),
				index: recallRef.current,
			});
			if (recalled) {
				e.preventDefault();
				recallRef.current = recalled.index;
				updateInput(recalled.text);
				return;
			}
		}

		// With a hardware keyboard, Enter sends and Shift+Enter breaks the
		// line. On touch keyboards Enter is the only way to add a line, so it
		// inserts one and the send button sends.
		if (e.key !== "Enter" || e.shiftKey || isTouchPrimary()) return;
		if (prefs.enterSends || e.metaKey || e.ctrlKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleLongPressStart = (id: string) => {
		longPressRef.current = setTimeout(() => {
			vibrate(15);
			setOpenActionsId((prev) => (prev === id ? null : id));
		}, 400);
	};

	const handleLongPressEnd = () => {
		if (longPressRef.current) {
			clearTimeout(longPressRef.current);
			longPressRef.current = null;
		}
	};

	const fillInput = (text: string) => {
		setInput(text);
		writeDraft(live.current.conversationId, text);
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
			autoResize();
		});
	};

	const runSlashCommand = (command: SlashCommand) => {
		updateInput("");
		setSlashActive(0);
		switch (command.id) {
			case "new":
				handleNewChat();
				break;
			case "think":
				if (activeModelInfo?.reasoning === "optional") toggleThink();
				else showToast("This model can't switch thinking on or off", "info");
				break;
			case "create":
				void toggleCreate();
				break;
			case "model":
				setPickerOpen(true);
				break;
			case "find":
				setFindOpen(true);
				break;
			case "history":
				navigate("/chat/history");
				break;
			case "connectors":
				navigate("/connectors");
				break;
			case "settings":
				navigate("/settings");
				break;
		}
	};

	const toggleThink = () => {
		const next = !thinkOn;
		setThinkOn(next);
		vibrate(5);
		try {
			if (next) localStorage.setItem(THINK_KEY, "1");
			else localStorage.removeItem(THINK_KEY);
		} catch {
			// Not persisted: the choice just resets next launch.
		}
	};

	const chooseCreateFolder = async () => {
		try {
			const folder = await pickFolder();
			if (folder) {
				setCreateFolder(folder);
				writeStored(CREATE_FOLDER_KEY, folder);
			}
			return folder;
		} catch (err) {
			showToast(err instanceof Error ? err.message : String(err), "error");
			return null;
		}
	};

	const toggleCreate = async () => {
		vibrate(5);
		const next = !createOn && !!(createFolder ?? (await chooseCreateFolder()));
		setCreateOn(next);
		writeStored(CREATE_KEY, next ? "1" : null);
	};

	const saveReply = async (text: string) => {
		try {
			const path = await saveFileAs("reply.md", text);
			if (path) showToast(`Saved to ${path}`, "success");
		} catch (err) {
			showToast(err instanceof Error ? err.message : String(err), "error");
		}
	};

	// Ctrl+F finds in this chat, and Esc stops a reply from anywhere. Typing
	// anywhere goes to the message box, so there's nothing to click first.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "f") {
				e.preventDefault();
				setFindOpen(true);
				return;
			}
			const target = e.target as HTMLElement | null;
			const typing = !!target?.closest("input, textarea, select, [contenteditable='true']");
			if (typing || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
			if (isTouchPrimary() || document.querySelector("[role=dialog], [role=alertdialog], [role=menu]")) return;
			textareaRef.current?.focus();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	const canThink = activeModelInfo?.reasoning === "optional";
	const lastId = messages[messages.length - 1]?.id;
	const hasText = input.trim().length > 0;
	const showStream = isGenerating || streamedText.length > 0 || streamedReasoning.length > 0;
	const starters = prefs.showStarters ? (activeCharacter?.conversation_starters?.slice(0, 4) ?? []) : [];
	// An empty chat on a computer: the message box sits in the middle, with the
	// greeting above it. Phones keep it at the bottom, by the keyboard.
	const hero = roomy && messages.length === 0 && !showStream;
	const memoryUsed = reportedTokens || estimateTokens(messages.map((m) => m.text));

	// The box glides down to its place when the first message goes out.
	const composerTop = useRef<number | null>(null);
	useLayoutEffect(() => {
		const box = composerRef.current;
		if (!box) return;
		const top = box.getBoundingClientRect().top;
		const moved = composerTop.current === null ? 0 : composerTop.current - top;
		composerTop.current = top;
		if (hero || Math.abs(moved) < 40 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		box.animate([{ transform: `translateY(${moved}px)` }, { transform: "none" }], {
			duration: 260,
			easing: "cubic-bezier(0.4, 0, 0.2, 1)",
		});
	}, [hero]);

	return (
		<>
			{showLoading && (
				<LoadingOverlay title="Loading model" subtitle="This can take a few seconds…" />
			)}
			{!isLoadingModel && loadProblem?.kind === "failed" && (
				<LoadingOverlay
					title="Couldn't load the model"
					subtitle={loadProblem.message}
					icon={<Icon name="error_outline" size={40} color={tokens.colors.error} />}
				>
					<PrimaryCta
						type="button"
						onClick={retryTurn}
					>
						<Icon name="refresh" size={16} />
						Try again
					</PrimaryCta>
					<SecondaryCta type="button" onClick={() => navigate("/models")}>
						Choose another model
					</SecondaryCta>
					<SecondaryCta type="button" onClick={dismissLoadProblem}>
						Dismiss
					</SecondaryCta>
				</LoadingOverlay>
			)}
			{!isLoadingModel && loadProblem?.kind === "no-models" && (
				<LoadingOverlay
					title="No model installed yet"
					subtitle="Neurix needs a model on this device to reply. Your message is kept. Download a model and come back."
					icon={<Icon name="deployed_code" size={40} color={tokens.colors.primary} />}
				>
					<PrimaryCta type="button" onClick={() => navigate("/store")}>
						<Icon name="download" size={16} />
						Browse models
					</PrimaryCta>
					<SecondaryCta type="button" onClick={dismissLoadProblem}>
						Not now
					</SecondaryCta>
				</LoadingOverlay>
			)}

			<AppLayout
				hideLogo
				subtitle={
					<HeaderPill
						type="button"
						onClick={() => {
							dismissCoach();
							setPickerOpen(true);
						}}
						aria-label={`Character: ${characterName}. Model: ${activeModel ?? "none loaded"}. Change character or model.`}
					>
						<HeaderAvatar $accent={accent}>
							<Icon name={activeCharacter?.icon || "smart_toy"} size={15} />
						</HeaderAvatar>
						<HeaderTextStack>
							<HeaderCharName>
								<span>{characterName}</span>
								<Icon name="expand_more" size={14} color={tokens.colors.onSurfaceVariant} />
							</HeaderCharName>
						</HeaderTextStack>
					</HeaderPill>
				}
				rightActions={
					<>
						{messages.length > 0 && (
							<TopBarBtn type="button" onClick={handleShareChat} aria-label="Share chat">
								<Icon name="share" size={18} />
							</TopBarBtn>
						)}
						<TopBarBtn type="button" onClick={handleNewChat} aria-label="New chat">
							<Icon name="edit_square" size={18} />
						</TopBarBtn>
						<TopBarBtn type="button" onClick={() => navigate("/chat/history")} aria-label="Chat history">
							<Icon name="history" size={18} />
						</TopBarBtn>
					</>
				}
			>
				<ChatContainer $hero={hero}>
					{findOpen && (
						<FindBar
							root={scrollRef}
							version={messages.length}
							onClose={() => {
								setFindOpen(false);
								textareaRef.current?.focus();
							}}
						/>
					)}
					<MessagesArea ref={scrollRef} onScroll={handleScroll} $wide={prefs.chatWidth === "wide"} $hero={hero}>
						{messages.length === 0 && !showStream && activeCharacter?.persona && (
							<Welcome $hero={hero}>
								<FriendHero>
									<FriendAvatar $accent={accent}>
										<Icon name={activeCharacter.icon || "person"} size={30} />
									</FriendAvatar>
									<FriendName>{characterName}</FriendName>
									<FriendMeta>
										{relationshipOf(activeCharacter.persona).label}
										{activeCharacter.description ? ` · ${activeCharacter.description}` : ""}
									</FriendMeta>
								</FriendHero>
								{activeCharacter.greeting && (
									<FriendGreeting $accent={accent}>{activeCharacter.greeting}</FriendGreeting>
								)}
								{!hero && starters.length > 0 && (
									<StarterList starters={starters} accent={accent} onPick={fillInput} />
								)}
							</Welcome>
						)}

						{messages.length === 0 && !showStream && !activeCharacter?.persona && (
							<Welcome $hero={hero}>
								<WelcomeTitle>
									<NeurixMark size={30} />
									<span>{activeCharacter?.greeting || `Chat with ${characterName}`}</span>
								</WelcomeTitle>
								<WelcomeText>
									{activeCharacter?.description
										? `${activeCharacter.description}. Everything stays on this device.`
										: "Ask anything. Everything stays on this device."}
								</WelcomeText>
								{!hero && starters.length > 0 && (
									<StarterList starters={starters} accent={accent} onPick={fillInput} />
								)}
							</Welcome>
						)}

						{contextNotice && (
							<ContextNotice role="status">
								<Icon name="info" size={14} />
								{contextNotice}
							</ContextNotice>
						)}

						{messages.map((msg) => {
							const isLast = msg.id === lastId;
							const labelColor =
								msg.role === "ai"
									? accent
									: msg.role === "error"
										? tokens.colors.error
										: tokens.colors.onSurfaceVariant;
							const label =
								msg.role === "ai" ? characterName : msg.role === "error" ? "Something went wrong" : "You";
							return (
								<BubbleWrap key={msg.id} $role={msg.role}>
									<Bubble
										$role={msg.role}
										onTouchStart={() => handleLongPressStart(msg.id)}
										onTouchEnd={handleLongPressEnd}
										onTouchMove={handleLongPressEnd}
										onTouchCancel={handleLongPressEnd}
									>
										{msg.role === "error" && (
											<BubbleLabel $color={labelColor}>
												<Icon name="error_outline" size={12} />
												{label}
											</BubbleLabel>
										)}
										<BubbleBody>
											{msg.role === "ai" && msg.reasoning && (
												<Reasoning text={msg.reasoning} durationMs={msg.thoughtMs} />
											)}
											{msg.role === "ai" ? <Markdown text={msg.text} /> : <UserMessage text={msg.text} expanded={findOpen} />}
											{msg.role === "ai" && msg.createIn && <FileCards text={msg.text} folder={msg.createIn} />}
											{msg.role === "ai" && msg.sources && (
												<SourcesLine>
													<Icon name="description" size={13} />
													<span>Looked at {msg.sources.join(", ")}</span>
												</SourcesLine>
											)}
										</BubbleBody>
										{settings?.show_speed && replyStats?.messageId === msg.id && (
											<SpeedBadge>
												{replyStats.tokensPerSecond.toFixed(1)} tok/s · {replyStats.tokens} tokens
											</SpeedBadge>
										)}
									</Bubble>

									{msg.role === "ai" && isLast && !busy && wasCutShort(msg.stopReason) && (
										<CutShort>
											<span>{cutShortLabel(msg.stopReason)}</span>
											<ContinueBtn type="button" onClick={() => redoLast(true)}>
												<Icon name="play_arrow" size={12} />
												Continue
											</ContinueBtn>
										</CutShort>
									)}

									{!busy && (
										<MessageActions $open={openActionsId === msg.id}>
											{msg.role !== "error" && <CopyAction text={msg.text} />}
											{msg.role === "ai" && !isMobile() && (
												<MsgActionBtn
													type="button"
													onClick={() => saveReply(msg.text)}
													title="Save as file"
													aria-label="Save reply as a file"
												>
													<Icon name="download" size={15} />
												</MsgActionBtn>
											)}
											{msg.role === "user" && (
												<MsgActionBtn
													type="button"
													onClick={() => handleEditMessage(msg.id)}
													title="Edit"
													aria-label="Edit"
												>
													<Icon name="edit" size={15} />
												</MsgActionBtn>
											)}
											{msg.role === "ai" && isLast && (
												<MsgActionBtn
													type="button"
													onClick={() => redoLast(false)}
													title="Retry"
													aria-label="Retry"
												>
													<Icon name="restart_alt" size={15} />
												</MsgActionBtn>
											)}
											<MsgActionBtn
												type="button"
												onClick={() => handleDeleteMessage(msg.id)}
												title={msg.role === "error" ? "Dismiss" : "Delete"}
												aria-label={msg.role === "error" ? "Dismiss" : "Delete"}
											>
												<Icon name="delete" size={15} />
											</MsgActionBtn>
										</MessageActions>
									)}
								</BubbleWrap>
							);
						})}

						{showStream && (
							<BubbleWrap $role="ai">
								<Bubble $role="ai">
									<BubbleBody>
										{streamedReasoning && <Reasoning text={streamedReasoning} live={!streamedText} />}
										{streamedText ? (
											<Markdown text={streamedText} />
										) : streamedReasoning ? null : reading !== null ? (
											<ReadingLine role="status">
												Reading the conversation… {reading}%
												<ReadingTrack>
													<ReadingFill $percent={reading} />
												</ReadingTrack>
											</ReadingLine>
										) : (
											<TypingDots role="status" aria-label="Generating a reply">
												<span />
												<span />
												<span />
											</TypingDots>
										)}
									</BubbleBody>
									{settings?.show_speed && tokensPerSecond > 0 && (
										<SpeedBadge>{tokensPerSecond.toFixed(1)} tok/s</SpeedBadge>
									)}
								</Bubble>
							</BubbleWrap>
						)}
					</MessagesArea>

					{!following && (messages.length > 0 || showStream) && (
						<JumpBtn
							type="button"
							onClick={() => {
								followingRef.current = true;
								setFollowing(true);
								scrollToBottom("smooth");
							}}
						>
							<Icon name="arrow_downward" size={14} />
							{isGenerating ? "Follow reply" : "Latest"}
						</JumpBtn>
					)}

					<InputBar>
						<QueueList
							items={queue}
							paused={queuePaused}
							onEdit={(item) => {
								dispatchTurn({ type: "QUEUE_REMOVE", id: item.id });
								fillInput(item.text);
							}}
							onRemove={(id) => dispatchTurn({ type: "QUEUE_REMOVE", id })}
							onResume={() => dispatchTurn({ type: "QUEUE_RESUME" })}
						/>
						<ComposerBox ref={composerRef}>
							{slashCommands.length > 0 && (
								<SlashMenu
									commands={slashCommands}
									active={slashIndex}
									onPick={runSlashCommand}
									onHover={setSlashActive}
								/>
							)}
							<TextInput
								ref={textareaRef}
								value={input}
								onChange={(e) => {
									recallRef.current = null;
									setSlashActive(0);
									updateInput(e.target.value);
								}}
								onKeyDown={handleKeyDown}
								placeholder={`Message ${characterName}…`}
								aria-label="Message"
								rows={1}
								maxLength={MAX_PROMPT_LENGTH}
								enterKeyHint={isTouchPrimary() ? "enter" : "send"}
							/>
							{input.length > MAX_PROMPT_LENGTH * 0.9 && (
								<CharCounter $over={input.length >= MAX_PROMPT_LENGTH}>
									{input.length.toLocaleString()} / {MAX_PROMPT_LENGTH.toLocaleString()}
								</CharCounter>
							)}
							<ComposerBar>
								<ComposerChips>
								{canThink && (
									<ComposerTools>
										<ThinkChip
											type="button"
											$on={thinkOn}
											aria-pressed={thinkOn}
											onClick={toggleThink}
											title="Let the model reason step by step before it answers. More careful, but a reply can take a minute or two."
										>
											<Icon name="psychology" size={15} />
											Think
										</ThinkChip>
										{thinkOn && <ToolHint>Reasons first: can take a minute or two</ToolHint>}
									</ComposerTools>
								)}
								{!isMobile() && (
									<ComposerTools>
											<ThinkChip
												type="button"
												$on={createOn}
												aria-pressed={createOn}
												onClick={toggleCreate}
												title="Let the assistant propose files. You approve each one before it is created."
											>
												<Icon name="description" size={15} />
												Create files
											</ThinkChip>
											{createOn && createFolder && (
												<ToolLink type="button" onClick={chooseCreateFolder} title={`Files go to ${createFolder}. Click to change.`}>
													in {createFolder.split(/[\\/]/).filter(Boolean).pop()}
												</ToolLink>
											)}
										</ComposerTools>
									)}
								{connectedFolders.map((folder) => (
									<FolderChip
										key={folder.path}
										type="button"
										$on={folder.enabled}
										aria-pressed={folder.enabled}
										title={
											folder.enabled
												? `Reading ${folder.path}. Click to stop.`
												: `Click to use ${folder.path}`
										}
										onClick={() => setFolderEnabled(folder.path, !folder.enabled)}
									>
										<Icon name="folder_open" size={14} />
										<span>{folder.name}</span>
									</FolderChip>
								))}
								{connectors.docs.length > 0 && (
									<FolderChip
										type="button"
										$on={docsOn}
										aria-pressed={docsOn}
										title={docsOn ? "Reading your documents for this chat. Tap to stop." : "Tap to use your documents"}
										onClick={() => setAllDocsEnabled(!docsOn)}
									>
										<Icon name="description" size={14} />
										<span>
											{connectors.docs.length === 1 ? connectors.docs[0].name : `${connectors.docs.length} documents`}
										</span>
									</FolderChip>
								)}
								{connectors.gmail?.signedIn && (
									<FolderChip
										type="button"
										$on={connectors.gmail.enabled}
										aria-pressed={connectors.gmail.enabled}
										title={connectors.gmail.enabled ? "Reading your newest emails. Click to stop." : "Click to use your inbox"}
										onClick={() => setGmailEnabled(!connectors.gmail?.enabled)}
									>
										<Icon name="mail" size={14} />
										<span>Gmail</span>
									</FolderChip>
								)}
								{connectors.repos.map((r) => (
									<FolderChip
										key={r.repo}
										type="button"
										$on={r.enabled}
										aria-pressed={r.enabled}
										title={r.enabled ? `Reading ${r.repo}. Click to stop.` : `Click to use ${r.repo}`}
										onClick={() => setRepoEnabled(r.repo, !r.enabled)}
									>
										<Icon name="github" size={14} />
										<span>{r.repo.split("/")[1]}</span>
									</FolderChip>
								))}
								</ComposerChips>
								<MemoryRing used={memoryUsed} total={activeModelInfo?.context_length ?? 0} />
								<ModelSelect disabled={isGenerating || isLoadingModel} />
								{isGenerating && (
									<RoundBtn type="button" $variant="stop" onClick={handleStop} aria-label="Stop generating">
										<Icon name="stop_circle" size={13} fill />
									</RoundBtn>
								)}
								{(!isGenerating || hasText) && (
									<RoundBtn
										type="button"
										$variant={hasText ? "send" : "idle"}
										onClick={handleSend}
										disabled={!hasText || isLoadingModel || loadingModelId !== null}
										aria-label={isGenerating ? "Queue message" : "Send message"}
									>
										<Icon name="arrow_upward" size={17} fill />
									</RoundBtn>
								)}
							</ComposerBar>
						</ComposerBox>
						{prefs.showPrivacyNote && (
							<ComposerNote>
								<Icon name="enhanced_encryption" size={12} />
								Runs entirely on this device. Nothing you type leaves it.
							</ComposerNote>
						)}
					</InputBar>
					{hero && starters.length > 0 && <StarterList hero starters={starters} accent={accent} onPick={fillInput} />}
				</ChatContainer>
			</AppLayout>

			<CharacterPicker open={pickerOpen} onClose={() => setPickerOpen(false)} showModels />

			{showCoach && !pickerOpen && (
				<Coachmark role="status">
					<Icon name="touch_app" size={14} color={tokens.colors.primary} />
					<span>{isTouchPrimary() ? "Tap" : "Click"} the name above to switch character. Pick the model next to Send.</span>
					<CoachClose type="button" onClick={dismissCoach} aria-label="Dismiss tip">
						<Icon name="close" size={14} />
					</CoachClose>
				</Coachmark>
			)}
		</>
	);
}

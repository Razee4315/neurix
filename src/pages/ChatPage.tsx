import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useAppContext } from "@/context/AppContext";
import { chatService, historyService, modelService, settingsService } from "@/services";
import type { ChatHistoryEntry } from "@/services/chatService";
import type { Conversation, InferenceEvent } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

interface Message {
	role: "ai" | "user";
	text: string;
}

/* ── Markdown Parser ── */

function renderMarkdown(text: string) {
	const parts: React.ReactNode[] = [];
	const lines = text.split("\n");
	let i = 0;
	let key = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Code block
		if (line.startsWith("```")) {
			const lang = line.slice(3).trim();
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			i++; // skip closing ```
			const code = codeLines.join("\n");
			parts.push(
				<CodeBlock key={`cb-${key++}`}>
					{lang && <CodeLang>{lang}</CodeLang>}
					<CopyButton code={code} />
					<CodePre>{code}</CodePre>
				</CodeBlock>,
			);
			continue;
		}

		// Headers: # ## ###
		const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
		if (headingMatch) {
			const level = headingMatch[1].length;
			parts.push(
				<Heading key={`h-${key++}`} $level={level}>
					{renderInline(headingMatch[2])}
				</Heading>,
			);
			i++;
			continue;
		}

		// Bullet list: - item or * item
		const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)/);
		if (bulletMatch) {
			parts.push(
				<ListItem key={`li-${key++}`}>
					<Bullet>-</Bullet>
					<span>{renderInline(bulletMatch[1])}</span>
				</ListItem>,
			);
			i++;
			continue;
		}

		// Numbered list: 1. item, 2. item
		const numMatch = line.match(/^[\s]*(\d+)[.)]\s+(.+)/);
		if (numMatch) {
			parts.push(
				<ListItem key={`ni-${key++}`}>
					<Bullet>{numMatch[1]}.</Bullet>
					<span>{renderInline(numMatch[2])}</span>
				</ListItem>,
			);
			i++;
			continue;
		}

		// Empty line
		if (line.trim() === "") {
			parts.push(<br key={`br-${key++}`} />);
		} else {
			parts.push(<TextLine key={`tl-${key++}`}>{renderInline(line)}</TextLine>);
		}
		i++;
	}

	return parts;
}

function renderInline(text: string): React.ReactNode[] {
	const nodes: React.ReactNode[] = [];
	// Match **bold**, *italic*, `inline code`, numbered lists
	const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null = null;
	let key = 0;

	match = regex.exec(text);
	while (match !== null) {
		if (match.index > lastIndex) {
			nodes.push(text.slice(lastIndex, match.index));
		}
		if (match[2]) {
			nodes.push(<Bold key={`b-${key++}`}>{match[2]}</Bold>);
		} else if (match[3]) {
			nodes.push(<Italic key={`i-${key++}`}>{match[3]}</Italic>);
		} else if (match[4]) {
			nodes.push(<InlineCode key={`ic-${key++}`}>{match[4]}</InlineCode>);
		}
		lastIndex = regex.lastIndex;
		match = regex.exec(text);
	}
	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex));
	}
	return nodes;
}

/* ── Copy Button with Feedback ── */

function CopyButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = (e: React.MouseEvent) => {
		e.stopPropagation();
		navigator.clipboard.writeText(code);
		if (navigator.vibrate) navigator.vibrate(5);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<CopyBtn onClick={handleCopy} $copied={copied}>
			<Icon
				name={copied ? "check" : "content_copy"}
				size={14}
				color={copied ? tokens.colors.secondary : undefined}
			/>
		</CopyBtn>
	);
}

/* ── Animations ── */

const dotPulse = keyframes`
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-4px); }
`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;


/* ── Styles ── */

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const MessagesArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 15px;

  &::-webkit-scrollbar { width: 0; }
  scrollbar-width: none;
`;

const Bubble = styled.div<{ $role: "ai" | "user" }>`
  max-width: 85%;
  padding: 0.75rem 1rem;
  border-radius: 18px;
  font-size: ${tokens.typography.fontSize.base};
  line-height: ${tokens.typography.lineHeight.relaxed};
  align-self: ${({ $role }) => ($role === "user" ? "flex-end" : "flex-start")};
  animation: ${fadeInUp} 0.25s ease-out both;

  ${({ $role }) =>
		$role === "user"
			? `
    background: ${tokens.colors.primaryContainer}14;
    border: 1px solid ${tokens.colors.primaryContainer}20;
    color: ${tokens.colors.onSurface};
    border-bottom-right-radius: 4px;
  `
			: `
    background: ${tokens.colors.surfaceContainerHigh};
    border: 1px solid ${tokens.colors.outlineVariant}30;
    color: ${tokens.colors.onSurfaceVariant};
    border-bottom-left-radius: 4px;
  `}
`;

const BubbleLabel = styled.span<{ $role: "ai" | "user" }>`
  display: block;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.semibold};
  letter-spacing: ${tokens.typography.letterSpacing.wide};
  margin-bottom: 0.25rem;
  color: ${({ $role }) =>
		$role === "ai" ? tokens.colors.primary : tokens.colors.onSurfaceVariant};
`;

const BubbleBody = styled.div`
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
`;

/* ── Markdown Styles ── */

const TextLine = styled.span`
  display: block;
  margin-bottom: 0.125rem;
`;

const Bold = styled.strong`
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const Italic = styled.em`
  font-style: italic;
`;

const InlineCode = styled.code`
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: 0.8em;
  background: ${tokens.colors.surfaceContainerHighest};
  padding: 0.125rem 0.375rem;
  border-radius: ${tokens.borderRadius.sm};
  color: ${tokens.colors.primary};
`;

const Heading = styled.span<{ $level: number }>`
  display: block;
  font-family: ${tokens.typography.fontFamily.headline};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: ${({ $level }) =>
		$level === 1 ? "1.25em" : $level === 2 ? "1.1em" : "1em"};
`;

const ListItem = styled.span`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.125rem;
  align-items: baseline;
`;

const Bullet = styled.span`
  color: ${tokens.colors.primary};
  flex-shrink: 0;
  font-weight: ${tokens.typography.fontWeight.bold};
`;

const CodeBlock = styled.div`
  position: relative;
  margin: 0.5rem 0;
  background: ${tokens.colors.surfaceContainerLowest};
  border-radius: ${tokens.borderRadius.lg};
  overflow: hidden;
`;

const CodeLang = styled.span`
  display: block;
  padding: 0.375rem 0.75rem;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurfaceVariant};
  background: ${tokens.colors.surfaceContainerHigh};
`;

const CopyBtn = styled.button<{ $copied?: boolean }>`
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  background: ${({ $copied }) => ($copied ? tokens.colors.secondary + "18" : tokens.colors.surfaceContainerHigh)};
  border: none;
  border-radius: ${tokens.borderRadius.sm};
  padding: 0.25rem 0.375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: ${tokens.colors.onSurfaceVariant};
  transition: all ${tokens.transitions.fast};

  &:hover { color: ${tokens.colors.primary}; background: ${tokens.colors.surfaceBright}; }
  &:active { transform: scale(0.9); }
`;

const CodePre = styled.pre`
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: 0.8rem;
  line-height: 1.5;
  padding: 0.75rem;
  margin: 0;
  overflow-x: auto;
  color: ${tokens.colors.onSurface};
  white-space: pre;

  &::-webkit-scrollbar { height: 0; }
  scrollbar-width: none;
`;

/* ── Message Actions ── */

const MessageActions = styled.div<{ $visible: boolean }>`
  display: flex;
  gap: 0.25rem;
  margin-top: 0.375rem;
  opacity: ${({ $visible }) => $visible ? 1 : 0};
  max-height: ${({ $visible }) => $visible ? "40px" : "0"};
  overflow: hidden;
  transition: all 0.15s ease;
`;

const BubbleWrap = styled.div`
  display: flex;
  flex-direction: column;
`;

const BubbleRow = styled.div<{ $role: "ai" | "user" }>`
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  flex-direction: ${({ $role }) => $role === "user" ? "row-reverse" : "row"};
`;

const MenuBtn = styled.button`
  width: 44px;
  height: 44px;
  border-radius: ${tokens.borderRadius.circle};
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.4;
  transition: all ${tokens.transitions.fast};
  flex-shrink: 0;

  &:hover { opacity: 1; background: ${tokens.colors.surfaceContainerHigh}; }
  &:active { transform: scale(0.9); }
`;

const MsgActionBtn = styled.button<{ $copied?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 36px;
  padding: 0.5rem 0.75rem;
  background: ${({ $copied }) => $copied ? tokens.colors.secondary + "18" : tokens.colors.surfaceContainerHigh};
  border: none;
  border-radius: ${tokens.borderRadius.md};
  cursor: pointer;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${({ $copied }) => $copied ? tokens.colors.secondary : tokens.colors.onSurfaceVariant};
  transition: all ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; }
  &:active { transform: scale(0.9); }
`;

/* ── Typing Indicator ── */

const TypingDots = styled.div`
  display: flex;
  gap: 4px;
  align-self: flex-start;
  padding: 0.75rem 1rem;
  animation: ${fadeInUp} 0.2s ease-out both;

  span {
    width: 6px;
    height: 6px;
    border-radius: ${tokens.borderRadius.circle};
    background: ${tokens.colors.primary};
    animation: ${dotPulse} 1.2s ease-in-out infinite;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
`;

/* ── Input Bar ── */

const InputBar = styled.div`
  flex-shrink: 0;
  padding: 0.5rem 0.75rem 0.625rem;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  background: ${tokens.colors.surfaceContainer};
  border-top: 1px solid ${tokens.colors.outlineVariant}30;
`;

const TextInput = styled.textarea`
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  padding: 0.625rem 0.875rem;
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px solid ${tokens.colors.outlineVariant}30;
  border-radius: 20px;
  font-size: ${tokens.typography.fontSize.base};
  font-family: ${tokens.typography.fontFamily.body};
  color: ${tokens.colors.onSurface};
  resize: none;
  outline: none;
  line-height: 1.4;

  &::placeholder { color: ${tokens.colors.outline}; }
  &:focus { border-color: ${tokens.colors.primary}40; }
`;

const SendBtn = styled.button<{ $hasText: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all ${tokens.transitions.fast};

  ${({ $hasText }) =>
		$hasText
			? `background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});`
			: `background: ${tokens.colors.surfaceContainerHigh}; border: 1px solid ${tokens.colors.outlineVariant}30;`}

  &:hover { opacity: 0.85; }
  &:active { transform: scale(0.9); }
`;

const StopBtn = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  border: 1.5px solid ${tokens.colors.error}60;
  background: ${tokens.colors.error}12;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all ${tokens.transitions.fast};

  &:active { transform: scale(0.9); }
`;

/* ── Top Bar Right ── */

const TopBarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TopBarBtn = styled.button`
  width: 44px;
  height: 44px;
  border-radius: ${tokens.borderRadius.lg};
  border: none;
  background: ${tokens.colors.surfaceContainerHigh};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceBright}; }
  &:active { transform: scale(0.9); }
`;

const ModelTag = styled.span`
  font-size: 11px;
  font-weight: ${tokens.typography.fontWeight.semibold};
  color: ${tokens.colors.primary};
  padding: 0.25rem 0.5rem;
  background: ${tokens.colors.primary}12;
  border-radius: ${tokens.borderRadius.md};
`;

/* ── Loading Overlay ── */

const loadingSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const loadingPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

const LoadingOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  background: ${tokens.colors.background}f2;
  padding: 2rem;
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 3px solid ${tokens.colors.surfaceContainerHighest};
  border-top-color: ${tokens.colors.primary};
  border-radius: 50%;
  animation: ${loadingSpin} 0.8s linear infinite;
`;

const LoadingTitle = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  text-align: center;
`;

const LoadingSubtitle = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  text-align: center;
  animation: ${loadingPulse} 2s ease-in-out infinite;
`;

/* ── Speed Badge ── */

const SpeedBadge = styled.span`
  font-size: 10px;
  font-family: ${tokens.typography.fontFamily.mono};
  color: ${tokens.colors.onSurfaceVariant};
  padding: 0.125rem 0.375rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border-radius: ${tokens.borderRadius.sm};
  margin-top: 0.25rem;
  display: inline-block;
`;

/* ── Context Notice ── */

const ContextNotice = styled.div`
  align-self: center;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  background: ${tokens.colors.surfaceContainerHigh};
  padding: 0.375rem 0.75rem;
  border-radius: ${tokens.borderRadius.lg};
  display: flex;
  align-items: center;
  gap: 0.375rem;
  animation: ${fadeInUp} 0.25s ease-out both;
`;

/* ── Message Copy Button ── */

function MessageCopyBtn({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(text);
		if (navigator.vibrate) navigator.vibrate(5);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<MsgActionBtn onClick={handleCopy} $copied={copied}>
			<Icon
				name={copied ? "check" : "content_copy"}
				size={12}
				color={copied ? tokens.colors.secondary : undefined}
			/>
			{copied ? "Copied" : "Copy"}
		</MsgActionBtn>
	);
}

/* ── Component ── */

export function ChatPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { activeModel, settings, refreshActiveModel } = useAppContext();
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [isLoadingModel, setIsLoadingModel] = useState(false);
	const [streamedText, setStreamedText] = useState("");
	const [tokensPerSecond, setTokensPerSecond] = useState(0);
	const [conversationId, setConversationId] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [activeMessageIdx, setActiveMessageIdx] = useState<number | null>(null);
	const [contextNotice, setContextNotice] = useState<string | null>(null);
	const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Refs to track latest state for cleanup (closures capture stale values)
	const streamedTextRef = useRef("");
	const isGeneratingRef = useRef(false);
	const messagesRef = useRef<Message[]>([]);
	const activeModelRef = useRef(activeModel);

	// Keep refs in sync with state
	useEffect(() => { streamedTextRef.current = streamedText; }, [streamedText]);
	useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);
	useEffect(() => { messagesRef.current = messages; }, [messages]);
	useEffect(() => { activeModelRef.current = activeModel; }, [activeModel]);

	// Stop inference and save partial AI response when navigating away mid-generation
	useEffect(() => {
		return () => {
			if (isGeneratingRef.current) {
				chatService.stopInference();
				const partial = streamedTextRef.current.trim();
				if (partial && messagesRef.current.length > 0) {
					// Save partial response so it's not lost
					const updated = [...messagesRef.current, { role: "ai" as const, text: partial }];
					// Fire-and-forget save — component is unmounting
					const title = updated[0]?.text.slice(0, 50) || "Chat";
					historyService.saveConversation({
						id: crypto.randomUUID(),
						title,
						model_id: activeModelRef.current || "",
						model_name: activeModelRef.current || "",
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
						messages: updated.map((m) => ({
							role: m.role === "user" ? "user" : "assistant",
							content: m.text,
							timestamp: new Date().toISOString(),
						})),
					}).catch(() => {});
				}
			}
		};
	}, []);

	// Load existing conversation if navigated from history
	useEffect(() => {
		const state = location.state as { conversationId?: string; freshChat?: boolean } | null;
		// freshChat=true means user clicked "Use Model" / "Engage" — start a clean chat
		if (state?.freshChat) return;
		if (state?.conversationId) {
			historyService.loadConversation(state.conversationId).then((conv) => {
				if (conv) {
					setConversationId(conv.id);
					setMessages(
						conv.messages.map((m) => ({
							role: m.role === "user" ? "user" : "ai",
							text: m.content,
						})),
					);
				}
			});
		}
	}, [location.state]);

	// On mount: if no conversation loaded from history, load the most recent one
	useEffect(() => {
		const state = location.state as { conversationId?: string; freshChat?: boolean } | null;
		if (state?.conversationId || state?.freshChat) return; // Already handled or fresh chat requested
		historyService.getConversations().then((convos) => {
			if (convos.length > 0) {
				// Load the most recent conversation
				historyService.loadConversation(convos[0].id).then((conv) => {
					if (conv) {
						setConversationId(conv.id);
						setMessages(
							conv.messages.map((m) => ({
								role: m.role === "user" ? "user" : "ai",
								text: m.content,
							})),
						);
					}
				});
			}
		});
	}, []);

	// Auto-load last used model if none is active
	const ensureModelLoaded = async (): Promise<boolean> => {
		if (activeModel) return true;

		try {
			const currentSettings = await settingsService.getSettings();
			if (currentSettings.last_model_id) {
				setIsLoadingModel(true);
				await modelService.loadModel(currentSettings.last_model_id);
				await refreshActiveModel();
				setIsLoadingModel(false);
				return true;
			}
		} catch {
			setIsLoadingModel(false);
		}

		// No last model — check if any models are downloaded
		try {
			const models = await modelService.getDownloadedModels();
			if (models.length > 0) {
				setIsLoadingModel(true);
				await modelService.loadModel(models[0].id);
				await refreshActiveModel();
				setIsLoadingModel(false);
				return true;
			}
		} catch {
			setIsLoadingModel(false);
		}

		return false;
	};

	const generateTitle = (msgs: Message[]): string => {
		// Find the first user message for context
		const firstUser = msgs.find((m) => m.role === "user");
		if (!firstUser) return "Chat";

		const text = firstUser.text.trim();

		// If it's a question, use it directly (cleaned up)
		if (text.length <= 50) return text;

		// Extract first sentence or clause
		const sentenceEnd = text.search(/[.!?\n]/);
		if (sentenceEnd > 0 && sentenceEnd <= 60) {
			return text.slice(0, sentenceEnd + 1);
		}

		// Break at last word boundary within 50 chars
		const truncated = text.slice(0, 50);
		const lastSpace = truncated.lastIndexOf(" ");
		return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + "...";
	};

	// Auto-save conversation after each completed exchange
	const saveChat = useCallback(
		async (msgs: Message[]) => {
			if (!settings?.save_history || msgs.length < 2 || !activeModel) return;
			const id = conversationId || crypto.randomUUID();
			if (!conversationId) setConversationId(id);

			const title = generateTitle(msgs);
			const conv: Conversation = {
				id,
				title,
				model_id: "",
				model_name: activeModel,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				messages: msgs.map((m) => ({
					role: m.role === "ai" ? "assistant" : "user",
					content: m.text,
					timestamp: new Date().toISOString(),
				})),
			};
			await historyService.saveConversation(conv).catch(() => {});
		},
		[conversationId, activeModel, settings?.save_history],
	);

	const autoResize = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
	}, []);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isGenerating, streamedText]);

	// Scroll to bottom when keyboard opens (viewport resizes).
	// Without this, messages stay at their stale scroll position and the latest
	// message gets hidden behind the keyboard — unlike WhatsApp which auto-scrolls.
	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;

		const onResize = () => {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		};

		vv.addEventListener("resize", onResize);
		return () => vv.removeEventListener("resize", onResize);
	}, []);

	// Trim any stop sequence artifacts from the end of generated text
	const cleanResponse = (text: string): string => {
		const stopPatterns = [
			/\n?Human:[\s\S]*$/i,
			/\n?User:[\s\S]*$/i,
			/<\|im_start\|>[\s\S]*$/,
			/<\|im_end\|>[\s\S]*$/,
			/<start_of_turn>[\s\S]*$/,
			/<end_of_turn>[\s\S]*$/,
			/<\|eot_id\|>[\s\S]*$/,
			/<\|start_header_id\|>[\s\S]*$/,
			/<\|end\|>[\s\S]*$/,
			/<\|user\|>[\s\S]*$/,
			/<\|endoftext\|>[\s\S]*$/,
		];
		let cleaned = text;
		for (const pattern of stopPatterns) {
			cleaned = cleaned.replace(pattern, "");
		}
		return cleaned.trim();
	};

	const handleEvent = useCallback((event: InferenceEvent) => {
		const data = event.data;
		switch (event.event) {
			case "TokenGenerated": {
				const d = data as { token: string; tokens_per_second: number };
				setStreamedText((prev) => prev + d.token);
				setTokensPerSecond(d.tokens_per_second);
				break;
			}
			case "GenerationComplete": {
				// Add message FIRST, then clear stream + generating flag in the same
				// React batch so there's no 1-frame gap (flicker) between the streaming
				// bubble disappearing and the permanent bubble appearing.
				setStreamedText((finalText) => {
					const cleaned = cleanResponse(finalText);
					if (cleaned) {
						setMessages((prev) => {
							const updated = [...prev, { role: "ai" as const, text: cleaned }];
							saveChat(updated);
							return updated;
						});
					}
					setIsGenerating(false);
					return "";
				});
				const d = data as { total_tokens: number; duration_ms: number };
				if (d.duration_ms > 0) {
					setTokensPerSecond(d.total_tokens / (d.duration_ms / 1000));
				}
				break;
			}
			case "ContextTrimmed": {
				const d = data as { pairs_dropped: number };
				setContextNotice(`Using recent messages only (${d.pairs_dropped} older messages excluded from context)`);
				// Auto-dismiss after 4 seconds
				setTimeout(() => setContextNotice(null), 4000);
				break;
			}
			case "Error": {
				setIsGenerating(false);
				const d = data as { message: string };
				setMessages((prev) => [
					...prev,
					{ role: "ai", text: `**Error:** ${d.message}` },
				]);
				setStreamedText("");
				break;
			}
		}
	}, []);

	const buildHistory = (msgs: Message[]): ChatHistoryEntry[] => {
		const pairs: ChatHistoryEntry[] = [];
		for (let i = 0; i < msgs.length - 1; i += 2) {
			if (msgs[i]?.role === "user" && msgs[i + 1]?.role === "ai") {
				pairs.push({ user: msgs[i].text, assistant: msgs[i + 1].text });
			}
		}
		// Send ALL history �� backend does token-aware truncation with the actual tokenizer
		return pairs;
	};

	const sendingRef = useRef(false);

	const handleSend = async () => {
		const text = input.trim();
		if (!text || isGenerating || isLoadingModel || sendingRef.current) return;
		sendingRef.current = true;

		// Haptic feedback
		if (navigator.vibrate) navigator.vibrate(10);

		// Auto-load model if none is active
		if (!activeModel) {
			const loaded = await ensureModelLoaded();
			if (!loaded) {
				sendingRef.current = false;
				navigate("/models");
				return;
			}
		}

		setMessages((prev) => [...prev, { role: "user", text }]);
		setInput("");
		setIsGenerating(true);
		setStreamedText("");
		setTokensPerSecond(0);
		if (textareaRef.current) textareaRef.current.style.height = "auto";

		const history = buildHistory(messages);

		try {
			await chatService.runInference(
				text,
				settings?.system_prompt ?? "",
				history,
				settings?.temperature ?? 0.4,
				settings?.top_p ?? 0.9,
				settings?.max_tokens ?? 512,
				handleEvent,
			);
		} catch (err) {
			setIsGenerating(false);
			setStreamedText("");
			setMessages((prev) => [
				...prev,
				{ role: "ai", text: `**Error:** ${String(err)}` },
			]);
		} finally {
			sendingRef.current = false;
		}
	};

	const handleStop = () => {
		if (navigator.vibrate) navigator.vibrate(12);
		chatService.stopInference();
	};

	const handleRegenerate = async () => {
		if (isGenerating || !activeModel || messages.length < 2) return;

		// Find the last user message
		let lastUserIdx = -1;
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === "user") {
				lastUserIdx = i;
				break;
			}
		}
		if (lastUserIdx === -1) return;

		const userText = messages[lastUserIdx].text;
		// Remove the last AI response (and keep everything before it)
		const trimmed = messages.slice(0, lastUserIdx + 1);
		setMessages(trimmed);
		setIsGenerating(true);
		setStreamedText("");
		setTokensPerSecond(0);

		const history = buildHistory(trimmed);

		try {
			await chatService.runInference(
				userText,
				settings?.system_prompt ?? "",
				history,
				settings?.temperature ?? 0.4,
				settings?.top_p ?? 0.9,
				settings?.max_tokens ?? 512,
				handleEvent,
			);
		} catch (err) {
			setIsGenerating(false);
			setStreamedText("");
			setMessages((prev) => [
				...prev,
				{ role: "ai", text: `**Error:** ${String(err)}` },
			]);
		}
	};

	const handleLongPressStart = (idx: number) => {
		longPressRef.current = setTimeout(() => {
			if (navigator.vibrate) navigator.vibrate(15);
			setActiveMessageIdx((prev) => prev === idx ? null : idx);
		}, 400);
	};

	const handleLongPressEnd = () => {
		if (longPressRef.current) {
			clearTimeout(longPressRef.current);
			longPressRef.current = null;
		}
	};

	const handleDeleteMessage = (idx: number) => {
		setMessages((prev) => prev.filter((_, i) => i !== idx));
		setActiveMessageIdx(null);
	};

	const handleShareMessage = async (text: string) => {
		if (navigator.share) {
			try { await navigator.share({ text }); return; } catch { /* cancelled */ }
		}
		await navigator.clipboard.writeText(text);
		setActiveMessageIdx(null);
	};

	const handleShareChat = async () => {
		if (messages.length === 0) return;
		const text = messages
			.map((m) => `${m.role === "user" ? "You" : "Neurix"}: ${m.text}`)
			.join("\n\n");

		// Try native share first (Android), fall back to clipboard
		if (navigator.share) {
			try {
				await navigator.share({ title: "Neurix Chat", text });
				return;
			} catch {
				// User cancelled or share failed — fall back to clipboard
			}
		}
		await navigator.clipboard.writeText(text);
	};

	const handleNewChat = () => {
		if (isGenerating) chatService.stopInference();
		setMessages([]);
		setInput("");
		setStreamedText("");
		setIsGenerating(false);
		setConversationId(crypto.randomUUID());
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<>
		{isLoadingModel && (
			<LoadingOverlay>
				<Spinner />
				<LoadingTitle>Loading Model</LoadingTitle>
				<LoadingSubtitle>This may take a moment...</LoadingSubtitle>
			</LoadingOverlay>
		)}
		<AppLayout
			title="Chat"
			rightActions={
				<TopBarRight>
					{activeModel ? (
						<ModelTag>{activeModel}</ModelTag>
					) : (
						<ModelTag
							style={{ cursor: "pointer" }}
							onClick={() => navigate("/models")}
						>
							{isLoadingModel ? "Loading..." : "No model"}
						</ModelTag>
					)}
					{messages.length > 0 && (
						<TopBarBtn onClick={handleShareChat} aria-label="Share chat">
							<Icon
								name="share"
								size={18}
								color={tokens.colors.onSurfaceVariant}
							/>
						</TopBarBtn>
					)}
					<TopBarBtn onClick={handleNewChat} aria-label="New chat">
						<Icon
							name="edit_square"
							size={18}
							color={tokens.colors.onSurfaceVariant}
						/>
					</TopBarBtn>
					<TopBarBtn onClick={() => navigate("/chat/history")} aria-label="Chat history">
						<Icon
							name="history"
							size={18}
							color={tokens.colors.onSurfaceVariant}
						/>
					</TopBarBtn>
				</TopBarRight>
			}
		>
			<ChatContainer>
				<MessagesArea>
					{messages.length === 0 && !isGenerating && !streamedText && (
						<EmptyState
						icon="chat_bubble"
						message="What's on your mind?"
						subtitle="Type a message to start chatting with your AI."
					/>
					)}
					{contextNotice && (
						<ContextNotice>
							<Icon name="info" size={14} color={tokens.colors.onSurfaceVariant} />
							{contextNotice}
						</ContextNotice>
					)}
					{messages.map((msg, i) => (
						<BubbleWrap key={`msg-${i}-${msg.role}`}>
							<Bubble
								$role={msg.role}
								onTouchStart={() => handleLongPressStart(i)}
								onTouchEnd={handleLongPressEnd}
								onTouchCancel={handleLongPressEnd}
							>
								<BubbleLabel $role={msg.role}>
									{msg.role === "ai" ? "Neurix" : "You"}
								</BubbleLabel>
								<BubbleBody>
									{msg.role === "ai" ? renderMarkdown(msg.text) : msg.text}
								</BubbleBody>
							</Bubble>
							<MessageActions $visible={activeMessageIdx === i && !isGenerating}>
								<MessageCopyBtn text={msg.text} />
								<MsgActionBtn onClick={() => handleDeleteMessage(i)}>
									<Icon name="delete" size={14} />
									Delete
								</MsgActionBtn>
								{msg.role === "ai" && i === messages.length - 1 && (
									<MsgActionBtn onClick={handleRegenerate}>
										<Icon name="refresh" size={14} />
										Retry
									</MsgActionBtn>
								)}
							</MessageActions>
						</BubbleWrap>
					))}
					{(isGenerating || streamedText) && (
						<Bubble $role="ai">
							<BubbleLabel $role="ai">Neurix</BubbleLabel>
							<BubbleBody>
								{streamedText ? renderMarkdown(streamedText) : (
									<TypingDots>
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
					)}
					<div ref={messagesEndRef} />
				</MessagesArea>

				<InputBar>
					<TextInput
						ref={textareaRef}
						value={input}
						onChange={(e) => {
							setInput(e.target.value);
							autoResize();
						}}
						onKeyDown={handleKeyDown}
						placeholder="Message Neurix..."
						rows={1}
						disabled={isGenerating || isLoadingModel}
					/>
					{isGenerating ? (
						<StopBtn onClick={handleStop} aria-label="Stop generating">
							<Icon name="stop_circle" size={22} fill color={tokens.colors.error} />
						</StopBtn>
					) : (
						<SendBtn $hasText={input.trim().length > 0} onClick={handleSend} aria-label="Send message">
							<Icon
								name="arrow_upward"
								size={20}
								color={
									input.trim()
										? tokens.colors.onPrimaryFixed
										: tokens.colors.onSurfaceVariant
								}
							/>
						</SendBtn>
					)}
				</InputBar>
			</ChatContainer>
		</AppLayout>
		</>
	);
}

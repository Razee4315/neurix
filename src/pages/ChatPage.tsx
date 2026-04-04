import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useAppContext } from "@/context/AppContext";
import { chatService, historyService } from "@/services";
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
		// Code block
		if (lines[i].startsWith("```")) {
			const lang = lines[i].slice(3).trim();
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

		// Regular line
		const line = lines[i];
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
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
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

  &::-webkit-scrollbar { width: 0; }
  scrollbar-width: none;
`;

const Bubble = styled.div<{ $role: "ai" | "user" }>`
  max-width: 88%;
  padding: 0.75rem 1rem;
  border-radius: ${tokens.borderRadius.xl};
  font-size: ${tokens.typography.fontSize.base};
  line-height: ${tokens.typography.lineHeight.relaxed};
  align-self: ${({ $role }) => ($role === "user" ? "flex-end" : "flex-start")};
  animation: ${fadeInUp} 0.25s ease-out both;

  ${({ $role }) =>
		$role === "user"
			? `
    background: ${tokens.colors.surfaceContainerHigh};
    color: ${tokens.colors.onSurface};
    border-bottom-right-radius: ${tokens.borderRadius.sm};
  `
			: `
    background: ${tokens.colors.surfaceContainerLow};
    color: ${tokens.colors.onSurfaceVariant};
    border-bottom-left-radius: ${tokens.borderRadius.sm};
  `}
`;

const BubbleLabel = styled.span<{ $role: "ai" | "user" }>`
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  margin-bottom: 0.25rem;
  color: ${({ $role }) =>
		$role === "ai" ? tokens.colors.primary : tokens.colors.onSurfaceVariant};
`;

const BubbleBody = styled.div`
  word-break: break-word;
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
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  padding: 0.5rem 0.75rem 0.75rem;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  background: ${tokens.colors.surfaceContainer};
`;

const TextInput = styled.textarea`
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  padding: 0.625rem 0.75rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  font-size: ${tokens.typography.fontSize.base};
  font-family: ${tokens.typography.fontFamily.body};
  color: ${tokens.colors.onSurface};
  resize: none;
  outline: none;
  line-height: 1.4;

  &::placeholder { color: ${tokens.colors.outline}; }
  &:focus { box-shadow: inset 0 -2px 0 ${tokens.colors.primary}; }
`;

const SendBtn = styled.button<{ $hasText: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: ${tokens.borderRadius.md};
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
			: `background: ${tokens.colors.surfaceContainerHighest};`}

  &:hover { opacity: 0.85; }
  &:active { transform: scale(0.9); }
`;

/* ── Top Bar Right ── */

const TopBarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TopBarBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: ${tokens.borderRadius.md};
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

/* ── No Model Banner ── */

const NoModelBanner = styled.div`
  padding: 2rem 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const GoToModelsBtn = styled.button`
  padding: 0.625rem 1.25rem;
  border-radius: ${tokens.borderRadius.md};
  border: none;
  background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});
  color: ${tokens.colors.onPrimaryFixed};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  &:active { transform: scale(0.97); }
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

/* ── Component ── */

export function ChatPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { activeModel, settings } = useAppContext();
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [streamedText, setStreamedText] = useState("");
	const [tokensPerSecond, setTokensPerSecond] = useState(0);
	const [conversationId, setConversationId] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Load existing conversation if navigated from history
	useEffect(() => {
		const state = location.state as { conversationId?: string } | null;
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

	// Auto-save conversation after each completed exchange
	const saveChat = useCallback(
		async (msgs: Message[]) => {
			if (!settings?.save_history || msgs.length < 2 || !activeModel) return;
			const id = conversationId || crypto.randomUUID();
			if (!conversationId) setConversationId(id);

			const title = msgs[0]?.role === "user" ? msgs[0].text.slice(0, 60) : "Chat";
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
				setIsGenerating(false);
				setStreamedText((finalText) => {
					if (finalText) {
						setMessages((prev) => {
							const updated = [...prev, { role: "ai" as const, text: finalText }];
							saveChat(updated);
							return updated;
						});
					}
					return "";
				});
				const d = data as { total_tokens: number; duration_ms: number };
				if (d.duration_ms > 0) {
					setTokensPerSecond(d.total_tokens / (d.duration_ms / 1000));
				}
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

	const handleSend = async () => {
		const text = input.trim();
		if (!text || isGenerating || !activeModel) return;

		setMessages((prev) => [...prev, { role: "user", text }]);
		setInput("");
		setIsGenerating(true);
		setStreamedText("");
		setTokensPerSecond(0);
		if (textareaRef.current) textareaRef.current.style.height = "auto";

		const history: ChatHistoryEntry[] = [];
		for (let i = 0; i < messages.length - 1; i += 2) {
			if (messages[i]?.role === "user" && messages[i + 1]?.role === "ai") {
				history.push({ user: messages[i].text, assistant: messages[i + 1].text });
			}
		}

		try {
			await chatService.runInference(
				text,
				settings?.system_prompt ?? "",
				history,
				settings?.temperature ?? 0.7,
				settings?.top_p ?? 0.9,
				settings?.max_tokens ?? 2048,
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

	const handleStop = () => {
		chatService.stopInference();
	};

	const handleNewChat = () => {
		setMessages([]);
		setInput("");
		setStreamedText("");
		setIsGenerating(false);
		setConversationId(null);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	if (!activeModel) {
		return (
			<AppLayout>
				<NoModelBanner>
					<EmptyState icon="neurology" message="No model loaded" />
					<GoToModelsBtn onClick={() => navigate("/models")}>
						Go to My Models
					</GoToModelsBtn>
				</NoModelBanner>
			</AppLayout>
		);
	}

	return (
		<AppLayout
			rightActions={
				<TopBarRight>
					<ModelTag>{activeModel}</ModelTag>
					<TopBarBtn onClick={handleNewChat}>
						<Icon
							name="edit_square"
							size={18}
							color={tokens.colors.onSurfaceVariant}
						/>
					</TopBarBtn>
					<TopBarBtn onClick={() => navigate("/chat/history")}>
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
						<EmptyState icon="chat_bubble" message="Start a conversation" />
					)}
					{messages.map((msg, i) => (
						<Bubble key={`msg-${i}-${msg.role}`} $role={msg.role}>
							<BubbleLabel $role={msg.role}>
								{msg.role === "ai" ? "Neurix" : "You"}
							</BubbleLabel>
							<BubbleBody>
								{msg.role === "ai" ? renderMarkdown(msg.text) : msg.text}
							</BubbleBody>
						</Bubble>
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
						disabled={isGenerating}
					/>
					{isGenerating ? (
						<SendBtn $hasText onClick={handleStop}>
							<Icon name="stop" size={20} color={tokens.colors.error} />
						</SendBtn>
					) : (
						<SendBtn $hasText={input.trim().length > 0} onClick={handleSend}>
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
	);
}

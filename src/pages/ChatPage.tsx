import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/theme/tokens";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* ── Mock Messages ── */

interface Message {
	role: "ai" | "user";
	text: string;
}

const INITIAL_MESSAGES: Message[] = [
	{
		role: "ai",
		text: "Hello! I'm running **Llama 3 8B** locally on your device. How can I help you today?",
	},
	{
		role: "user",
		text: "Write a Python function to check if a number is prime.",
	},
	{
		role: "ai",
		text: "Here's a simple and efficient prime checker:\n\n```python\ndef is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            return False\n    return True\n```\n\nThis works by checking divisibility only up to the **square root** of `n`, which makes it much faster than checking all numbers up to `n`.\n\nYou can use it like:\n```python\nprint(is_prime(17))  # True\nprint(is_prime(4))   # False\n```",
	},
];

const AI_RESPONSES = [
	"That's a great question! Since I'm running **locally** on your device, all processing happens right here — *no data leaves your phone*.",
	"Here's what I think:\n\n1. First, consider the **input constraints**\n2. Then, optimize for the common case\n3. Finally, handle edge cases gracefully\n\nWant me to elaborate on any of these?",
	"Sure! Here's a quick example:\n\n```javascript\nconst greet = (name) => {\n  return `Hello, ${name}!`;\n};\n\nconsole.log(greet('Neurix'));\n```\n\nThis uses an **arrow function** with a template literal for string interpolation.",
];

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
					<CopyBtn
						onClick={(e) => {
							e.stopPropagation();
							navigator.clipboard.writeText(code);
						}}
					>
						<Icon name="content_copy" size={14} />
					</CopyBtn>
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

const CopyBtn = styled.button`
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  background: ${tokens.colors.surfaceContainerHigh};
  border: none;
  border-radius: ${tokens.borderRadius.sm};
  padding: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: ${tokens.colors.onSurfaceVariant};
  transition: color ${tokens.transitions.fast};

  &:hover { color: ${tokens.colors.primary}; }
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

/* ── Component ── */

export function ChatPage() {
	const navigate = useNavigate();
	const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
	const [input, setInput] = useState("");
	const [typing, setTyping] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	let responseIndex = 0;

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, typing]);

	const handleSend = () => {
		const text = input.trim();
		if (!text) return;

		setMessages((prev) => [...prev, { role: "user", text }]);
		setInput("");
		setTyping(true);

		const response = AI_RESPONSES[responseIndex % AI_RESPONSES.length];
		responseIndex++;

		setTimeout(() => {
			setMessages((prev) => [...prev, { role: "ai", text: response }]);
			setTyping(false);
		}, 1200);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<AppLayout
			rightActions={
				<TopBarRight>
					<ModelTag>Llama 3 8B</ModelTag>
					<TopBarBtn
						onClick={() => {
							setMessages([INITIAL_MESSAGES[0]]);
							setInput("");
						}}
					>
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
					{typing && (
						<TypingDots>
							<span />
							<span />
							<span />
						</TypingDots>
					)}
					<div ref={messagesEndRef} />
				</MessagesArea>

				<InputBar>
					<TextInput
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Message Neurix..."
						rows={1}
					/>
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
				</InputBar>
			</ChatContainer>
		</AppLayout>
	);
}

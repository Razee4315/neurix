import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/theme/tokens";
import { useState } from "react";
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
		text: "Hello! I'm running Llama 3 8B locally on your device. How can I help you today?",
	},
	{
		role: "user",
		text: "Explain how neural networks learn in simple terms.",
	},
	{
		role: "ai",
		text: "Think of a neural network like a student learning from examples. It sees thousands of examples, makes guesses, checks if it was right, and adjusts its thinking. Over time, it gets better at recognizing patterns — like how you learned to read by seeing letters over and over.",
	},
];

/* ── Animations ── */

const dotPulse = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
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
  max-width: 85%;
  padding: 0.75rem 1rem;
  border-radius: ${tokens.borderRadius.xl};
  font-size: ${tokens.typography.fontSize.base};
  line-height: ${tokens.typography.lineHeight.relaxed};
  align-self: ${({ $role }) => ($role === "user" ? "flex-end" : "flex-start")};

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

const TypingDots = styled.div`
  display: flex;
  gap: 4px;
  align-self: flex-start;
  padding: 0.75rem 1rem;

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

  &::placeholder {
    color: ${tokens.colors.outline};
  }
  &:focus {
    box-shadow: inset 0 -2px 0 ${tokens.colors.primary};
  }
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
			? `
    background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});
  `
			: `
    background: ${tokens.colors.surfaceContainerHighest};
  `}

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

	const handleSend = () => {
		const text = input.trim();
		if (!text) return;

		setMessages((prev) => [...prev, { role: "user", text }]);
		setInput("");
		setTyping(true);

		// Fake AI response after delay
		setTimeout(() => {
			setMessages((prev) => [
				...prev,
				{
					role: "ai",
					text: "That's a great question! Since I'm running locally on your device, all processing happens right here — no data leaves your phone.",
				},
			]);
			setTyping(false);
		}, 1500);
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
							{msg.text}
						</Bubble>
					))}
					{typing && (
						<TypingDots>
							<span />
							<span />
							<span />
						</TypingDots>
					)}
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

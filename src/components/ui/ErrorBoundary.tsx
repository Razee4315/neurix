import { tokens } from "@/theme/tokens";
import { Component, type ErrorInfo, type ReactNode } from "react";
import styled from "styled-components";

const Container = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  background: ${tokens.colors.background};
  gap: 1rem;
`;

const Title = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const Message = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  max-width: 300px;
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

const RestartBtn = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: ${tokens.borderRadius.xl};
  background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});
  color: ${tokens.colors.onPrimaryFixed};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  border: none;
  cursor: pointer;
  margin-top: 0.5rem;

  &:active { transform: scale(0.95); }
`;

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		// Log render-time errors with the React component stack so we can debug
		// from device logs (Android logcat picks these up).
		console.error("[Neurix] React render error:", error, info.componentStack);
	}

	componentDidMount() {
		window.addEventListener("error", this.handleGlobalError);
		window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
	}

	componentWillUnmount() {
		window.removeEventListener("error", this.handleGlobalError);
		window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
	}

	// We don't crash the UI for async errors (too aggressive — a single failed
	// fetch shouldn't blank the screen). Just surface them to the console so
	// they're visible in logcat / devtools rather than swallowed.
	handleGlobalError = (e: ErrorEvent) => {
		console.error("[Neurix] uncaught error:", e.error ?? e.message, e.filename, e.lineno);
	};

	handleUnhandledRejection = (e: PromiseRejectionEvent) => {
		console.error("[Neurix] unhandled promise rejection:", e.reason);
	};

	handleRestart = () => {
		this.setState({ hasError: false });
		window.location.hash = "#/";
		window.location.reload();
	};

	render() {
		if (this.state.hasError) {
			return (
				<Container>
					<Title>Something went wrong</Title>
					<Message>
						The app encountered an unexpected error. Your data is safe — tap below to restart.
					</Message>
					<RestartBtn onClick={this.handleRestart}>
						Restart Neurix
					</RestartBtn>
				</Container>
			);
		}
		return this.props.children;
	}
}

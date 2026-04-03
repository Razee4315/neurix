import { OnboardingScreen } from "@/pages/OnboardingScreen";
import { SplashScreen } from "@/pages/SplashScreen";
import { GlobalStyles, theme } from "@/theme";
import { tokens } from "@/theme/tokens";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import styled from "styled-components";

function App() {
	return (
		<ThemeProvider theme={theme}>
			<GlobalStyles />
			<HashRouter>
				<div className="app-container">
					<Routes>
						<Route path="/" element={<SplashScreen />} />
						<Route path="/onboarding" element={<OnboardingScreen />} />
						<Route path="/store" element={<Placeholder name="Model Store" />} />
						<Route path="/models" element={<Placeholder name="My Models" />} />
						<Route path="/chat" element={<Placeholder name="Chat" />} />
						<Route
							path="/chat/history"
							element={<Placeholder name="Chat History" />}
						/>
						<Route path="/settings" element={<Placeholder name="Settings" />} />
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</div>
			</HashRouter>
		</ThemeProvider>
	);
}

const PlaceholderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100dvh;
  height: 100vh;
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize["2xl"]};
  background: ${tokens.colors.background};
  font-family: ${tokens.typography.fontFamily.headline};
`;

function Placeholder({ name }: { name: string }) {
	return <PlaceholderContainer>{name} — Coming Soon</PlaceholderContainer>;
}

export default App;

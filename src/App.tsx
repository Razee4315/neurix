import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { DownloadProvider } from "@/context/DownloadContext";
import { ChatHistoryPage } from "@/pages/ChatHistoryPage";
import { ChatPage } from "@/pages/ChatPage";
import { DownloadingPage } from "@/pages/DownloadingPage";
import { ModelDetailPage } from "@/pages/ModelDetailPage";
import { ModelStorePage } from "@/pages/ModelStorePage";
import { MyModelsPage } from "@/pages/MyModelsPage";
import { OnboardingScreen } from "@/pages/OnboardingScreen";
import { SettingsPage } from "@/pages/SettingsPage";
import { AboutPage } from "@/pages/AboutPage";
import { SplashScreen } from "@/pages/SplashScreen";
import { GlobalStyles, theme } from "@/theme";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";

function App() {
	return (
		<ErrorBoundary>
		<ThemeProvider theme={theme}>
			<GlobalStyles />
			<AppProvider>
				<DownloadProvider>
				<ConfirmProvider>
				<HashRouter>
					<div className="app-container">
						<Routes>
							<Route path="/" element={<SplashScreen />} />
							<Route path="/onboarding" element={<OnboardingScreen />} />
							<Route path="/store" element={<ModelStorePage />} />
							<Route path="/store/model" element={<ModelDetailPage />} />
							<Route path="/downloading" element={<DownloadingPage />} />
							<Route path="/models" element={<MyModelsPage />} />
							<Route path="/chat" element={<ChatPage />} />
							<Route path="/chat/history" element={<ChatHistoryPage />} />
							<Route path="/settings" element={<SettingsPage />} />
							<Route path="/about" element={<AboutPage />} />
							<Route path="*" element={<Navigate to="/" replace />} />
						</Routes>
					</div>
				</HashRouter>
				</ConfirmProvider>
				</DownloadProvider>
			</AppProvider>
		</ThemeProvider>
		</ErrorBoundary>
	);
}

export default App;

import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import { AppProvider } from "@/context/AppContext";
import { DownloadProvider } from "@/context/DownloadContext";
import { SplashScreen } from "@/pages/SplashScreen";
import { GlobalStyles, theme } from "@/theme";
import { Suspense, lazy } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";

const OnboardingScreen = lazy(() =>
	import("@/pages/OnboardingScreen").then((m) => ({ default: m.OnboardingScreen })),
);
const ModelStorePage = lazy(() =>
	import("@/pages/ModelStorePage").then((m) => ({ default: m.ModelStorePage })),
);
const ModelDetailPage = lazy(() =>
	import("@/pages/ModelDetailPage").then((m) => ({ default: m.ModelDetailPage })),
);
const DownloadingPage = lazy(() =>
	import("@/pages/DownloadingPage").then((m) => ({ default: m.DownloadingPage })),
);
const MyModelsPage = lazy(() =>
	import("@/pages/MyModelsPage").then((m) => ({ default: m.MyModelsPage })),
);
const ChatPage = lazy(() =>
	import("@/pages/ChatPage").then((m) => ({ default: m.ChatPage })),
);
const ChatHistoryPage = lazy(() =>
	import("@/pages/ChatHistoryPage").then((m) => ({ default: m.ChatHistoryPage })),
);
const SettingsPage = lazy(() =>
	import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const AboutPage = lazy(() =>
	import("@/pages/AboutPage").then((m) => ({ default: m.AboutPage })),
);

function App() {
	return (
		<ErrorBoundary>
		<ThemeProvider theme={theme}>
			<GlobalStyles />
			<AppProvider>
				<ToastProvider>
				<DownloadProvider>
				<ConfirmProvider>
				<HashRouter>
					<div className="app-container">
						<Suspense fallback={<SplashScreen />}>
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
						</Suspense>
					</div>
				</HashRouter>
				</ConfirmProvider>
				</DownloadProvider>
				</ToastProvider>
			</AppProvider>
		</ThemeProvider>
		</ErrorBoundary>
	);
}

export default App;

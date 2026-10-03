import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme, storedThemeId } from "./theme/themes";

// Paint with the remembered theme before React mounts so there is no flash
// of the default palette while settings load.
applyTheme(storedThemeId());

async function bootstrap() {
	// In a plain browser (no Tauri runtime) during development, install the
	// in-memory backend so the UI can be previewed. Stripped from production.
	if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
		await import("./dev/mockTauri");
	}
	ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
		<React.StrictMode>
			<App />
		</React.StrictMode>,
	);
}

bootstrap();

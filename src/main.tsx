import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme, storedThemeId } from "./theme/themes";

// Paint with the remembered theme before React mounts so there is no flash
// of the default palette while settings load.
applyTheme(storedThemeId());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);

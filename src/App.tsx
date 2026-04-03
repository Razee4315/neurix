import { useState } from "react";
import { ThemeProvider } from "styled-components";
import { WelcomeScreen } from "@/pages/WelcomeScreen";
import { GlobalStyles, theme } from "@/theme";

function App() {
  const [started, setStarted] = useState(false);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <div className="app-container">
        {!started ? (
          <WelcomeScreen onGetStarted={() => setStarted(true)} />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              color: "white",
              fontSize: "1.5rem",
            }}
          >
            Neurix is ready! Start building here.
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;

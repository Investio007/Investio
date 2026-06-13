
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { InvestioProvider } from "./app/context/InvestioContext";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <InvestioProvider>
    <App />
  </InvestioProvider>,
);
  
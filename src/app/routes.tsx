import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "./components/AppShell";
import { SplashScreen } from "./screens/SplashScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { AuthCallbackScreen } from "./screens/AuthCallbackScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { StockAnalysisScreen } from "./screens/StockAnalysisScreen";
import { PortfolioBuilderScreen } from "./screens/PortfolioBuilderScreen";
import { CompareScreen } from "./screens/CompareScreen";
import { AIAssistantScreen } from "./screens/AIAssistantScreen";
import { AddDemoFundsScreen } from "./screens/AddDemoFundsScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: () => <Navigate to="/splash" />,
  },
  {
    path: "/splash",
    Component: SplashScreen,
  },
  {
    path: "/onboarding",
    Component: OnboardingScreen,
  },
  {
    path: "/auth",
    Component: AuthScreen,
  },
  {
    path: "/auth/callback",
    Component: AuthCallbackScreen,
  },
  {
    Component: AppShell,
    children: [
      {
        path: "/home",
        Component: HomeScreen,
      },
      {
        path: "/portfolio-builder",
        Component: PortfolioBuilderScreen,
      },
      {
        path: "/compare",
        Component: CompareScreen,
      },
      {
        path: "/ai-assistant",
        Component: AIAssistantScreen,
      },
      {
        path: "/advisor",
        Component: AIAssistantScreen,
      },
    ],
  },
  {
    path: "/stock/:symbol",
    Component: StockAnalysisScreen,
  },
  {
    path: "/analysis",
    Component: StockAnalysisScreen,
  },
  {
    path: "/add-demo-funds",
    Component: AddDemoFundsScreen,
  },
  {
    path: "/add-funds",
    Component: AddDemoFundsScreen,
  },
]);
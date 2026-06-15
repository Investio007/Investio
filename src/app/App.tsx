import { RouterProvider } from "react-router";
import { router } from "./routes";
import { GlobalToast } from "./components/GlobalToast";

export default function App() {
  return (
    <div className="app-root min-h-dvh h-dvh w-full max-w-[100vw] bg-white flex flex-col overflow-hidden">
      <div
        id="investio-phone-root"
        className="flex-1 min-h-0 overflow-hidden relative flex flex-col w-full"
      >
        <RouterProvider router={router} />
        <GlobalToast />
      </div>
    </div>
  );
}

import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center p-4">
      {/* Mobile Container */}
      <div className="w-full max-w-[430px] h-[932px] bg-white rounded-[3rem] shadow-2xl overflow-hidden relative border-8 border-gray-800">
        {/* Status Bar Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-black rounded-b-3xl z-50" />
        
        {/* App Content */}
        <div className="h-full overflow-y-auto scrollbar-hide">
          <RouterProvider router={router} />
        </div>
      </div>
    </div>
  );
}
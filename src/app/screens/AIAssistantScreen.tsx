import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Send, Bot, User } from "lucide-react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ProfileDialog, ProfileMenuButton } from "../components/ProfileDialog";
import { aiApi } from "../services/aiApi";
import { captureEvent } from "../../lib/analytics";
import { useVisualViewportPadding } from "../hooks/useVisualViewportPadding";

interface Message {
  role: "user" | "ai";
  text: string;
  risk: "Low" | "Moderate" | "High" | null;
}

const initialMessages: Message[] = [
  {
    role: "ai",
    text:
      "Hi! I'm your AI investment helper. Ask me anything about stocks or investing. I'll explain things in simple words.",
    risk: null,
  },
];

const suggestedQuestions = [
  "Is Tesla a good investment?",
  "How should I spread my money?",
  "What's the best plan for retirement?",
];

const getRiskColor = (risk: "Low" | "Moderate" | "High") => {
  switch (risk) {
    case "Low":
      return "bg-[#007A4D]/10 text-[#007A4D]";
    case "Moderate":
      return "bg-[#FFB612]/15 text-[#9A6700]";
    case "High":
      return "bg-[#E03A3E]/10 text-[#C62828]";
  }
};

export function AIAssistantScreen() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const keyboardPadding = useVisualViewportPadding();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question, risk: null }]);
    setLoading(true);
    captureEvent("ai_question_asked", { question_length: question.length });
    try {
      const data = await aiApi.chat(question);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: data.text, risk: data.risk },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "I'm having trouble connecting right now. Please try again shortly.",
          risk: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#F5F7FA]">
      <div className="shrink-0 bg-white px-6 screen-header pb-5 rounded-b-3xl shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
          </button>
          <ProfileMenuButton onClick={() => setProfileOpen(true)} />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#0A1F44] rounded-2xl flex items-center justify-center">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0A1F44]">AI Assistant</h1>
            <p className="text-sm font-medium text-[#006B43]">● Online</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-6 py-6 space-y-4 touch-pan-y">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${
              message.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                message.role === "user" ? "bg-[#0A1F44]" : "bg-white"
              }`}
            >
              {message.role === "user" ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Bot className="w-5 h-5 text-[#0A1F44]" />
              )}
            </div>

            <div className="flex-1 max-w-[75%]">
              <Card
                className={`p-4 rounded-3xl shadow-sm border-0 ${
                  message.role === "user"
                    ? "bg-[#0A1F44] text-white ml-auto"
                    : "bg-white"
                }`}
              >
                <p
                  className={`leading-relaxed ${
                    message.role === "user" ? "text-white" : "text-[#0A1F44]"
                  }`}
                >
                  {message.text}
                </p>

                {message.risk && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium ${getRiskColor(
                        message.risk,
                      )}`}
                    >
                      Risk Level: {message.risk}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        ))}

        {messages.length === 1 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#0A1F44] px-2">Try asking:</p>
            {suggestedQuestions.map((question, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSend(question)}
                className="w-full text-left p-3 bg-white rounded-2xl shadow-sm text-sm font-medium text-[#0A1F44] hover:shadow-md transition-shadow"
              >
                {question}
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="ai-typing">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer sits above MobileNav — no safe-area here (nav owns that). */}
      <div
        className="shrink-0 bg-white border-t border-gray-200 px-4 py-3"
        style={
          keyboardPadding > 0
            ? { paddingBottom: `calc(${keyboardPadding}px + 0.75rem)` }
            : undefined
        }
      >
        <div className="flex gap-3 items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask me anything..."
            maxLength={2000}
            className="flex-1 h-12 rounded-2xl bg-[#F5F7FA] border-0 text-[#0A1F44] placeholder:text-[#4B5563]"
          />
          <Button
            type="button"
            onClick={() => handleSend()}
            className="w-12 h-12 rounded-2xl bg-[#0A1F44] hover:bg-[#0A1F44]/90 shrink-0"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

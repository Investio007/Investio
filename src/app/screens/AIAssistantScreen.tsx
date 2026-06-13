import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Send, Bot, User } from "lucide-react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

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
      return "bg-[#FFB612]/10 text-[#FFB612]";
    case "High":
      return "bg-[#E03A3E]/10 text-[#E03A3E]";
  }
};

export function AIAssistantScreen() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question, risk: null }]);
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("Missing VITE_ANTHROPIC_API_KEY");
      }
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are Investio's AI investment advisor for South African users.
Answer every question in simple, plain English. Maximum 3 sentences.
Always end your response on a new line with exactly one of these:
Risk Level: Low
Risk Level: Moderate
Risk Level: High
Do not use markdown, bullet points, or formatting of any kind.`,
          messages: [{ role: "user", content: question }],
        }),
      });
      const data = await response.json();
      const fullText =
        data.content?.[0]?.text ||
        "I couldn't get a response right now. Please try again.";
      const lines = fullText.split("\n").filter((line: string) => line.trim());
      const riskLine =
        lines.find((line: string) =>
          line.toLowerCase().startsWith("risk level:"),
        ) || "";
      const mainText = lines
        .filter((line: string) => !line.toLowerCase().startsWith("risk level:"))
        .join(" ")
        .trim();
      const riskValue = riskLine.replace(/risk level:/i, "").trim();
      const normalizedRisk: Message["risk"] =
        riskValue === "Low" || riskValue === "Moderate" || riskValue === "High"
          ? riskValue
          : null;
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: mainText, risk: normalizedRisk },
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
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-3xl shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#0A1F44] rounded-2xl flex items-center justify-center">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0A1F44]">
              AI Assistant
            </h1>
            <p className="text-sm text-[#007A4D]">● Online</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${
              message.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                message.role === "user"
                  ? "bg-[#0A1F44]"
                  : "bg-[#F5F7FA]"
              }`}
            >
              {message.role === "user" ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Bot className="w-5 h-5 text-[#0A1F44]" />
              )}
            </div>

            {/* Message Bubble */}
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
                    message.role === "user" ? "text-white" : "text-gray-700"
                  }`}
                >
                  {message.text}
                </p>

                {message.risk && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium ${getRiskColor(
                        message.risk
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
        
        {/* Suggested Questions */}
        {messages.length === 1 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 px-2">Try asking:</p>
            {suggestedQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleSend(question)}
                className="w-full text-left p-3 bg-white rounded-2xl shadow-sm text-sm text-gray-700 hover:shadow-md transition-shadow"
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

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 safe-area-bottom">
        <div className="flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask me anything..."
            className="flex-1 h-12 rounded-2xl bg-[#F5F7FA] border-0 text-[#0A1F44] placeholder:text-gray-400"
          />
          <Button
            onClick={() => handleSend()}
            className="w-12 h-12 rounded-2xl bg-[#0A1F44] hover:bg-[#0A1F44]/90"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
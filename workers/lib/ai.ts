const AI_SYSTEM_PROMPT = `You are Crowth's AI investment advisor for South African users.
Answer every question in simple, plain English. Maximum 3 sentences.
Always end your response on a new line with exactly one of these:
Risk Level: Low
Risk Level: Moderate
Risk Level: High
Do not use markdown, bullet points, or formatting of any kind.`;

export type AiRiskLevel = "Low" | "Moderate" | "High";

export type AiChatResponse = {
  text: string;
  risk: AiRiskLevel | null;
};

/** Cloudflare Workers AI binding */
export interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export function parseAiResponse(fullText: string): AiChatResponse {
  const lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const riskLine = lines.find((l) => l.toLowerCase().startsWith("risk level:")) ?? "";
  const mainText = lines
    .filter((l) => !l.toLowerCase().startsWith("risk level:"))
    .join(" ")
    .trim();
  const riskValue = riskLine.includes(":") ? riskLine.split(":").slice(1).join(":").trim() : "";
  const risk: AiRiskLevel | null =
    riskValue === "Low" || riskValue === "Moderate" || riskValue === "High" ? riskValue : null;
  return {
    text: mainText || fullText.trim() || "I couldn't generate a response. Please try again.",
    risk,
  };
}

export async function chatWithWorkersAi(
  ai: AiBinding,
  message: string,
  model = DEFAULT_MODEL,
): Promise<AiChatResponse> {
  const result = await ai.run(model, {
    messages: [
      { role: "system", content: AI_SYSTEM_PROMPT },
      { role: "user", content: message },
    ],
    max_tokens: 256,
  });

  let content = "";
  if (typeof result === "string") {
    content = result;
  } else if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (typeof obj.response === "string") content = obj.response;
    else if (typeof obj.text === "string") content = obj.text;
    else if (Array.isArray(obj.result)) {
      content = obj.result.map(String).join("\n");
    }
  }

  if (!content.trim()) throw new Error("Workers AI returned an empty response");
  return parseAiResponse(content);
}

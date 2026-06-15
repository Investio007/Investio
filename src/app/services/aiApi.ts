const BASE_URL = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_MARKET_API_URL || "");

export type AiRiskLevel = "Low" | "Moderate" | "High";

export type AiChatResponse = {
  text: string;
  risk: AiRiskLevel | null;
};

export const aiApi = {
  chat: async (message: string): Promise<AiChatResponse> => {
    const response = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const errorBody = (await response
        .json()
        .catch(() => ({ detail: "Unknown error" }))) as { detail?: string };
      throw new Error(errorBody.detail || `AI error ${response.status}`);
    }

    return response.json() as Promise<AiChatResponse>;
  },
};

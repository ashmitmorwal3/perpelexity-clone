import { config } from "../config";
import type { SearchResult } from "../types";

export async function summarizeWithLlm(query: string, results: SearchResult[], historyContext: string) {
  if (!config.openAiApiKey || results.length === 0) return null;

  const context = results
    .map((item, idx) => `${idx + 1}. ${item.title}\n${item.snippet}\nSource: ${item.url}`)
    .join("\n\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You answer user questions from provided sources only. Keep response concise and factual. Mention uncertainty clearly."
        },
        {
          role: "user",
          content: `Conversation context:\n${historyContext}\n\nQuestion: ${query}\n\nSources:\n${context}`
        }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.output_text?.trim() || null;
}

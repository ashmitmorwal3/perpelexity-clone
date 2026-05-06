import { config } from "../../config";
import type { SearchResult } from "../../types";

type TavilyResult = {
  title?: string;
  content?: string;
  url?: string;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function searchWithTavily(query: string): Promise<SearchResult[]> {
  if (!config.tavilyApiKey) {
    throw new Error("Tavily API key is not configured.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: config.tavilyApiKey,
      query,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
      max_results: 8
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const resultsRaw = Array.isArray(payload?.results) ? (payload.results as TavilyResult[]) : [];

  return resultsRaw
    .filter((item) => item.url && item.content)
    .map((item) => ({
      title: cleanText(item.title || query),
      snippet: cleanText(item.content || ""),
      url: item.url as string
    }));
}

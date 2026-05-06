import { config } from "../../config";
import type { SearchResult } from "../../types";

type SerperItem = {
  title?: string;
  link?: string;
  snippet?: string;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function searchWithSerper(query: string): Promise<SearchResult[]> {
  if (!config.serperApiKey) {
    throw new Error("Serper API key is not configured.");
  }

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.serperApiKey
    },
    body: JSON.stringify({
      q: query,
      gl: "in",
      hl: "en",
      num: 8
    })
  });

  if (!response.ok) {
    throw new Error(`Serper failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const organic = Array.isArray(payload?.organic) ? (payload.organic as SerperItem[]) : [];

  return organic
    .filter((item) => item.link && item.snippet)
    .map((item) => ({
      title: cleanText(item.title || query),
      snippet: cleanText(item.snippet || ""),
      url: item.link as string
    }));
}

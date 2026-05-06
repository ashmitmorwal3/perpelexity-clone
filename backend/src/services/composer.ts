import type { SearchResult } from "../types";

export function composeFallbackAnswer(query: string, ranked: SearchResult[], historyContext: string) {
  if (ranked.length === 0) {
    return `I could not find reliable results for "${query}". Try adding more detail or narrowing the topic.`;
  }

  const top = ranked.slice(0, 3);
  const bullets = top.map((item, idx) => `${idx + 1}. ${item.snippet}`);
  const contextPrefix = historyContext
    ? `Using your recent chat context and web results, here is what I found:\n`
    : `Based on recent web results, here is what I found:\n`;

  return `${contextPrefix}${bullets.join("\n")}`;
}

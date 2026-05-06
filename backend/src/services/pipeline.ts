import type { SearchResult } from "../types";
import { config } from "../config";
import { searchWithDuckDuckGo } from "./search/duckduckgo";
import { searchWithTavily } from "./search/tavily";
import { searchWithSerper } from "./search/serper";
import { rankResults } from "./ranking";
import { summarizeWithLlm } from "./llm";
import { composeFallbackAnswer } from "./composer";

async function retrieveResults(query: string): Promise<SearchResult[]> {
  const provider = config.searchProvider;

  if (provider === "duckduckgo") {
    return searchWithDuckDuckGo(query);
  }

  if (provider === "serper") {
    const serperResults = await searchWithSerper(query);
    if (serperResults.length > 0) return serperResults;
    return searchWithDuckDuckGo(query);
  }

  if (provider === "tavily") {
    const tavilyResults = await searchWithTavily(query);
    if (tavilyResults.length > 0) return tavilyResults;
    return searchWithDuckDuckGo(query);
  }

  if (config.serperApiKey) {
    try {
      const serperResults = await searchWithSerper(query);
      if (serperResults.length > 0) return serperResults;
    } catch {
      // Continue to next provider in auto mode.
    }
  }

  if (config.tavilyApiKey) {
    try {
      const tavilyResults = await searchWithTavily(query);
      if (tavilyResults.length > 0) return tavilyResults;
    } catch {
      // Fallback to DuckDuckGo in auto mode.
    }
  }

  return searchWithDuckDuckGo(query);
}

export async function runAnswerPipeline(query: string, historyContext: string) {
  const rawResults = await retrieveResults(query);
  const ranked = rankResults(query, rawResults);
  const llmAnswer = await summarizeWithLlm(query, ranked, historyContext);
  const answer = llmAnswer ?? composeFallbackAnswer(query, ranked, historyContext);

  return {
    answer,
    sources: ranked.map((item: SearchResult) => item.url),
    results: ranked
  };
}

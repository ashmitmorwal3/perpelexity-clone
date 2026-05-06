import type { SearchResult } from "../../types";

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function flattenTopics(topics: any[]): Array<{ text?: string; firstUrl?: string }> {
  const flattened: Array<{ text?: string; firstUrl?: string }> = [];
  for (const topic of topics) {
    if (topic?.Text && topic?.FirstURL) {
      flattened.push({ text: topic.Text, firstUrl: topic.FirstURL });
      continue;
    }
    if (Array.isArray(topic?.Topics)) {
      flattened.push(...flattenTopics(topic.Topics));
    }
  }
  return flattened;
}

export async function searchWithDuckDuckGo(query: string): Promise<SearchResult[]> {
  const endpoint = new URL("https://api.duckduckgo.com/");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("no_html", "1");
  endpoint.searchParams.set("skip_disambig", "1");

  const response = await fetch(endpoint.toString());
  if (!response.ok) throw new Error("Search provider failed.");

  const payload = await response.json();
  const results: SearchResult[] = [];

  if (payload?.AbstractText && payload?.AbstractURL) {
    results.push({
      title: cleanText(payload.Heading || query),
      snippet: cleanText(payload.AbstractText),
      url: payload.AbstractURL
    });
  }

  const relatedTopics = flattenTopics(Array.isArray(payload?.RelatedTopics) ? payload.RelatedTopics : []);
  for (const topic of relatedTopics) {
    if (!topic.text || !topic.firstUrl) continue;
    if (topic.firstUrl.includes("/c/")) continue;

    const [title] = topic.text.split(" - ");
    results.push({
      title: cleanText(title || query),
      snippet: cleanText(topic.text),
      url: topic.firstUrl
    });
    if (results.length >= 8) break;
  }

  return results;
}

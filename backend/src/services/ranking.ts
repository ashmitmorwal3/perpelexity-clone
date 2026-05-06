import type { SearchResult } from "../types";

function normalize(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function rankResults(query: string, results: SearchResult[]): SearchResult[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return results
    .map((result) => {
      const haystack = `${result.title} ${result.snippet}`.toLowerCase();
      const termMatches = queryTerms.reduce((acc, term) => (haystack.includes(term) ? acc + 1 : acc), 0);
      const trustedBonus =
        normalize(result.url).includes("wikipedia.org") || normalize(result.url).includes(".edu") ? 2 : 0;
      return { ...result, score: termMatches + trustedBonus };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);
}

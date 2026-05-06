export type SearchBody = {
  query?: string;
};

export type ChatStreamBody = {
  sessionId?: string;
  query?: string;
};

export type SearchResult = {
  title: string;
  snippet: string;
  url: string;
  score?: number;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  at: string;
};

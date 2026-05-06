export const config = {
  port: Number(process.env.PORT ?? 3001),
  redisUrl: process.env.REDIS_URL ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  tavilyApiKey: process.env.TAVILY_API_KEY ?? "",
  serperApiKey: process.env.SERPER_API_KEY ?? "",
  searchProvider: (process.env.SEARCH_PROVIDER ?? "auto").toLowerCase()
};

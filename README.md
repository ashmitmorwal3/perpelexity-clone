# Perplexity Clone (React + Bun)

Production-style starter:
- `frontend`: React + Vite chat UI with streaming
- `backend`: Bun API with modular retrieval pipeline

## 1) Install

From project root:

```bash
bun install
```

Then install workspace dependencies:

```bash
cd frontend && bun install
cd ../backend && bun install
```

## 2) Run locally

Open two terminals:

Terminal 1:

```bash
cd backend
bun run dev
```

Terminal 2:

```bash
cd frontend
bun run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3001`

## 3) API endpoints

- `GET /health`
- `POST /api/search` (non-streaming)
- `POST /api/chat/stream` (SSE streaming)

## 4) Architecture

- **Search adapter**: DuckDuckGo retrieval (`services/search/duckduckgo.ts`)
- **Search adapter (premium)**: Tavily retrieval (`services/search/tavily.ts`)
- **Ranking layer**: simple relevance/trust scoring (`services/ranking.ts`)
- **Answer composer**: LLM-first with deterministic fallback
- **Streaming layer**: SSE deltas + done event
- **Chat memory**:
  - Redis when `REDIS_URL` is provided
  - in-memory fallback otherwise

## 5) Optional environment variables (backend)

- `OPENAI_API_KEY` for LLM summarization
- `REDIS_URL` for persistent chat memory
- `TAVILY_API_KEY` for higher-quality web retrieval
- `SERPER_API_KEY` for Google-quality web retrieval (via Serper)
- `SEARCH_PROVIDER` as `auto` (default), `serper`, `tavily`, or `duckduckgo`




xyz
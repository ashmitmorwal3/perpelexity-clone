import { config } from "./config";
import { runAnswerPipeline } from "./services/pipeline";
import { getSessionHistory, pushSessionMessage } from "./services/chatMemory";
import { json, sseHeaders } from "./utils/http";
import type { ChatStreamBody, SearchBody } from "./types";

function asContext(history: Array<{ role: "user" | "assistant"; content: string }>) {
  if (history.length === 0) return "";
  return history.map((m) => `${m.role}: ${m.content}`).join("\n");
}

async function parseBody<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}

async function streamText(
  controller: ReadableStreamDefaultController<Uint8Array>,
  answer: string,
  sources: string[]
) {
  const encoder = new TextEncoder();
  const chunkSize = 18;
  for (let i = 0; i < answer.length; i += chunkSize) {
    const delta = answer.slice(i, i + chunkSize);
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", delta })}\n\n`));
    await Bun.sleep(25);
  }
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", sources })}\n\n`));
  controller.close();
}

Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return json({ ok: true });
    }

    if (url.pathname === "/health") {
      return json({ status: "ok" });
    }

    if (url.pathname === "/api/search" && req.method === "POST") {
      try {
        const body = await parseBody<SearchBody>(req);
        const query = body.query?.trim();
        if (!query) return json({ error: "query is required." }, 400);

        const response = await runAnswerPipeline(query, "");
        return json({ query, answer: response.answer, sources: response.sources, results: response.results });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown backend error.";
        return json({ error: message }, 500);
      }
    }

    if (url.pathname === "/api/chat/stream" && req.method === "POST") {
      try {
        const body = await parseBody<ChatStreamBody>(req);
        const sessionId = body.sessionId?.trim();
        const query = body.query?.trim();
        if (!sessionId || !query) return json({ error: "sessionId and query are required." }, 400);

        const history = await getSessionHistory(sessionId);
        const historyContext = asContext(history);
        const response = await runAnswerPipeline(query, historyContext);

        await pushSessionMessage(sessionId, { role: "user", content: query, at: new Date().toISOString() });
        await pushSessionMessage(sessionId, {
          role: "assistant",
          content: response.answer,
          at: new Date().toISOString()
        });

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            void streamText(controller, response.answer, response.sources);
          }
        });

        return new Response(stream, { headers: sseHeaders() });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown backend error.";
        return json({ error: message }, 500);
      }
    }

    return json({ error: "Not found." }, 404);
  }
});

console.log(`Backend running at http://localhost:${config.port}`);

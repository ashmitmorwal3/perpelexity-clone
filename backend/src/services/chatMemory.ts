import { createClient, type RedisClientType } from "redis";
import { config } from "../config";
import type { ChatMessage } from "../types";

const inMemory = new Map<string, ChatMessage[]>();
let redisClient: RedisClientType | null = null;
let redisReady = false;

async function getRedis() {
  if (!config.redisUrl) return null;
  if (redisClient) return redisClient;

  try {
    redisClient = createClient({ url: config.redisUrl });
    redisClient.on("error", () => {
      redisReady = false;
    });
    await redisClient.connect();
    redisReady = true;
    return redisClient;
  } catch {
    redisReady = false;
    return null;
  }
}

function key(sessionId: string) {
  return `chat:history:${sessionId}`;
}

export async function getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
  const redis = await getRedis();
  if (redis && redisReady) {
    const raw = await redis.get(key(sessionId));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ChatMessage[];
    } catch {
      return [];
    }
  }
  return inMemory.get(sessionId) ?? [];
}

export async function pushSessionMessage(sessionId: string, message: ChatMessage) {
  const maxMessages = 16;
  const history = await getSessionHistory(sessionId);
  const next = [...history, message].slice(-maxMessages);

  const redis = await getRedis();
  if (redis && redisReady) {
    await redis.set(key(sessionId), JSON.stringify(next), { EX: 60 * 60 * 24 });
    return;
  }
  inMemory.set(sessionId, next);
}

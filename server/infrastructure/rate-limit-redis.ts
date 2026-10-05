import Redis from "ioredis";
import type { Options, Store } from "express-rate-limit";

export interface RateLimitRedisClient {
  status?: string;
  get?(key: string): Promise<string | null>;
  set?(key: string, value: string, expiryMode: 'EX', seconds: number): Promise<unknown>;
  incr?(key: string): Promise<number>;
  eval(script: string, keyCount: number, ...args: string[]): Promise<unknown>;
  decr(key: string): Promise<number>;
  del(key: string): Promise<number>;
}

const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

let sharedClient: RateLimitRedisClient | null = null;
let lastRedisWarningAt = 0;

export function getRateLimitRedisClient(): RateLimitRedisClient {
  if (sharedClient) return sharedClient;

  const client = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 250, 5000),
  });

  client.on("error", (error) => {
    const now = Date.now();
    if (now - lastRedisWarningAt >= 60_000) {
      lastRedisWarningAt = now;
      console.warn(`[DDoS] Redis rate-limit unavailable; application limiters fail open: ${error.message}`);
    }
  });

  sharedClient = client;
  return sharedClient;
}

export function isRateLimitRedisReady(client?: RateLimitRedisClient | Redis): boolean {
  const target = (client) || sharedClient;
  if (!target) return false;
  if (typeof target.status === "string") {
    return target.status === "ready";
  }
  return true;
}

export function setRateLimitRedisClientForTesting(client: RateLimitRedisClient) {
  sharedClient = client;
}

export class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = 60_000;

  constructor(
    private readonly client: RateLimitRedisClient,
    prefix: string,
  ) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string) {
    if (!isRateLimitRedisReady(this.client)) {
      return { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
    }
    try {
      const result = await this.client.eval(
        INCREMENT_SCRIPT,
        1,
        this.prefixed(key),
        String(this.windowMs),
      );
      if (!Array.isArray(result) || result.length < 2) {
        throw new Error("Invalid Redis rate-limit response");
      }
      const totalHits = Number(result[0]);
      const ttl = Math.max(0, Number(result[1]));
      if (!Number.isInteger(totalHits) || totalHits < 1) {
        throw new Error("Invalid Redis rate-limit hit count");
      }
      return { totalHits, resetTime: new Date(Date.now() + ttl) };
    } catch (err) {
      if (!isRateLimitRedisReady(this.client)) {
        return { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
      }
      throw err;
    }
  }

  async decrement(key: string): Promise<void> {
    if (!isRateLimitRedisReady(this.client)) return;
    try {
      await this.client.decr(this.prefixed(key));
    } catch {
      // Redis unavailable; fail open
    }
  }

  async resetKey(key: string): Promise<void> {
    if (!isRateLimitRedisReady(this.client)) return;
    try {
      await this.client.del(this.prefixed(key));
    } catch {
      // Redis unavailable; fail open
    }
  }

  private prefixed(key: string): string {
    return `${this.prefix}${key}`;
  }
}

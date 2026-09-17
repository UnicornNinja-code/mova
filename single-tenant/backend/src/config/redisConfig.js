import Redis from "ioredis";
import { env } from "./env.js";

const RETRY_STRATEGY_FACTOR_MS = 50;
const MAX_RETRY_DELAY_MS = 2000;

export const redisOptions = {
  host: env.REDIS.HOST,
  port: env.REDIS.PORT,
  password: env.REDIS.PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * RETRY_STRATEGY_FACTOR_MS, MAX_RETRY_DELAY_MS),
};

export const createRedisConnection = () => new Redis(redisOptions);

export const sharedRedisConnection = createRedisConnection();
sharedRedisConnection.on("error", () => {});

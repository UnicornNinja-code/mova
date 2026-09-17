import Redis, { type RedisOptions } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

export const createRedisConnection = (): Redis => new Redis(redisOptions);

export const sharedRedisConnection: Redis = createRedisConnection();

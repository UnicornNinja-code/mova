import { env } from "./env.js";
import { pool } from "./database.js";
import { redisClient } from "./redis.js";
import { sharedRedisConnection, redisOptions, createRedisConnection } from "./redisConfig.js";

export const initConfigurations = () => {
  return Promise.all([
    pool.query("SELECT 1"),
    redisClient.ping(),
  ]);
};

export { env, pool, redisClient, sharedRedisConnection, redisOptions, createRedisConnection };

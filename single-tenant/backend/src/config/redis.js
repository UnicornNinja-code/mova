import { createClient } from "redis";
import { env } from "./env.js";

const MAX_RECONNECT_RETRIES = 3;
const RETRY_BACKOFF_FACTOR_MS = 50;
const MAX_RECONNECT_DELAY_MS = 500;

export const redisClient = createClient({
  socket: {
    host: env.REDIS.HOST,
    port: env.REDIS.PORT,
    reconnectStrategy: (retries) => {
      if (retries > MAX_RECONNECT_RETRIES) {
        return false;
      }
      return Math.min(retries * RETRY_BACKOFF_FACTOR_MS, MAX_RECONNECT_DELAY_MS);
    },
  },
  password: env.REDIS.PASSWORD || undefined,
});

redisClient.on("connect", () => {
  console.log("⚡ Redis Client: Menghubungkan...");
});

redisClient.on("ready", () => {
  console.log("🔴 Redis Server berhasil terhubung & siap digunakan!");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis Client Error:", err.message);
});

redisClient.on("end", () => {
  console.log("🔌 Sambungan Redis terputus.");
});

redisClient.connect().catch((err) => {
  console.error("❌ Gagal menyambungkan Redis Client di awal:", err.message);
});

export default redisClient;
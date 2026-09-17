import { createClient } from "redis";
import { env } from "./env.js";

export const redisClient = createClient({
  socket: {
    host: env.REDIS.HOST || "127.0.0.1",
    port: Number(env.REDIS.PORT || 6379),
    reconnectStrategy: (retries) => {
      return Math.min(retries * 50, 2000);
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

redisClient.on("error", (err: any) => {
  console.error("❌ Redis Client Error:", err.message);
});

redisClient.on("end", () => {
  console.log("🔌 Sambungan Redis terputus.");
});

redisClient.connect().catch((err: any) => {
  console.error("❌ Gagal menyambungkan Redis Client di awal:", err.message);
});

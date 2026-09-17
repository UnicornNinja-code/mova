import { pool } from "../config/database.js";
import { hashPassword } from "../utils/crypto.js";
import { redisClient } from "../config/redis.js";

async function main() {
  const hash = await hashPassword("password123");
  await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hash, "superadmin@kopikeliling.com"]);
  await redisClient.del(["auth:failed:ip:127.0.0.1", "auth:failed:user:superadmin@kopikeliling.com"]);
  console.log("Superadmin password reset to password123 and failed attempt counters cleared.");
  process.exit(0);
}

main().catch(console.error);

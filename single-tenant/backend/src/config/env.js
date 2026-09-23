import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Intelligent multi-level .env locator
// Checks:
// 1. process.cwd()/.env (current working directory)
// 2. single-tenant/backend/.env (relative to src/config)
// 3. mova/single-tenant/backend/.env (from repo root or workspace root)
const possibleEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../single-tenant/backend/.env"),
  path.resolve(__dirname, "../../../../mova/single-tenant/backend/.env"),
];

let envLoadedFrom = null;
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoadedFrom = envPath;
    break;
  }
}

// Fallback to default dotenv if none matched
if (!envLoadedFrom) {
  dotenv.config();
}

const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_PORT = 8090;
const DEFAULT_DB_PORT = 5432;
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_REFRESH_TOKEN_DAYS = 30;
const DEFAULT_JWT_EXPIRES = "1d";

const DEV_FALLBACK_TURNSTILE_KEY = "1x0000000000000000000000000000000AA";
const DEV_FALLBACK_JWT_SECRET = "dev_local_jwt_secret_non_prod_only_must_be_long_enough_2026";
const DEV_FALLBACK_FRONTEND_URL = "http://localhost:8074";

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const isTest = nodeEnv === "test";
const isDevelopment = nodeEnv === "development";

if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < MIN_JWT_SECRET_LENGTH) {
    console.error(
      `💥 FATAL CONFIGURATION ERROR: 'JWT_SECRET' is required in production and must be at least ${MIN_JWT_SECRET_LENGTH} characters long!`
    );
    process.exit(1);
  }
  if (!process.env.FRONTEND_URL) {
    console.error("💥 FATAL CONFIGURATION ERROR: 'FRONTEND_URL' is required in production mode!");
    process.exit(1);
  }
}

export const env = {
  PORT: Number(process.env.PORT || DEFAULT_PORT),
  NODE_ENV: nodeEnv,
  isProduction,
  isTest,
  isDevelopment,
  envLoadedFrom,

  DB: {
    HOST: process.env.DB_HOST || "localhost",
    PORT: Number(process.env.DB_PORT || DEFAULT_DB_PORT),
    USER: process.env.DB_USER || "postgres",
    PASSWORD: process.env.DB_PASSWORD || "secret",
    NAME: process.env.DB_NAME || "mova_db",
    POOL_MAX: Number(process.env.DB_POOL_MAX || 20),
    POOL_MIN: Number(process.env.DB_POOL_MIN || 4),
  },

  REDIS: {
    HOST: process.env.REDIS_HOST || "127.0.0.1",
    PORT: Number(process.env.REDIS_PORT || DEFAULT_REDIS_PORT),
    PASSWORD: process.env.REDIS_PASSWORD?.trim() || undefined,
  },

  JWT: {
    SECRET: process.env.JWT_SECRET || (isProduction ? undefined : DEV_FALLBACK_JWT_SECRET),
    EXPIRES: process.env.JWT_EXPIRES || DEFAULT_JWT_EXPIRES,
    REFRESH_TOKEN_DAYS: Number(process.env.REFRESH_TOKEN_DAYS || DEFAULT_REFRESH_TOKEN_DAYS),
  },

  // Backward-compatible top-level JWT_SECRET
  JWT_SECRET: process.env.JWT_SECRET || (isProduction ? undefined : DEV_FALLBACK_JWT_SECRET),

  FRONTEND_URL: process.env.FRONTEND_URL || (isProduction ? undefined : DEV_FALLBACK_FRONTEND_URL),
  ADDITIONAL_ALLOWED_ORIGINS: process.env.ADDITIONAL_ALLOWED_ORIGINS
    ? process.env.ADDITIONAL_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [],

  SMTP: process.env.SMTP_HOST
    ? {
        HOST: process.env.SMTP_HOST,
        PORT: Number(process.env.SMTP_PORT || DEFAULT_SMTP_PORT),
        USER: process.env.SMTP_USER,
        PASS: process.env.SMTP_PASS,
        FROM: process.env.SMTP_FROM || '"MOVA Control Room" <noreply@mantakopi.com>',
      }
    : null,

  TURNSTILE: {
    ENABLED: process.env.TURNSTILE_ENABLED !== "false",
    SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || (isProduction ? undefined : DEV_FALLBACK_TURNSTILE_KEY),
  },

  OPERATIONAL_SCOPE: {
    CITY: (process.env.OPERATIONAL_CITY || "Sidoarjo").replace(/["']/g, "").trim(),
    PROVINCE: (process.env.OPERATIONAL_PROVINCE || "Jawa Timur").replace(/["']/g, "").trim(),
    COUNTRY: (process.env.OPERATIONAL_COUNTRY || "Indonesia").replace(/["']/g, "").trim(),
    ADMIN_LEVEL: Number(process.env.OPERATIONAL_ADMIN_LEVEL || 5),
    BBOX: {
      minLat: Number(process.env.OPERATIONAL_BBOX_MIN_LAT || -7.65),
      maxLat: Number(process.env.OPERATIONAL_BBOX_MAX_LAT || -7.25),
      minLon: Number(process.env.OPERATIONAL_BBOX_MIN_LON || 112.45),
      maxLon: Number(process.env.OPERATIONAL_BBOX_MAX_LON || 112.95),
    },
    CENTER: {
      latitude: Number(process.env.OPERATIONAL_CENTER_LAT || -7.4478),
      longitude: Number(process.env.OPERATIONAL_CENTER_LON || 112.7183),
    },
  },
};

export default env;
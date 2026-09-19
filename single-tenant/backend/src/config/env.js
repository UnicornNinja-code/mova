import "dotenv/config";

const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_PORT = 8090;
const DEFAULT_DB_PORT = 5432;
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_SMTP_PORT = 587;
const DEV_FALLBACK_TURNSTILE_KEY = "1x0000000000000000000000000000000AA";
const DEV_FALLBACK_JWT_SECRET = "dev_local_jwt_secret_non_prod_only";
const DEV_FALLBACK_FRONTEND_URL = "http://localhost:8074";

const isProduction = process.env.NODE_ENV === "production";

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
  NODE_ENV: process.env.NODE_ENV || "development",
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
};

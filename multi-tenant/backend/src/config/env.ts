import "dotenv/config";

export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  DB: {
    HOST: string;
    PORT: number;
    USER: string;
    PASSWORD?: string;
    NAME: string;
  };
  REDIS: {
    HOST: string;
    PORT: number;
    PASSWORD?: string;
  };
  JWT_SECRET: string;
  REFRESH_TOKEN_DAYS: number;
  FRONTEND_URL: string;
  SMTP: {
    HOST: string;
    PORT: number;
    USER?: string;
    PASS?: string;
    FROM: string;
  } | null;
  SECURITY: {
    CAPTCHA_SECRET: string;
    CAPTCHA_TTL_SECONDS: number;
    AUTH_LOGIN_IP_LIMIT: number;
    AUTH_LOGIN_ACCOUNT_LIMIT: number;
    AUTH_CAPTCHA_IP_LIMIT: number;
    AUTH_PROGRESSIVE_CAPTCHA_THRESHOLD: number;
  };
}

export const env: EnvConfig = {
  PORT: Number(process.env.PORT || 9001),
  NODE_ENV: process.env.NODE_ENV || "development",
  DB: {
    HOST: process.env.DB_HOST || "localhost",
    PORT: Number(process.env.DB_PORT || 5432),
    USER: process.env.DB_USER || "postgres",
    PASSWORD: process.env.DB_PASSWORD || "secret",
    NAME: process.env.DB_NAME || "my_db",
  },
  REDIS: {
    HOST: process.env.REDIS_HOST || "localhost",
    PORT: Number(process.env.REDIS_PORT || 6379),
    PASSWORD: process.env.REDIS_PASSWORD || undefined,
  },
  JWT_SECRET: process.env.JWT_SECRET || "mova_jwt_secretkey_2026",
  REFRESH_TOKEN_DAYS: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  SMTP: process.env.SMTP_HOST
    ? {
        HOST: process.env.SMTP_HOST,
        PORT: Number(process.env.SMTP_PORT || 587),
        USER: process.env.SMTP_USER,
        PASS: process.env.SMTP_PASS,
        FROM: process.env.SMTP_FROM || '"MOVA System" <noreply@mova.internal>',
      }
    : null,
  SECURITY: {
    CAPTCHA_SECRET: process.env.CAPTCHA_SECRET || "mova_captcha_hmac_secret_salt_2026",
    CAPTCHA_TTL_SECONDS: Number(process.env.CAPTCHA_TTL_SECONDS || 60),
    AUTH_LOGIN_IP_LIMIT: Number(process.env.AUTH_LOGIN_IP_LIMIT || 20),
    AUTH_LOGIN_ACCOUNT_LIMIT: Number(process.env.AUTH_LOGIN_ACCOUNT_LIMIT || 10),
    AUTH_CAPTCHA_IP_LIMIT: Number(process.env.AUTH_CAPTCHA_IP_LIMIT || 60),
    AUTH_PROGRESSIVE_CAPTCHA_THRESHOLD: Number(process.env.AUTH_PROGRESSIVE_CAPTCHA_THRESHOLD || 3),
  },
};

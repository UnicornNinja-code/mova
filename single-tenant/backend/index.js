import http from "http";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";

import { pool, env, redisClient } from "./src/config/index.js";
import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import poiCategoryRoutes from "./src/routes/poiCategoryRoutes.js";
import poiRoutes from "./src/routes/poiRoutes.js";
import roadRoutes from "./src/routes/roadRoutes.js";
import weatherRoutes from "./src/routes/weatherRoutes.js";
import competitorRoutes from "./src/routes/competitorRoutes.js";
import dssRoutes from "./src/routes/dssRoutes.js";
import distributionRoutes from "./src/routes/distributionRoutes.js";
import armadaRoutes from "./src/routes/armadaRoutes.js";
import riderOperationalRoutes from "./src/routes/riderOperationalRoutes.js";
import auditRoutes from "./src/routes/auditRoutes.js";
import cronRoutes from "./src/routes/cronRoutes.js";
import lbsRoutes from "./src/routes/lbsRoutes.js";
import zoneRoutes from "./src/routes/zoneRoutes.js";
import candidateSellingLocationRoutes from "./src/routes/candidateSellingLocationRoutes.js";
import systemSettingRoutes from "./src/routes/systemSettingRoutes.js";
import productRoutes from "./src/routes/productRoutes.js";
import salesRoutes from "./src/routes/salesRoutes.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import syncRoutes from "./src/routes/syncRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import reportRoutes from "./src/routes/reportRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";

import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { apiLimiter } from "./src/middlewares/rateLimiterMiddleware.js";

// Initialize BullMQ Queues and Background Workers
import { overpassWorker } from "./src/workers/overpassWorker.js";
import { armadaHoldWorker } from "./src/workers/armadaHoldWorker.js";
import { notificationWorker } from "./src/workers/notificationWorker.js";
import { dssBatchWorker } from "./src/workers/dssBatchWorker.js";
import { overpassSyncQueue } from "./src/queues/overpassQueue.js";
import { armadaHoldQueue } from "./src/queues/armadaHoldQueue.js";
import { notificationQueue } from "./src/queues/notificationQueue.js";
import { dssBatchQueue } from "./src/queues/dssBatchQueue.js";
import { sendError } from "./src/utils/apiResponse.js";



// Initialize Socket.io Real-Time & LBS Handlers
import { socketManager } from "./src/socket/socketManager.js";
import { registerLbsSocketHandlers } from "./src/socket/lbsHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerDocument = YAML.load(path.join(__dirname, "src/docs/swagger.yaml"));

const app = express();
const server = http.createServer(app);

const isProduction = env.NODE_ENV === "production";

// 0. HTTP Security Headers via Helmet (Configured for Swagger & GeoJSON compatibility)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        connectSrc: ["'self'", "http:", "https:", "ws:", "wss:"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
);

// 1. Enable CORS Middleware with strict origin whitelist & safe rejection
const allowedOrigins = isProduction
  ? [env.FRONTEND_URL, ...(env.ADDITIONAL_ALLOWED_ORIGINS || [])].filter(Boolean)
  : [
    env.FRONTEND_URL,
    "http://localhost:8074",
    "http://127.0.0.1:8074",
  ].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, server-to-server, mobile native)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Gracefully reject unauthorized origin without throwing 500 error
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Initialize Socket.io Server & Handlers
const io = socketManager.init(server);
registerLbsSocketHandlers(io);

// 1. Level-6 HTTP Payload Compression (Optimal balance between CPU usage & compression ratio)
app.use(
  compression({
    level: 6,
    threshold: 512,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  })
);

// 2. Global Distributed Rate Limiter for API Endpoints
app.use("/api", apiLimiter);

// 2. Cookie Parser (Read refresh token from HTTP-Only cookie)
app.use(cookieParser());

// 3. Express JSON Body Parser
app.use(express.json());

// 3. Static GeoJSON File Serving with Cache-Control Header
app.use(
  "/data-map",
  express.static(path.join(__dirname, "public"), {
    maxAge: "1d",
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=86400");
    },
  })
);

// 3. Swagger / OpenAPI 3.0 Documentation & Developer Portal (api-documenter standard)
const swaggerCustomOptions = {
  customSiteTitle: "MOVA DSS Engine — API Documentation & Developer Portal",
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 24px 0 16px 0; }
    .swagger-ui .info .title { font-size: 28px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; }
    .swagger-ui .info p { font-size: 14px; color: #475569; line-height: 1.6; }
    .swagger-ui .opblock { border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 12px; }
    .swagger-ui .opblock .opblock-summary { padding: 8px 16px; }
    .swagger-ui .btn { border-radius: 6px; font-weight: 600; font-size: 13px; }
    .swagger-ui select { border-radius: 6px; }
    .swagger-ui input[type=text] { border-radius: 6px; }
    .swagger-ui .wrapper { max-width: 1300px; padding: 0 20px; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    docExpansion: "none",
    defaultModelsExpandDepth: 1,
    syntaxHighlight: {
      activate: true,
      theme: "monokai",
    },
  },
};

// Machine-readable OpenAPI specification endpoints (JSON & YAML)
app.get(["/api-docs.json", "/api-docs/openapi.json"], (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-cache");
  return res.json(swaggerDocument);
});

app.get(["/api-docs.yaml", "/api-docs/openapi.yaml"], (req, res) => {
  res.setHeader("Content-Type", "text/yaml; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  return res.sendFile(path.join(__dirname, "src/docs/swagger.yaml"));
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerCustomOptions));

// 4. Register Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/poi-categories", poiCategoryRoutes);
app.use("/api/pois", poiRoutes);
app.use("/api/roads", roadRoutes);
app.use("/api/weathers", weatherRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/competitors", competitorRoutes);
app.use("/api/dss", dssRoutes);
app.use("/api/distribution", distributionRoutes);
app.use("/api/armadas", armadaRoutes);
app.use("/api/fleets", armadaRoutes);
app.use("/api/rider", riderOperationalRoutes);
app.use("/api/rider-operational", riderOperationalRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/cron-management", cronRoutes);
app.use("/api/lbs", lbsRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/candidate-selling-locations", candidateSellingLocationRoutes);
app.use("/api/system-settings", systemSettingRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/system", systemSettingRoutes);

// 404 Catch-All Middleware for Unmatched Routes (Returns JSON Envelope)
app.use((req, res) => {
  return sendError(
    res,
    `Rute '${req.method} ${req.originalUrl}' tidak ditemukan di server.`,
    404,
    null,
    {
      type: "warning",
      title: "Endpoint Tidak Ditemukan",
      message: `Rute '${req.method} ${req.originalUrl}' tidak terdaftar pada API MantaKopi.`,
    }
  );
});

// Global Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("💥 Global Server Error:", err);
  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    status: "error",
    statusCode,
    code: err.code || undefined,
    msg: err.message || "Internal Server Error",
    details: err.details || undefined,
  });
});

async function startServer() {
  try {
    // Check Database connection
    await pool.query("SELECT 1");
    console.log("🐘 PostgreSQL & PostGIS Terhubung!");

    // Start Express HTTP + WebSockets Server
    server.listen(env.PORT, () => {
      console.log(`🚀 HTTP & Socket.io Real-Time Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (error) {
    console.error("❌ Gagal menyalakan server:", error.message);
    process.exit(1);
  }
}

// Graceful Shutdown Sequence & Process Crash Guards
let isShuttingDown = false;

async function gracefulShutdown(signal, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 [SHUTDOWN] Menerima sinyal ${signal}. Memulai proses graceful shutdown...`);

  // Force exit safety timeout (10 seconds)
  const forceTimeout = setTimeout(() => {
    console.error("⚠️ [SHUTDOWN TIMEOUT] Memaksa proses keluar setelah 10 detik.");
    process.exit(1);
  }, 10000);
  forceTimeout.unref();

  try {
    // 1. Close HTTP & WebSocket server
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
      console.log("   ✅ HTTP & WebSocket server ditutup.");
    }

    // 2. Disconnect Socket.io clients
    if (io) {
      io.disconnectSockets(true);
      console.log("   ✅ Seluruh koneksi Socket.io diputus.");
    }

    // 3. Gracefully close BullMQ background workers and queues
    await Promise.allSettled([
      overpassWorker.close(),
      armadaHoldWorker.close(),
      notificationWorker.close(),
      dssBatchWorker.close(),
      overpassSyncQueue.close(),
      armadaHoldQueue.close(),
      notificationQueue.close(),
      dssBatchQueue.close(),
    ]);
    console.log("   ✅ Seluruh BullMQ workers & queues ditutup.");


    // 4. Disconnect Redis Client
    if (redisClient.isOpen || redisClient.isReady) {
      await redisClient.quit();
      console.log("   ✅ Sambungan Redis diputus.");
    }

    // 5. Drain and close PostgreSQL connection pool
    await pool.end();
    console.log("   ✅ Pool PostgreSQL & PostGIS ditutup.");

    console.log("🏁 [SHUTDOWN COMPLETE] Graceful shutdown selesai dengan bersih.\n");
    process.exit(exitCode);
  } catch (err) {
    console.error("💥 [SHUTDOWN ERROR] Kesalahan saat shutdown:", err);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 [UNHANDLED REJECTION] Janji ditolak tanpa penanganan:", reason);
  if (isProduction) {
    gracefulShutdown("unhandledRejection", 1);
  }
});

process.on("uncaughtException", (err) => {
  console.error("💥 [UNCAUGHT EXCEPTION] Kesalahan fatal yang tidak tertangkap:", err);
  gracefulShutdown("uncaughtException", 1);
});

process.on("SIGTERM", () => gracefulShutdown("SIGTERM", 0));
process.on("SIGINT", () => gracefulShutdown("SIGINT", 0));

export { app, server, startServer, gracefulShutdown };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer();
}


/*
 * index.ts
 * Main Entry Point for Koling App Backend on Bun + TypeScript
 * Configures Express 5, PostGIS, Socket.IO, BullMQ Workers, Redis Geo & Security Middlewares.
 */

import http from "http";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import { traceMiddleware } from "./src/middlewares/traceMiddleware.js";

import { pool, env } from "./src/config/index.js";
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
import systemRoutes from "./src/routes/systemRoutes.js";
import productRoutes from "./src/routes/productRoutes.js";
import salesRoutes from "./src/routes/salesRoutes.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import dataSyncRoutes from "./src/routes/dataSyncRoutes.js";
import reportRoutes from "./src/routes/reportRoutes.js";
import tenantRoutes from "./src/routes/tenantRoutes.js";
import historicalAnalyticsRoutes from "./src/routes/historicalAnalyticsRoutes.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./src/docs/swagger.js";

// Initialize BullMQ Background Workers
import "./src/workers/overpassWorker.js";
import "./src/workers/armadaHoldWorker.js";
import "./src/workers/notificationWorker.js";
import "./src/workers/dssBatchWorker.js";

// Initialize Socket.io Real-Time & LBS Handlers
import { socketManager } from "./src/socket/socketManager.js";
import { registerLbsSocketHandlers } from "./src/socket/lbsHandler.js";
import { apiLimiter } from "./src/middlewares/rateLimiterMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 0. Enable Trace & CORS Middleware
app.use(traceMiddleware);
app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        "http://localhost:9967",
        "http://127.0.0.1:9967",
        "http://localhost:9968",
        "http://127.0.0.1:9968",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:9000",
        "http://localhost:5000",
      ];
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === "development") {
        return callback(null, true);
      }
      return callback(new Error("Blocked by CORS policy"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
  })
);

// Initialize Socket.io Server & Handlers
const io = socketManager.init(server);
registerLbsSocketHandlers(io);

// 1. Level-9 HTTP Payload Compression
app.use(
  compression({
    level: 9,
    threshold: 512,
    filter: (req: Request, res: Response) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  })
);

// 2. Global Distributed Rate Limiter for API Endpoints
app.use("/api", apiLimiter);

// 3. Cookie Parser & Express JSON Body Parser
app.use(cookieParser());
app.use(express.json());

// 4. Static GeoJSON File Serving with Cache-Control Header
app.use(
  "/data-map",
  express.static(path.join(__dirname, "public"), {
    maxAge: "1d",
    setHeaders: (res: Response) => {
      res.setHeader("Cache-Control", "public, max-age=86400");
    },
  })
);

// 4.1 Static Uploaded Media (WebP Compressed Images)
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    maxAge: "7d",
    setHeaders: (res: Response) => {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  })
);

// 4.2 Health Check Endpoint
app.get("/api/health", (_req: Request, res: Response): any => {
  return res.status(200).json({
    status: "ok",
    service: "Koling DSS Backend",
    runtime: "Bun + TypeScript",
    timestamp: new Date().toISOString(),
  });
});

// 4.3 Interactive OpenAPI / Swagger Documentation
app.get("/api/docs.json", (_req: Request, res: Response): any => {
  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(swaggerSpec);
});

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "MOVA API Documentation - Move Where Demand Is.",
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "none",
      filter: true,
      tryItOutEnabled: true,
    },
  })
);

// 5. Register Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/poi-categories", poiCategoryRoutes);
app.use("/api/pois", poiRoutes);
app.use("/api/roads", roadRoutes);
app.use("/api/weathers", weatherRoutes);
app.use("/api/competitors", competitorRoutes);
app.use("/api/dss", dssRoutes);
app.use("/api/distribution", distributionRoutes);
app.use("/api/armadas", armadaRoutes);
app.use("/api/fleets", armadaRoutes);
app.use("/api/rider", riderOperationalRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/cron-management", cronRoutes);
app.use("/api/lbs", lbsRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/candidate-selling-locations", candidateSellingLocationRoutes);
app.use("/api/system-settings", systemSettingRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/data-sync", dataSyncRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/analytics/historical", historicalAnalyticsRoutes);

// Global Centralized Error Handling Middleware (PART 00 Canonical Error Envelope)
app.use((err: any, req: Request, res: Response, _next: NextFunction): any => {
  console.error("💥 Global Server Error:", err);
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || (statusCode === 400 ? "BAD_REQUEST" : statusCode === 401 ? "UNAUTHORIZED" : statusCode === 403 ? "FORBIDDEN" : statusCode === 404 ? "NOT_FOUND" : statusCode === 409 ? "CONFLICT" : statusCode === 422 ? "UNPROCESSABLE_ENTITY" : "INTERNAL_SERVER_ERROR");
  const message = err.message || "Terjadi kesalahan internal pada server.";
  const requestId = req.requestId || (req.headers["x-request-id"] as string) || `req-${Date.now()}`;

  return res.status(statusCode).json({
    success: false,
    status: "error", // Backward-compatibility
    statusCode,      // Backward-compatibility
    msg: message,    // Backward-compatibility
    error: {
      code: errorCode,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
      request_id: requestId,
    },
  });
});

import { cronManagerService } from "./src/services/cron/CronManagerService.js";

async function startServer() {
  try {
    // Check Database connection
    await pool.query("SELECT 1");
    console.log("🐘 PostgreSQL & PostGIS Terhubung!");

    // Initialize Bun 1.4 Native Cron Scheduler
    cronManagerService.initBunCronScheduler();

    // Start Express HTTP + WebSockets Server on Bun
    server.listen(env.PORT, () => {
      console.log(`🚀 [BUN 1.4 + TYPESCRIPT] Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (error: any) {
    console.error("❌ Gagal menyalakan server:", error.message);
    process.exit(1);
  }
}

export { app, server, startServer };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer();
}
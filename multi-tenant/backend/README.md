# Koling App Backend (Bun + TypeScript Migration)

Sistem Backend Koling (MantaKopi Decision Support System) yang telah dimigrasikan secara penuh dari Node.js ke **Bun v1.3.11** dan **TypeScript** dengan strict type safety, performa ultra-cepat, dan arsitektur enterprise modular.

---

## 🛠️ Tech Stack & Ekosistem
- **Runtime**: [Bun v1.3.11](https://bun.com)
- **Language**: TypeScript (`strict: true`)
- **HTTP Server**: Express 5
- **Real-Time Communication**: Socket.IO (WebSockets with JWT Handshake Auth & Room Clustering)
- **Primary Database**: PostgreSQL 16 + PostGIS extension
- **In-Memory Store & Cache**: Redis (ioredis & redis client)
- **Job Queues & Delayed Workers**: BullMQ (Overpass POI Sync, Delayed Armada Ticket-Booking Lock, Notifications, Batch DSS)
- **Decision Support System (DSS)**:
  - **BWM (Best-Worst Method)**: Solved via `javascript-lp-solver` Simplex Linear Programming (CR <= 0.10)
  - **TOPSIS (Technique for Order Preference by Similarity to Ideal Solution)**: Vector Normalization, Euclidian Distance ($D^+, D^-$), & Relative Closeness ($V_i$)

---

## 📁 Struktur Direktori

```
backend/
├── public/                 # Static GeoJSON & Map assets
│   └── geojson/            # Layer jalan protokol & geospasial
├── src/
│   ├── config/             # Database (pg pool), Redis, env, mailer
│   ├── controllers/        # 20 Express HTTP Controllers
│   ├── db/                 # SQL Schemas & Versioned Migrations
│   ├── events/             # Canonical Event Publisher, Envelopes & Types
│   ├── middlewares/        # JWT Auth, RBAC, Redis Rate Limiters
│   ├── models/             # Data models & query mappers
│   ├── queues/             # BullMQ Queue Producers
│   ├── repositories/       # Data Access Layer & PostGIS queries
│   ├── routes/             # 20 Express API Route definitions
│   ├── scripts/            # CLI utilities (db:migrate, db:seed, db:setup, etc.)
│   ├── services/           # Business logic & algorithms:
│   │   ├── cron/           # Distributed Cron Manager with Redis Locks
│   │   ├── dashboard/      # Analytics & summary aggregators
│   │   ├── distribution/   # FIFO + TOPSIS Plotting Engine
│   │   ├── dss/            # BWM Simplex LP & TOPSIS Recommendation Engine
│   │   ├── lbs/            # Redis Geospatial (GEOADD/GEORADIUS) & Geofencing
│   │   ├── poi/            # Clustering, Deduplication, Overpass sync, Weather/Time score
│   │   ├── product/        # Menu catalog with historical sales guard
│   │   ├── rider/          # 5-minute ticket-booking hold, check-in, sales, checkout
│   │   └── sales/          # Aggregated sales reporting
│   ├── socket/             # Socket.io connection manager & LBS tracking handlers
│   ├── types/              # Comprehensive TypeScript interfaces & types
│   ├── utils/              # Audit logger, string similarity, OpenMeteo client, etc.
│   └── workers/            # BullMQ background workers
├── index.ts                # Server bootstrap entrypoint
├── package.json            # Scripts & dependencies
└── tsconfig.json           # Strict TypeScript configuration
```

---

## 🚀 Perintah CLI (Scripts)

| Perintah | Deskripsi |
| :--- | :--- |
| `bun run dev` | Menjalankan development server dengan auto-reload / file watcher |
| `bun run start` | Menjalankan server backend secara langsung |
| `bun run typecheck` | Menjalankan validasi type checking TypeScript (`tsc --noEmit`) |
| `bun run db:migrate` | Menjalankan eksekusi skema database dan seluruh file migrasi SQL |
| `bun run db:seed` | Mengisi baseline data bersih (akun Superadmin/SPV/Rider, Kriteria DSS, Armada, Zona) |
| `bun run db:setup` | Menjalankan Full DB reset + migrasi + seeding + sinkronisasi data awal |
| `bun run db:recluster` | Menjalankan re-clustering dan pembersihan data POI di database |
| `bun run fetch:weather` | Mengambil data cuaca zona operasional langsung dari Open-Meteo API |
| `bun run sync:toll-roads`| Mengambil dan memperbarui batasan spasial jalan tol dari Overpass API |

---

## 🔒 Konfigurasi Environment (`.env`)
Salin `.env.example` ke `.env` dan sesuaikan nilainya:
```env
PORT=5000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=koling_db
DB_USER=postgres
DB_PASSWORD=your_password
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_SECRET=your_super_secret_jwt_key
```

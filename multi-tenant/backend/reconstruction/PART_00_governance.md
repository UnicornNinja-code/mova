# PART 00 — RECONSTRUCTION GOVERNANCE & BASELINE

## 1. Objective
Establish reconstruction governance rules, inventory baseline, and progress protocol. This part defines HOW reconstruction is managed, not what is built.

## 2. Requirement IDs
- SCOPE-001, SCOPE-002, SCOPE-003, SCOPE-004, SCOPE-005
- ROLE-001, ROLE-002, ROLE-003, ROLE-004
- NFR-001, NFR-002, NFR-003

## 3. UI Requirements
None. Governance part.

## 4. User Stories
- As a reconstruction agent, I need a clear governance protocol so that each part can be worked independently without context loss.
- As a project owner, I need traceable progress so that I can verify reconstruction completeness.

## 5. Functional Requirements
- Inventory of all routes, controllers, services, repositories, workers, and database tables must be documented
- Baseline test suite must pass before reconstruction begins
- TypeScript compilation must have zero errors

## 6. State Machine
N/A

## 7. API Contract (Global Architectural Baseline)
Semua respons HTTP dari endpoint backend WAJIB dibungkus menggunakan standard canonical envelope. Controller tidak diizinkan mengembalikan root array mentah atau struktur JSON bebas tanpa pembungkus.

### 7.1. Global Success Envelope (Single Resource / Command)
Digunakan untuk operasi mutasi (POST, PUT, PATCH, DELETE) dan pengambilan data tunggal (GET single resource).
```json
{
  "success": true,
  "message": "Resource created successfully",
  "data": { ... },
  "meta": {
    "timestamp": "2026-09-03T01:14:00.000Z",
    "request_id": "req-c8f9b2d1-4e7a"
  }
}
```
*Catatan:*
- `message`: Wajib ada sebagai umpan balik operasional.
- `data`: Berisi payload objek inti; bernilai `null` jika endpoint hanya mengembalikan notifikasi tindakan (misal: logout, trigger background worker).
- `meta.request_id`: Wajib diinjeksi via trace middleware untuk kebutuhan observabilitas dan log correlation.

### 7.2. Global Success Envelope (Paginated / Collection)
Digunakan untuk semua query endpoint berbasis daftar (`GET /api/*` dengan filter, sorting, atau pagination).
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_records": 125,
    "total_pages": 7,
    "has_next": true,
    "has_prev": false
  },
  "meta": {
    "timestamp": "2026-09-03T01:14:00.000Z",
    "request_id": "req-c8f9b2d1-4e7a"
  }
}
```

## 8. Request Schema (Global Validation Protocol)

### 8.1. Content-Type Policy
- Semua permintaan payload mutasi wajib menyertakan header `Content-Type: application/json`, kecuali endpoint khusus unggah berkas (misal: `/api/products/upload-image`) yang menggunakan `multipart/form-data`.
- Endpoint yang menerima pagination wajib mematuhi query parameters standard:
  - `page`: integer (min: 1, default: 1)
  - `limit`: integer (min: 1, max: 100, default: 20)
  - `sort_by`: string (nama kolom terdaftar)
  - `sort_order`: `"asc" | "desc"` (default: `"desc"`)

### 8.2. Request Parsing & Sanitization Guardrails
- **Strict Controller DTO Parsing:** Controller dilarang meneruskan `req.body` mentah ke domain service. Validasi skema (menggunakan Zod atau TypeBox) wajib dijalankan di level route/controller sebelum service method dipanggil.
- **Payload Stripping:** Properti tidak dikenal (*unknown fields*) pada request body wajib di-strip secara otomatis untuk mencegah parameter pollution.
- **Idempotency Headers:** Permintaan operasional berisiko tinggi (misal checkout fleet, konfirmasi batch distribusi) disarankan menyertakan header `Idempotency-Key: <UUID>` guna mencegah duplicate mutation akibat network timeout.

## 9. Response Schema (Global Serialization Rules)
1. **Format Penamaan (Casing):** Seluruh key properti JSON pada Request Body dan Response Body WAJIB menggunakan format `snake_case` (contoh: `is_active`, `total_price`, `duty_date`).
2. **Format Waktu & Tanggal:**
   - Timestamp komprehensif wajib diformat menurut standard ISO 8601 UTC string (`YYYY-MM-DDTHH:mm:ss.sssZ`).
   - Tanggal operasional kerja harian diformat khusus `YYYY-MM-DD`.
3. **Representasi Moneter & Bilangan Riil:**
   - Nilai harga (mata uang Rupiah) wajib direpresentasikan sebagai `integer` (IDR tidak menggunakan floating point/sen).
   - Nilai bobot perhitungan matematis (BWM/TOPSIS/Spatial Distance) wajib direpresentasikan sebagai `number` float dengan batas presisi konsisten (misal: toleransi bobot BWM $1.00 \pm 0.001$).
4. **Pencegahan Data Sensitif (Data Sanitization):**
   - Field kredensial seperti `password_hash`, salt, reset token mentah, dan internal lock hash TIDAK BOLEH dikembalikan pada skema respons level mana pun.

## 10. Error Contract (Canonical Machine-Readable Protocol)
Semua status HTTP error ($4xx$ dan $5xx$) WAJIB diformat secara terpusat melalui *Global Error Handling Middleware* dan mematuhi skema error berikut:

### 10.1. Error Envelope Structure
```json
{
  "success": false,
  "error": {
    "code": "ZONE_AT_CAPACITY",
    "message": "Target zone has reached maximum capacity.",
    "details": [
      {
        "field": "zone_id",
        "issue": "Capacity 30/30 allocated",
        "code": "CAPACITY_FULL"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-09-03T01:14:00.000Z",
    "request_id": "req-c8f9b2d1-4e7a"
  }
}
```

### 10.2. HTTP Status Code Mapping Matrix
Domain service dan controller wajib memetakan kesalahan bisnis sesuai taksonomi status code berikut:

| HTTP Status | Standar Error Code | Skenario Penggunaan |
| --- | --- | --- |
| **400 Bad Request** | `BAD_REQUEST`, `MALFORMED_JSON`, `INVALID_REQUEST_PAYLOAD` | Sintaks body rusak atau query param tidak dapat dibaca |
| **401 Unauthorized** | `AUTH_TOKEN_MISSING`, `AUTH_TOKEN_EXPIRED`, `INVALID_CREDENTIALS` | Token tidak sah, kedaluwarsa, atau kredensial login salah |
| **403 Forbidden** | `FORBIDDEN_ACCESS`, `ACCOUNT_DEACTIVATED`, `ROLE_NOT_AUTHORIZED` | Autentikasi valid tetapi role/hak akses tidak mencukupi |
| **404 Not Found** | `RESOURCE_NOT_FOUND`, `ZONE_NOT_FOUND`, `USER_NOT_FOUND` | Identifier entitas tidak ditemukan di database |
| **409 Conflict** | `RESOURCE_ALREADY_EXISTS`, `CONCURRENT_LOCK_ACQUIRED`, `ARMADA_ALREADY_HELD` | Pelanggaran constraint unik, benturan state machine, atau kegagalan distributed lock |
| **422 Unprocessable** | `VALIDATION_ERROR`, `OPERATIONAL_SCOPE_NOT_CONFIGURED` | Payload valid secara sintaks, namun melanggar validasi semantik/konteks operasional |
| **429 Too Many Requests** | `RATE_LIMIT_EXCEEDED` | Pembatasan throughput endpoint terlampaui |
| **500 Internal Error** | `INTERNAL_SERVER_ERROR` | Kesalahan server tidak tertangani (detail internal/stacktrace wajib disembunyikan dari client) |
| **503 Service Unavailable** | `EXTERNAL_SERVICE_UNAVAILABLE`, `DATABASE_UNAVAILABLE` | Ketergantungan eksternal (Open-Meteo, Overpass, Redis) tidak merespons |

## 11. Business Rules
- Strict Clean Architecture: Controllers parse → Services execute → Repositories SQL
- No source code changes in PART 00
- All existing tests must pass as baseline

## 12. Database Dependencies
All 40+ PostgreSQL tables and PostGIS extensions are inventoried but not modified.

## 13. Service Dependencies
31 domain services inventoried.

## 14. Repository Dependencies
21 repositories inventoried.

## 15. Worker Dependencies
4 BullMQ workers: `overpassWorker.ts`, `armadaHoldWorker.ts`, `notificationWorker.ts`, `dssBatchWorker.ts`

## 16. Files Allowed to Modify
- `backend_reconstruction_plan.md`
- `backend_requirements.md`
- `reconstruction/PART_*.md`

## 17. Files Forbidden to Modify
All source files in `src/`

## 18. Dependencies on Other PARTs
None. Root of dependency graph.

## 19. Acceptance Criteria
- [x] Complete inventory documented
- [x] Baseline tests passing
- [x] Zero TypeScript compilation errors

## 20. Test Cases
```bash
bun x tsc --noEmit                              # 0 errors
bun run tests/operational_scope.test.ts          # 16/16 PASS
bun run tests/report_and_attendance.test.ts      # 13/13 PASS
```

## 21. Verification Commands
```bash
bun x tsc --noEmit
bun run tests/operational_scope.test.ts
bun run tests/report_and_attendance.test.ts
```

## 22. Known Risks
- Subsequent parts must not regress existing tests

## 23. Open Decisions
None.

## 24. Current Implementation Status
Governance baseline established.

## 25. Reconstruction Checklist
- [x] REQUIREMENTS_VERIFIED
- [x] UI_CONTRACT_VERIFIED (N/A)
- [x] API_CONTRACT_VERIFIED (N/A)
- [x] DATA_MODEL_VERIFIED
- [x] BUSINESS_RULES_VERIFIED
- [x] IMPLEMENTATION_COMPLETE
- [x] TESTS_PASS
- [x] INTEGRATION_VERIFIED
- [x] REGRESSION_VERIFIED
- [x] DOCUMENTATION_UPDATED

**PART STATUS: COMPLETED**

## 26. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-02 | Created master reconstruction plan | Plan established |
| 2026-09-03 | Baseline tests verified | 29/29 PASS |
| 2026-09-03 | Requirements SSOT extracted | `backend_requirements.md` created |

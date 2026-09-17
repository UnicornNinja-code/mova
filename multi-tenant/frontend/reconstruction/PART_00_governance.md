# FRONTEND PART 00 — GOVERNANCE, ARCHITECTURE BASELINE & GLOBAL ENVELOPE

## 1. Objective
Establish frontend reconstruction governance, API communication baseline via Axios interceptors, automated Global Response Envelope unwrapping, centralized RFC 7807/JSend error contract translation, Svelte 5 Runes standard enforcement, and strict TypeScript types.

## 2. Target Svelte Components & Routes
- `src/lib/axios.ts`
- `src/lib/types/api.ts`
- `src/lib/stores/auth.svelte.ts`
- `src/lib/stores/toast.svelte.ts`
- `src/components/ui/Toast.svelte`

## 3. API Contract Binding (Backend Dependency)
Consumes all backend endpoints under `/api/*` adhering strictly to:
- **Success Single Envelope:** `{ success: true, message: string, data: T, meta: { timestamp, request_id } }`
- **Success Paginated Envelope:** `{ success: true, message: string, data: T[], pagination: { page, limit, total_records, total_pages, has_next, has_prev }, meta: { timestamp, request_id } }`
- **Error Contract (RFC 7807/JSend):** `{ success: false, error: { code: string, message: string, details?: Array<{ field: string, issue: string, code?: string }> }, meta: { timestamp, request_id } }`

## 4. State Management & Svelte 5 Runes Spec
- **Axios Response Interceptor Unwrapper Protocol:**
  - **Single Resource:** Mengembalikan payload inti `res.data.data` (type `T`).
  - **Paginated Collection:** Mengembalikan objek terpadu `{ items: res.data.data, pagination: res.data.pagination }`.
  - **Binary / Stream Passthrough:** Jika `res.data instanceof Blob` (misal ekspor CSV), interceptor langsung meneruskan Blob mentah tanpa di-unwrap.
- **Global Toast Notification Store:** Pure Svelte 5 rune store (`$state`) for system feedback:
  ```typescript
  export class ToastStore {
    toasts = $state<Array<{ id: string; type: "success" | "error" | "info" | "warning"; message: string }>>([]);
    show(type: "success" | "error" | "info" | "warning", message: string, duration = 4000) { ... }
    error(message: string) { this.show("error", message); }
    success(message: string) { this.show("success", message); }
  }
  ```
- **Role-Based Navigation & Sidebar Declaration (`AppShell.svelte`):**
  - **SUPERADMIN:** Dashboard → User Management, Fleet Master, Catalog Master, Zone Master → DSS BWM-TOPSIS → Map → All Reports (4 Pillars) → Audit & Settings.
  - **MANAGEMENT:** Dashboard → User Management (Non-SuperAdmin), Fleet Master, Catalog Master → Monitoring Map (Business Assets) → Business & Revenue Reports. *(Zone Master & DSS BWM tersembunyi total)*.
  - **SUPERVISOR:** Operational Dashboard → Operations (Zone Capacity, DSS TOPSIS Evaluation & Plotting, Fleet Monitoring) → Monitoring Map → Operational Reports. *(User Management & Master Catalog tersembunyi total)*.
  - **RIDER:** Mobile Dashboard → My Operations (Attendance, Fleet Claim, POS Sales, Assigned Zone) → My Location Map → My Sales History.
- **Error Interceptor:** Automatically intercepts HTTP 4xx/5xx and displays toast with `error.message` unless specifically silenced via config header (`skipGlobalToast: true`).

## 5. UI/UX Interaction & Edge Cases
- **401 Refresh Token Queue Mutex:** Saat beberapa request paralel menerima 401 secara bersamaan, request pertama memicu rotasi token sementara request lainnya dimasukkan ke antrean (*failedQueue*). Semua request kemudian di-replay menggunakan access token baru yang sama untuk menghindari benturan *refresh token reuse detection*.
- **403 FIRST_LOGIN_REQUIRED:** Traps response and immediately switches UI routing to `FirstLoginPage.svelte`.
- **503 External Service Unavailable:** Shows non-blocking toast warning client without crashing the component tree.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    timestamp: string;
    request_id: string;
  };
}

export interface ApiPaginationMeta {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ApiPaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: ApiPaginationMeta;
  meta?: {
    timestamp: string;
    request_id: string;
  };
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
  code?: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta?: {
    timestamp: string;
    request_id: string;
  };
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:**
  - `src/lib/axios.ts`
  - `src/lib/types/api.ts`
  - `src/lib/stores/*`
  - `src/components/ui/Toast.svelte`
- **Forbidden:**
  - Domain page files (`src/pages/*`) and domain services (`src/services/*`) before Part 00 completion.

## 8. Verification & Acceptance Criteria
- [x] Centralized Axios client correctly unwraps Global Envelope payloads.
- [x] Global error interceptor extracts `error.message` cleanly without throwing uncaught runtime exceptions.
- [x] Mutex 401 refresh queue & 403 FIRST_LOGIN_REQUIRED trap implemented.
- [x] Pure Svelte 5 Runes ($state) Toast store & glassmorphism Toast component created.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 00 Setup | Types, Axios interceptor, Toast store & UI built |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |

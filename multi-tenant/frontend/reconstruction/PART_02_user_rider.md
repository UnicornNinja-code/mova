# FRONTEND PART 02 — USER MANAGEMENT & RIDER DUTY QUEUE

## 1. Objective
Reconstruct User Management interfaces (CRUD, invitation modal, role assignment, active/deactive status toggle) and the Rider daily readiness confirmation workflow adhering strictly to canonical state enums.

## 2. Target Svelte Components & Routes
- `src/pages/superadmin/SuperAdminUsersPage.svelte`
- `src/components/users/UserInvitationModal.svelte`
- `src/components/users/UserEditModal.svelte`
- `src/components/users/UserStatusBadge.svelte`
- `src/services/userService.ts`
- `src/services/riderService.ts`

## 3. API Contract Binding (Backend Dependency)
- `GET /api/users` → Query `role?`, `is_active?`, `search?`, `page?`, `limit?` → Response `ApiPaginatedResponse<UserItem>`
- `POST /api/users` → Request `{ email, username, password, name, role, birth_date? }`
- `PUT /api/users/:id` → Request `{ name?, role?, birth_date? }`
- `PATCH /api/users/:id/status` → Request `{ is_active: boolean }`
- `POST /api/users/:id/resend-invitation`
- `POST /api/distribution/duty-confirm` → Request `{ rider_id? }` → Response `{ queue: { id, status: "WAITING", duty_date } }`
- `GET /api/distribution/my-history` → Query `page?`, `limit?`

## 4. State Management & Svelte 5 Runes Spec
- **Canonical Rider Status Enum (CONTRA-001 RESOLVED):**
  `"WAITING" | "PLOTTED" | "CHECKED_IN" | "COMPLETED" | "NO_SHOW" | "CANCELLED"`
- **User Table State:**
  ```typescript
  class UserPageState {
    users = $state<UserItem[]>([]);
    totalRecords = $state(0);
    currentPage = $state(1);
    pageSize = $state(20);
    searchQuery = $state("");
    roleFilter = $state("");
    statusFilter = $state("");
    isLoading = $state(false);
  }
  ```

## 5. UI/UX Interaction & Edge Cases
- **Management Role Guard in Modal:** Pada `UserInvitationModal.svelte`, jika `authStore.user.role === 'MANAGEMENT'`, pilihan dropdown `Role` otomatis memfilter keluar opsi `SUPERADMIN` (hanya menampilkan `MANAGEMENT`, `SUPERVISOR`, dan `RIDER`).
- **Idempotent Duty Confirmation:** Clicking "Konfirmasi Hadir" on the Rider Dashboard triggers the duty queue; if already confirmed today, the UI reflects `WAITING` status immediately without conflict errors.
- **Deactivated User Guard:** Inactive users have muted row styling with clear tooltips and action buttons disabled.
- **Invitation Resend Feedback:** Displays instant success toast with countdown throttle to avoid spamming the backend email queue.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export type UserRole = "SUPERADMIN" | "MANAGEMENT" | "SUPERVISOR" | "RIDER";
export type RiderDutyStatus = "WAITING" | "PLOTTED" | "CHECKED_IN" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

export interface UserItem {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  first_login: boolean;
  birth_date?: string;
  created_at: string;
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:** `src/pages/superadmin/SuperAdminUsersPage.svelte`, `src/components/users/*`, `src/services/userService.ts`, `src/services/riderService.ts`
- **Forbidden:** Core map layers, DSS algorithms, and reporting SQL aggregations.

## 8. Verification & Acceptance Criteria
- [x] User list loads with server-side pagination, search, and role filters.
- [x] User invitation modal creates new accounts and renders new rows without full page refresh.
- [x] Rider duty readiness button transitions state to `WAITING` (CONTRA-001 locked).
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 02 Setup | User CRUD, invitation modal & rider operations verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |

# FRONTEND PART 12 — AUDIT LOGS, CRON CONSOLE & NOTIFICATIONS

## 1. Objective
Reconstruct system administration consoles: immutable audit trail viewer with dynamic filter dropdowns, cron job scheduler monitor with execution metrics, and actionable in-app notification dropdown with deep-link navigation.

## 2. Target Svelte Components & Routes
- `src/components/layout/Header.svelte`
- `src/components/layout/NotificationDropdown.svelte`
- `src/pages/superadmin/SuperAdminSettingsPage.svelte` (Tabs: Audit Logs, Cron Management)
- `src/components/system/AuditLogTable.svelte`
- `src/components/system/CronScheduleList.svelte`
- `src/components/system/CronLogsModal.svelte`
- `src/services/notificationService.ts`
- `src/services/userService.ts`

## 3. API Contract Binding (Backend Dependency)
- `GET /api/notifications` → Query `limit?`, `unread_only?` → Response `{ unread_count, notifications: NotificationItem[] }`
- `PATCH /api/notifications/:id/read` & `PATCH /api/notifications/read-all`
- `DELETE /api/notifications/:id`
- `GET /api/audit-logs` → Query `user_id?`, `action?`, `entity_type?`, `page`, `limit`
- `GET /api/audit-logs/filters` → Response `{ actions: string[], entity_types: string[] }`
- `GET /api/cron-management/configs`, `GET /api/cron-management/logs`, `PUT /api/cron-management/toggle/:cronKey`, `POST /api/cron-management/trigger/:cronKey`

## 4. State Management & Svelte 5 Runes Spec
- **Notification State:**
  ```typescript
  class NotificationState {
    unreadCount = $state(0);
    notifications = $state<NotificationItem[]>([]);
    isOpen = $state(false);
  }
  ```
- **Audit Filter State:** Fills dropdown options dynamically from `GET /api/audit-logs/filters` instead of hardcoded strings.

## 5. UI/UX Interaction & Edge Cases
- **Actionable Deep-Linking:** Clicking a notification item automatically marks it as read and navigates directly to `action_url` (e.g., opens fleet issue modal or rider assignment).
- **Live Notification Badge & Polling:** Polling ringan `GET /api/notifications?limit=5` dieksekusi setiap 30–60 detik saat tab browser aktif (`document.visibilityState === 'visible'`) atau mendengarkan event socket `notification:new` agar badge counter selalu mutakhir.
- **Manual Cron Trigger Feedback:** Dispatches manual trigger with instant spinner and refreshes log table upon job completion.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  target_entity?: {
    type: "ARMADA" | "ZONE" | "ASSIGNMENT" | "SYSTEM";
    id: string;
  };
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:** `src/components/layout/*`, `src/components/system/*`, `src/services/notificationService.ts`
- **Forbidden:** Core PostGIS geometry functions.

## 8. Verification & Acceptance Criteria
- [x] Notification dropdown renders unread items with deep-link navigation.
- [x] Audit log table supports dynamic filtering by action and entity type.
- [x] Manual cron trigger executes without UI blocking.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 12 Setup | Audit logs table, cron management & notifications dropdown verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |

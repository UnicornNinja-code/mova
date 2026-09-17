# FRONTEND PART 01 — AUTHENTICATION, SESSION & ONBOARDING SETUP WIZARD

## 1. Objective
Reconstruct authentication pages, adaptive CAPTCHA challenges, forced first-login password updates, and the 4-step onboarding setup wizard for SuperAdmin hub configuration.

## 2. Target Svelte Components & Routes
- `src/pages/auth/LoginPage.svelte`
- `src/pages/auth/FirstLoginPage.svelte`
- `src/pages/auth/ForgotPasswordPage.svelte`
- `src/pages/auth/ResetPasswordPage.svelte`
- `src/pages/setup/SetupPage.svelte`
- `src/pages/setup/steps/Step1HubCity.svelte`
- `src/pages/setup/steps/Step2Radius.svelte`
- `src/pages/setup/steps/Step3AdminPassword.svelte`
- `src/pages/setup/steps/Step4Review.svelte`
- `src/services/authService.ts`
- `src/services/setupService.ts`
- `src/services/systemReadinessService.ts`
- `src/lib/stores/auth.svelte.ts`
- `src/lib/stores/setupStore.svelte.ts`

## 3. API Contract Binding (Backend Dependency)
- `POST /api/auth/login` → Request `{ identifier, password, captcha_id?, captcha_answer? }` → Response `{ token, user: AuthUser }`
- `GET /api/auth/captcha` → Response `{ captcha_id, svg, expires_at }`
- `GET /api/auth/risk-status` → Query `identifier?` → Response `{ requires_captcha, ipFailures, userFailures }`
- `PATCH /api/users/me/complete-first-login` → Request `{ new_password }`
- `GET /api/system/settings` & `PUT /api/system/settings` → `{ settings: { HUB_CITY_NAME, CENTRAL_HUB_LAT, CENTRAL_HUB_LNG, OPERATIONAL_RADIUS_KM } }`
- `GET /api/system/readiness` → Response `{ is_ready, checks: { hub_configured, ... } }`

## 4. State Management & Svelte 5 Runes Spec
- **Auth Store (`auth.svelte.ts`):**
  ```typescript
  export class AuthState {
    user = $state<AuthUser | null>(null);
    token = $state<string | null>(null);
    isAuthenticated = $derived(!!this.token && !!this.user);
    isFirstLogin = $derived(this.user?.first_login ?? false);
  }
  ```
- **Setup Wizard Store (`setupStore.svelte.ts`):**
  - Manages current step index (1–4), map pin coordinates, slider radius (km), and dynamic submission validation.

## 5. UI/UX Interaction & Edge Cases
- **Adaptive CAPTCHA:** Automatically appears when `requires_captcha` is true or after 3 failed password attempts.
- **First Login Lock:** If `user.first_login == true`, header navigation is disabled and UI locks to password reset modal.
- **Interactive Map Pin:** Step 1 & 2 render a Leaflet circle centered at the hub with a dynamic radius outline.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: "SUPERADMIN" | "MANAGEMENT" | "SUPERVISOR" | "RIDER";
  is_active: boolean;
  first_login: boolean;
  avatar_url?: string;
  created_at?: string;
}

export interface HubSettings {
  HUB_CITY_NAME: string;
  CENTRAL_HUB_LAT: number;
  CENTRAL_HUB_LNG: number;
  OPERATIONAL_RADIUS_KM: number;
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:** `src/pages/auth/*`, `src/pages/setup/*`, `src/services/authService.ts`, `src/services/setupService.ts`, `src/services/systemReadinessService.ts`
- **Forbidden:** Domain components in fleet, DSS, distribution, and reporting.

## 8. Verification & Acceptance Criteria
- [x] Login completes and redirects user based on role (`/superadmin`, `/supervisor`, `/rider`).
- [x] First-login password change flow updates auth state without logging out.
- [x] Setup wizard successfully updates system hub coordinates and operational radius.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 01 Setup | Auth services, risk status, setup wizard verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |

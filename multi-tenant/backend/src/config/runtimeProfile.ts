/*
 * runtimeProfile.ts
 * Dual-Profile Runtime Configuration (MOVA Platform vs MOVA Lite)
 * Principle: Lite mengurangi fitur platform, BUKAN mengurangi security boundary.
 */

export interface AppConfig {
  profile: "platform" | "lite";
  features: {
    multiTenant: boolean;
    tenantManagement: boolean;
    globalSpatialSharing: boolean;
    quotaEnforcement: boolean;
    platformSuperadmin: boolean;
  };
  defaultTenantId: string;
}

const currentProfile: "platform" | "lite" =
  (process.env.APP_PROFILE as "platform" | "lite") || "platform";

export const runtimeConfig: AppConfig = {
  profile: currentProfile,
  features: {
    multiTenant: currentProfile === "platform",
    tenantManagement: currentProfile === "platform",
    globalSpatialSharing: true, // Core spatial engine selalu reusable
    quotaEnforcement: currentProfile === "platform",
    platformSuperadmin: currentProfile === "platform",
  },
  defaultTenantId: process.env.DEFAULT_TENANT_ID || "thesis-default",
};

export const isPlatformProfile = (): boolean => runtimeConfig.profile === "platform";
export const isLiteProfile = (): boolean => runtimeConfig.profile === "lite";

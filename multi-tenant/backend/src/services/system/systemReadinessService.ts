/*
 * systemReadinessService.ts
 * Service for Evaluating Holistic System Readiness & Operational Foundation Checklist in TypeScript
 */

import { pool } from "../../config/database.js";
import { SystemSettingModel } from "../../models/systemSettingModel.js";
import { topsisRepository } from "../../repositories/topsisRepository.js";

export interface ReadinessItem {
  id: string;
  category: "IDENTITY" | "OPERATIONAL_BASE" | "ZONES" | "DSS" | "FLEET";
  title: string;
  description: string;
  is_mandatory: boolean;
  status: "READY" | "ACTION_REQUIRED";
  current_value?: any;
  route: string;
  action_label: string;
}

export interface SystemReadinessReport {
  overall_status: "READY" | "NEEDS_CONFIGURATION";
  readiness_percentage: number;
  mandatory_passed: number;
  mandatory_total: number;
  items: ReadinessItem[];
  hub_config: {
    name: string;
    city_name?: string;
    address: string;
    latitude: number;
    longitude: number;
    radius_km: number;
  };
  spatial_rules?: {
    protocol_road_prohibited: boolean;
    toll_road_prohibited: boolean;
  };
  schedule_config?: {
    slots: Array<{ code: string; name: string; time_range: string; is_active: boolean }>;
    days: string[];
    hold_duration_minutes: number;
  };
  security_policies?: {
    invitation_token_hours: number;
    jwt_access_token_minutes: number;
    refresh_token_rotation: boolean;
    anti_account_enumeration: boolean;
  };
}

export class SystemReadinessService {
  private static instance: SystemReadinessService | null = null;

  public static getInstance(): SystemReadinessService {
    if (!SystemReadinessService.instance) {
      SystemReadinessService.instance = new SystemReadinessService();
    }
    return SystemReadinessService.instance;
  }

  public async evaluateSystemReadiness(): Promise<SystemReadinessReport> {
    // 1. Fetch System Settings
    const [
      hubNameSetting,
      hubAddrSetting,
      hubLatSetting,
      hubLngSetting,
      hubRadiusSetting,
      ruleProtocolSetting,
      ruleTollSetting,
      scheduleSetting,
    ] = await Promise.all([
      SystemSettingModel.getByKey("CENTRAL_HUB_NAME"),
      SystemSettingModel.getByKey("CENTRAL_HUB_ADDRESS"),
      SystemSettingModel.getByKey("CENTRAL_HUB_LAT"),
      SystemSettingModel.getByKey("CENTRAL_HUB_LNG"),
      SystemSettingModel.getByKey("OPERATIONAL_RADIUS_KM"),
      SystemSettingModel.getByKey("OPERATIONAL_RULE_PROTOCOL_ROAD"),
      SystemSettingModel.getByKey("OPERATIONAL_RULE_TOLL_ROAD"),
      SystemSettingModel.getByKey("OPERATIONAL_SCHEDULE"),
    ]);

    const hubLat = parseFloat(hubLatSetting?.value || "0");
    const hubLng = parseFloat(hubLngSetting?.value || "0");
    const hubRadius = parseFloat(hubRadiusSetting?.value || "12");
    const hubName = hubNameSetting?.value || "Central Hub";
    const hubAddress = hubAddrSetting?.value || "-";

    // 2. Fetch User counts by role & status
    const userCountQuery = `
      SELECT role, is_active, COUNT(*)::int AS count
      FROM users
      GROUP BY role, is_active;
    `;
    const { rows: userCounts } = await pool.query(userCountQuery);
    const superadminCount = userCounts.filter((u: any) => u.role === "SUPERADMIN" && u.is_active).reduce((a: number, b: any) => a + b.count, 0);
    const managementCount = userCounts.filter((u: any) => u.role === "MANAGEMENT" && u.is_active).reduce((a: number, b: any) => a + b.count, 0);
    const supervisorCount = userCounts.filter((u: any) => u.role === "SUPERVISOR" && u.is_active).reduce((a: number, b: any) => a + b.count, 0);
    const riderCount = userCounts.filter((u: any) => u.role === "RIDER" && u.is_active).reduce((a: number, b: any) => a + b.count, 0);

    // 3. Fetch Active Zones
    const activeZones = await topsisRepository.findAllActiveZones();

    // 4. Fetch Active DSS Profile
    const dssProfileQuery = `
      SELECT id, name, is_active 
      FROM dss_configurations 
      WHERE is_active = true 
      LIMIT 1;
    `;
    const { rows: dssProfiles } = await pool.query(dssProfileQuery);
    const hasActiveDSS = dssProfiles.length > 0;

    // 5. Fetch Active Armadas
    const armadaQuery = `
      SELECT COUNT(*)::int AS active_count 
      FROM armadas 
      WHERE status = 'ACTIVE';
    `;
    const { rows: armadaRows } = await pool.query(armadaQuery);
    const activeArmadaCount = armadaRows[0]?.active_count || 0;

    // Build Checklist Items
    const items: ReadinessItem[] = [
      // Central Hub
      {
        id: "CENTRAL_HUB",
        category: "OPERATIONAL_BASE",
        title: "Central Hub & Koordinat Markas",
        description: `Markas operasional utama terdaftar di ${hubName} (${hubLat}, ${hubLng}).`,
        is_mandatory: true,
        status: hubLat && hubLng ? "READY" : "ACTION_REQUIRED",
        current_value: { name: hubName, lat: hubLat, lng: hubLng },
        route: "/settings",
        action_label: "Konfigurasi Hub",
      },
      // Operational Coverage
      {
        id: "OPERATIONAL_COVERAGE",
        category: "OPERATIONAL_BASE",
        title: "Radius Jangkauan Operasional",
        description: `Batas buffer radius operasional wilayah ditetapkan sebesar ${hubRadius} KM.`,
        is_mandatory: true,
        status: hubRadius > 0 ? "READY" : "ACTION_REQUIRED",
        current_value: `${hubRadius} KM`,
        route: "/settings",
        action_label: "Atur Radius",
      },
      // Spatial Restrictions
      {
        id: "SPATIAL_RULES",
        category: "OPERATIONAL_BASE",
        title: "Aturan Pembatasan Spasial GIS",
        description: "Restriksi jalan tol & protokol aktif untuk validasi poligon zona.",
        is_mandatory: true,
        status: ruleProtocolSetting && ruleTollSetting ? "READY" : "ACTION_REQUIRED",
        route: "/zones",
        action_label: "Tinjau Aturan",
      },
      // Active Zones
      {
        id: "ACTIVE_ZONES",
        category: "ZONES",
        title: "Zona Wilayah Operasional",
        description: activeZones.length > 0 
          ? `Terdapat ${activeZones.length} zona spasial aktif yang siap diploting.` 
          : "Sistem membutuhkan minimal 1 zona poligon aktif untuk beroperasi.",
        is_mandatory: true,
        status: activeZones.length > 0 ? "READY" : "ACTION_REQUIRED",
        current_value: `${activeZones.length} Zona Aktif`,
        route: "/zones",
        action_label: "Kelola Zona",
      },
      // DSS Weight Configuration
      {
        id: "DSS_WEIGHTS",
        category: "DSS",
        title: "Konfigurasi Pembobotan DSS (BWM/TOPSIS)",
        description: hasActiveDSS 
          ? `Profil bobot kriteria aktif: "${dssProfiles[0].name}".` 
          : "Profil bobot kriteria DSS aktif belum dikonfigurasi.",
        is_mandatory: true,
        status: hasActiveDSS ? "READY" : "ACTION_REQUIRED",
        current_value: hasActiveDSS ? dssProfiles[0].name : "Belum Ada",
        route: "/dss",
        action_label: "Konfigurasi DSS",
      },
      // Superadmin Identity
      {
        id: "SUPERADMIN_USER",
        category: "IDENTITY",
        title: "Akun Superadmin Utama",
        description: `Tersedia ${superadminCount} akun Superadministrator aktif.`,
        is_mandatory: true,
        status: superadminCount > 0 ? "READY" : "ACTION_REQUIRED",
        route: "/users",
        action_label: "Kelola User",
      },
      // Operational Personnel (Recommended)
      {
        id: "OPERATIONAL_RIDERS",
        category: "IDENTITY",
        title: "Personel Rider Lapangan",
        description: riderCount > 0 
          ? `Tersedia ${riderCount} personel rider aktif siap bertugas.` 
          : "Belum ada rider yang terdaftar dan aktif di sistem.",
        is_mandatory: false,
        status: riderCount > 0 ? "READY" : "ACTION_REQUIRED",
        current_value: `${riderCount} Rider`,
        route: "/users",
        action_label: "Tambah Rider",
      },
      // Fleet Units (Recommended)
      {
        id: "FLEET_UNITS",
        category: "FLEET",
        title: "Armada Gerobak & E-Bike",
        description: activeArmadaCount > 0 
          ? `Tersedia ${activeArmadaCount} unit armada berstatus ACTIVE di Hub.` 
          : "Belum ada unit armada aktif yang siap digunakan rider.",
        is_mandatory: false,
        status: activeArmadaCount > 0 ? "READY" : "ACTION_REQUIRED",
        current_value: `${activeArmadaCount} Unit`,
        route: "/fleet",
        action_label: "Kelola Armada",
      },
    ];

    const mandatoryItems = items.filter((i) => i.is_mandatory);
    const mandatoryPassed = mandatoryItems.filter((i) => i.status === "READY").length;
    const totalPassed = items.filter((i) => i.status === "READY").length;
    const readinessPercentage = Math.round((totalPassed / items.length) * 100);

    const protocolRule = ruleProtocolSetting ? ruleProtocolSetting.value === "true" : true;
    const tollRule = ruleTollSetting ? ruleTollSetting.value === "true" : true;

    return {
      overall_status: mandatoryPassed === mandatoryItems.length ? "READY" : "NEEDS_CONFIGURATION",
      readiness_percentage: readinessPercentage,
      mandatory_passed: mandatoryPassed,
      mandatory_total: mandatoryItems.length,
      items,
      hub_config: {
        name: hubName,
        city_name: (await SystemSettingModel.getByKey("HUB_CITY_NAME"))?.value || (hubAddress.toLowerCase().includes("surabaya") ? "Surabaya" : ""),
        address: hubAddress,
        latitude: hubLat,
        longitude: hubLng,
        radius_km: hubRadius,
      },
      spatial_rules: {
        protocol_road_prohibited: protocolRule,
        toll_road_prohibited: tollRule,
      },
      schedule_config: {
        slots: [
          { code: "PAGI", name: "Sesi Pagi", time_range: "06:00 - 10:00", is_active: true },
          { code: "SIANG", name: "Sesi Siang", time_range: "10:00 - 14:00", is_active: true },
          { code: "SORE", name: "Sesi Sore", time_range: "14:00 - 18:00", is_active: true },
          { code: "MALAM", name: "Sesi Malam", time_range: "18:00 - 22:00", is_active: true },
        ],
        days: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
        hold_duration_minutes: 5,
      },
      security_policies: {
        invitation_token_hours: 48,
        jwt_access_token_minutes: 15,
        refresh_token_rotation: true,
        anti_account_enumeration: true,
      },
    };
  }

  public async updateSystemSettings({
    hub_name,
    hub_city_name,
    hub_address,
    hub_latitude,
    hub_longitude,
    operational_radius_km,
    protocol_road_prohibited,
    toll_road_prohibited,
  }: {
    hub_name?: string;
    hub_city_name?: string;
    hub_address?: string;
    hub_latitude?: number;
    hub_longitude?: number;
    operational_radius_km?: number;
    protocol_road_prohibited?: boolean;
    toll_road_prohibited?: boolean;
  }): Promise<any> {
    if (hub_name !== undefined) {
      await SystemSettingModel.upsert("CENTRAL_HUB_NAME", hub_name, "Nama Markas Central Hub Operasional");
    }
    if (hub_city_name !== undefined && hub_city_name.trim()) {
      await SystemSettingModel.upsert("HUB_CITY_NAME", hub_city_name.trim(), "Kota Wilayah Operasional Hub");
    }
    if (hub_address !== undefined) {
      await SystemSettingModel.upsert("CENTRAL_HUB_ADDRESS", hub_address, "Alamat Fisik Markas Central Hub Operasional");
    }
    if (hub_latitude !== undefined) {
      await SystemSettingModel.upsert("CENTRAL_HUB_LAT", String(hub_latitude), "Latitude Geografis Central Hub");
      await SystemSettingModel.upsert("HUB_LATITUDE", String(hub_latitude), "Latitude Geografis Central Hub (Alias)");
    }
    if (hub_longitude !== undefined) {
      await SystemSettingModel.upsert("CENTRAL_HUB_LNG", String(hub_longitude), "Longitude Geografis Central Hub");
      await SystemSettingModel.upsert("HUB_LONGITUDE", String(hub_longitude), "Longitude Geografis Central Hub (Alias)");
    }
    if (operational_radius_km !== undefined) {
      await SystemSettingModel.upsert("OPERATIONAL_RADIUS_KM", String(operational_radius_km), "Radius Maksimal Buffer Operasional Pembuatan Zona (KM)");
    }
    if (protocol_road_prohibited !== undefined) {
      await SystemSettingModel.upsert("OPERATIONAL_RULE_PROTOCOL_ROAD", String(protocol_road_prohibited), "Larangan operasional berjualan pada area jalan protokol");
    }
    if (toll_road_prohibited !== undefined) {
      await SystemSettingModel.upsert("OPERATIONAL_RULE_TOLL_ROAD", String(toll_road_prohibited), "Larangan operasional berjualan pada area jalan tol");
    }

    return this.evaluateSystemReadiness();
  }
}

export const systemReadinessService = SystemReadinessService.getInstance();

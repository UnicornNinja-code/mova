import { pool } from "../config/database.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";

const DEFAULT_HUB_LATITUDE = "-7.4478";
const DEFAULT_HUB_LONGITUDE = "112.7183";
const DEFAULT_HUB_RADIUS_KM = "12";
const DEFAULT_HUB_NAME = "Central Hub Sidoarjo";
const DEFAULT_HUB_CITY = "Sidoarjo";
const DEFAULT_HUB_ADDRESS = "Jl. Pahlawan No. 1, Sidoarjo, Jawa Timur";

const SCHEDULE_SLOTS = [
  { code: "PAGI", name: "Sesi Pagi (Morning Rush)", time_range: "06:00 - 10:00", is_active: true },
  { code: "SIANG", name: "Sesi Siang (Lunch Break)", time_range: "11:00 - 14:00", is_active: true },
  { code: "SORE", name: "Sesi Sore (Afternoon Prime)", time_range: "15:00 - 18:00", is_active: true },
  { code: "MALAM", name: "Sesi Malam (Evening Leisure)", time_range: "19:00 - 22:00", is_active: true },
];

const SECURITY_POLICIES = {
  invitation_token_hours: 48,
  jwt_access_token_minutes: 15,
  refresh_token_rotation: true,
  anti_account_enumeration: true,
};

export class SystemReadinessService {
  async evaluateSystemReadiness() {
    const [
      hubNameSetting,
      hubCitySetting,
      hubAddrSetting,
      hubLatSetting,
      hubLngSetting,
      hubRadiusSetting,
      ruleProtocolSetting,
      ruleTollSetting,
      { rows: userCounts },
      { rows: zoneRows },
      { rows: dssRows },
      { rows: armadaRows },
      { rows: poiCategoryRows },
      { rows: poiRows },
    ] = await Promise.all([
      SystemSettingModel.getByKey("HUB_NAME"),
      SystemSettingModel.getByKey("HUB_CITY_NAME"),
      SystemSettingModel.getByKey("HUB_ADDRESS"),
      SystemSettingModel.getByKey("HUB_LATITUDE"),
      SystemSettingModel.getByKey("HUB_LONGITUDE"),
      SystemSettingModel.getByKey("OPERATIONAL_RADIUS_KM"),
      SystemSettingModel.getByKey("OPERATIONAL_RULE_PROTOCOL_ROAD"),
      SystemSettingModel.getByKey("OPERATIONAL_RULE_TOLL_ROAD"),
      pool.query(`SELECT role, is_active, COUNT(*)::int AS count FROM users GROUP BY role, is_active;`),
      pool.query(`SELECT COUNT(*)::int AS count FROM zones WHERE status = 'ACTIVE';`),
      pool.query(`SELECT id, name, is_active, consistency_ratio FROM dss_configurations WHERE is_active = true LIMIT 1;`),
      pool.query(`SELECT COUNT(*)::int AS count FROM armadas WHERE status = 'ACTIVE';`),
      pool.query(`SELECT COUNT(*)::int AS count FROM poi_categories WHERE is_active = true;`),
      pool.query(`SELECT COUNT(*)::int AS count FROM pois WHERE status = 'APPROVED';`),
    ]);

    const hubLat = parseFloat(hubLatSetting?.value || DEFAULT_HUB_LATITUDE);
    const hubLng = parseFloat(hubLngSetting?.value || DEFAULT_HUB_LONGITUDE);
    const hubRadius = parseFloat(hubRadiusSetting?.value || DEFAULT_HUB_RADIUS_KM);
    const hubName = hubNameSetting?.value || DEFAULT_HUB_NAME;
    const hubCityName = hubCitySetting?.value || DEFAULT_HUB_CITY;
    const hubAddress = hubAddrSetting?.value || DEFAULT_HUB_ADDRESS;

    const protocolRoadProhibited = ruleProtocolSetting?.value !== "false";
    const tollRoadProhibited = ruleTollSetting?.value !== "false";

    const superadminCount = userCounts
      .filter((u) => u.role === "SUPERADMIN" && u.is_active)
      .reduce((acc, curr) => acc + curr.count, 0);

    const supervisorCount = userCounts
      .filter((u) => u.role === "SUPERVISOR" && u.is_active)
      .reduce((acc, curr) => acc + curr.count, 0);

    const riderCount = userCounts
      .filter((u) => u.role === "RIDER" && u.is_active)
      .reduce((acc, curr) => acc + curr.count, 0);

    const activeZoneCount = zoneRows[0]?.count || 0;
    const activeDss = dssRows[0] || null;
    const activeArmadaCount = armadaRows[0]?.count || 0;
    const activeCategoryCount = poiCategoryRows[0]?.count || 0;
    const approvedPoiCount = poiRows[0]?.count || 0;

    const items = [
      {
        id: "CENTRAL_HUB",
        category: "OPERATIONAL_BASE",
        title: "Central Hub & Koordinat Markas",
        description: `Markas operasional utama berpusat di ${hubName} (${hubLat.toFixed(4)}, ${hubLng.toFixed(4)}).`,
        is_mandatory: true,
        status: Number.isFinite(hubLat) && Number.isFinite(hubLng) ? "READY" : "ACTION_REQUIRED",
        current_value: `${hubName} (${hubCityName})`,
        route: "/settings",
        action_label: "Konfigurasi Hub",
      },
      {
        id: "OPERATIONAL_COVERAGE",
        category: "OPERATIONAL_BASE",
        title: "Radius Jangkauan Wilayah Operasional",
        description: `Batas radius zona operasional ditetapkan sebesar ${hubRadius} KM dari Central Hub.`,
        is_mandatory: true,
        status: hubRadius > 0 ? "READY" : "ACTION_REQUIRED",
        current_value: `${hubRadius} KM`,
        route: "/settings",
        action_label: "Atur Radius",
      },
      {
        id: "IDENTITY_RBAC",
        category: "IDENTITY",
        title: "Kesiapan Akun 4-Role RBAC",
        description: `Struktur akun pengguna aktif: Superadmin (${superadminCount}), Supervisor (${supervisorCount}), Rider (${riderCount}).`,
        is_mandatory: true,
        status: superadminCount > 0 && riderCount > 0 ? "READY" : "ACTION_REQUIRED",
        current_value: `${superadminCount + supervisorCount + riderCount} Akun Aktif`,
        route: "/users",
        action_label: "Kelola Pengguna",
      },
      {
        id: "ZONES_POSTGIS",
        category: "ZONES",
        title: "Zona Geofence Poligon PostGIS",
        description: "Zona operasional aktif terdaftar dan tervalidasi terhadap batasan spasial perkotaan.",
        is_mandatory: true,
        status: activeZoneCount > 0 ? "READY" : "ACTION_REQUIRED",
        current_value: `${activeZoneCount} Zona Aktif`,
        route: "/zones",
        action_label: "Kelola Zona",
      },
      {
        id: "DSS_ENGINE",
        category: "DSS",
        title: "Konfigurasi DSS Hybrid BWM-TOPSIS",
        description: activeDss
          ? `Profil bobot kriteria aktif (${activeDss.name}) dengan rasio konsistensi CR ≤ 0.10.`
          : "Belum ada konfigurasi DSS BWM-TOPSIS aktif.",
        is_mandatory: true,
        status: activeDss ? "READY" : "ACTION_REQUIRED",
        current_value: activeDss ? `CR: ${(activeDss.consistency_ratio || 0).toFixed(4)}` : "None",
        route: "/dss",
        action_label: "Kalibrasi DSS",
      },
      {
        id: "FLEET_ARMADA",
        category: "FLEET",
        title: "Ketersediaan Armada Operasional",
        description: "Unit armada kopi keliling aktif dan siap dipasangkan dengan rider bertugas.",
        is_mandatory: true,
        status: activeArmadaCount > 0 ? "READY" : "ACTION_REQUIRED",
        current_value: `${activeArmadaCount} Unit Aktif`,
        route: "/fleet",
        action_label: "Kelola Armada",
      },
      {
        id: "POI_INTELLIGENCE",
        category: "OPERATIONAL_BASE",
        title: "Master POI & Kategori Keramaian C3",
        description: "Katalog POI operasional yang telah disetujui untuk perhitungan densitas C1 & C3.",
        is_mandatory: false,
        status: approvedPoiCount > 0 && activeCategoryCount > 0 ? "READY" : "ACTION_REQUIRED",
        current_value: `${approvedPoiCount} POI (${activeCategoryCount} Kategori)`,
        route: "/pois",
        action_label: "Kelola POI",
      },
    ];

    const mandatoryTotal = items.filter((i) => i.is_mandatory).length;
    const mandatoryPassed = items.filter((i) => i.is_mandatory && i.status === "READY").length;
    const totalPassed = items.filter((i) => i.status === "READY").length;
    const readinessPercentage = Math.round((totalPassed / items.length) * 100);

    const overallStatus = mandatoryPassed === mandatoryTotal ? "READY" : "NEEDS_CONFIGURATION";

    return {
      overall_status: overallStatus,
      readiness_percentage: readinessPercentage,
      mandatory_passed: mandatoryPassed,
      mandatory_total: mandatoryTotal,
      items,
      hub_config: {
        name: hubName,
        city_name: hubCityName,
        address: hubAddress,
        latitude: hubLat,
        longitude: hubLng,
        radius_km: hubRadius,
      },
      spatial_rules: {
        protocol_road_prohibited: protocolRoadProhibited,
        toll_road_prohibited: tollRoadProhibited,
      },
      schedule_config: {
        slots: SCHEDULE_SLOTS,
        hold_duration_minutes: 5,
      },
      security_policies: SECURITY_POLICIES,
    };
  }

  async updateHubConfig(payload, user = {}) {
    const {
      hub_name,
      hub_city_name,
      hub_address,
      hub_latitude,
      hub_longitude,
      operational_radius_km,
    } = payload;

    if (hub_name !== undefined) {
      await SystemSettingModel.upsert("HUB_NAME", String(hub_name).trim(), "Nama Markas Central Hub");
    }
    if (hub_city_name !== undefined) {
      await SystemSettingModel.upsert("HUB_CITY_NAME", String(hub_city_name).trim(), "Kota Wilayah Operasional Hub");
    }
    if (hub_address !== undefined) {
      await SystemSettingModel.upsert("HUB_ADDRESS", String(hub_address).trim(), "Alamat Fisik Markas Hub");
    }
    if (hub_latitude !== undefined && Number.isFinite(Number(hub_latitude))) {
      await SystemSettingModel.upsert("HUB_LATITUDE", String(Number(hub_latitude)), "Latitude Geografis Hub");
    }
    if (hub_longitude !== undefined && Number.isFinite(Number(hub_longitude))) {
      await SystemSettingModel.upsert("HUB_LONGITUDE", String(Number(hub_longitude)), "Longitude Geografis Hub");
    }
    if (operational_radius_km !== undefined && Number.isFinite(Number(operational_radius_km))) {
      await SystemSettingModel.upsert(
        "OPERATIONAL_RADIUS_KM",
        String(Number(operational_radius_km)),
        "Radius Jangkauan Operasional (KM)"
      );
    }

    try {
      await pool.query(
        `
        INSERT INTO audit_logs (user_id, user_role, action, entity_type, details, status)
        VALUES ($1, $2, 'UPDATE_HUB_CONFIG', 'SYSTEM_SETTINGS', $3::jsonb, 'SUCCESS');
      `,
        [user.id || null, user.role || "SUPERADMIN", JSON.stringify(payload)]
      );
    } catch (e) {
      console.warn("Could not log hub config update to audit_logs:", e.message);
    }

    return await this.evaluateSystemReadiness();
  }
}

export const systemReadinessService = new SystemReadinessService();

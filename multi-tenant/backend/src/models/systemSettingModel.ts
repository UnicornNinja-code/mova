import { pool } from "../config/database.js";

export const SystemSettingModel = {
  async getByKey(key: string) {
    const query = `SELECT * FROM system_settings WHERE key = $1;`;
    const { rows } = await pool.query(query, [key]);
    return rows[0];
  },

  async upsert(key: string, value: string, description = "") {
    const query = `
      INSERT INTO system_settings (key, value, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [key, value, description]);
    return rows[0];
  },

  async isSystemInitialized(): Promise<boolean> {
    const setting = await this.getByKey("SYSTEM_INITIALIZED");
    return setting?.value === "true";
  },

  async getInitializationState(): Promise<{
    status: "REQUIRED" | "IN_PROGRESS" | "COMPLETED";
    setup_progress: {
      identity_configured: boolean;
      operations_configured: boolean;
      dss_calibrated: boolean;
    };
    current_step: string;
    completed_at?: string;
    hub_config: {
      system_name: string;
      business_name?: string;
      hub_city_name: string;
      central_hub_name: string;
      central_hub_address: string;
      central_hub_lat: number;
      central_hub_lng: number;
      timezone: string;
    };
  }> {
    const [
      initSetting,
      stepSetting,
      systemNameSetting,
      hubCitySetting,
      hubNameSetting,
      hubAddressSetting,
      hubLatSetting,
      hubLngSetting,
      timezoneSetting,
    ] = await Promise.all([
      this.getByKey("SYSTEM_INITIALIZED"),
      this.getByKey("SYSTEM_SETUP_CURRENT_STEP"),
      this.getByKey("SYSTEM_NAME"),
      this.getByKey("HUB_CITY_NAME"),
      this.getByKey("CENTRAL_HUB_NAME"),
      this.getByKey("CENTRAL_HUB_ADDRESS"),
      this.getByKey("CENTRAL_HUB_LAT"),
      this.getByKey("CENTRAL_HUB_LNG"),
      this.getByKey("SYSTEM_TIMEZONE"),
    ]);

    const isInitialized = initSetting?.value === "true";
    const currentStep = stepSetting?.value || (isInitialized ? "COMPLETED" : "IDENTITY");

    const status: "REQUIRED" | "IN_PROGRESS" | "COMPLETED" = isInitialized
      ? "COMPLETED"
      : currentStep === "IDENTITY"
      ? "REQUIRED"
      : "IN_PROGRESS";

    return {
      status,
      setup_progress: {
        identity_configured: Boolean(hubLatSetting?.value && hubLngSetting?.value),
        operations_configured: isInitialized || currentStep === "DSS" || currentStep === "REVIEW",
        dss_calibrated: isInitialized || currentStep === "REVIEW",
      },
      current_step: currentStep,
      completed_at: initSetting?.updated_at,
      hub_config: {
        system_name: systemNameSetting?.value || "MOVA",
        business_name: systemNameSetting?.value || "MOVA",
        hub_city_name: hubCitySetting?.value || "",
        central_hub_name: hubNameSetting?.value || "Central Hub",
        central_hub_address: hubAddressSetting?.value || "",
        central_hub_lat: hubLatSetting?.value ? parseFloat(hubLatSetting.value) : 0,
        central_hub_lng: hubLngSetting?.value ? parseFloat(hubLngSetting.value) : 0,
        timezone: timezoneSetting?.value || "Asia/Jakarta",
      },
    };
  },

  async completeSystemInitialization(payload: {
    system_name?: string;
    business_name?: string;
    hub_city_name?: string;
    central_hub_name?: string;
    central_hub_address?: string;
    central_hub_lat?: number;
    central_hub_lng?: number;
    operational_radius_km?: number;
    operating_hours_start?: string;
    operating_hours_end?: string;
    timezone?: string;
    default_basemap?: string;
    default_zoom?: number;
    show_hub_radius?: boolean;
    show_protocol_roads?: boolean;
    show_poi?: boolean;
    show_weather?: boolean;
  }, userId?: string): Promise<void> {
    const businessName = payload.business_name || payload.system_name || "MOVA";
    await this.upsert("SYSTEM_NAME", businessName, "Nama Resmi Sistem");
    await this.upsert("BUSINESS_NAME", businessName, "Nama Bisnis Operasional");
    if (payload.hub_city_name) await this.upsert("HUB_CITY_NAME", payload.hub_city_name, "Kota Markas Utama");
    if (payload.central_hub_name) await this.upsert("CENTRAL_HUB_NAME", payload.central_hub_name, "Nama Central Hub");
    if (payload.central_hub_address) await this.upsert("CENTRAL_HUB_ADDRESS", payload.central_hub_address, "Alamat Central Hub");
    if (payload.central_hub_lat !== undefined) {
      await this.upsert("CENTRAL_HUB_LAT", String(payload.central_hub_lat), "Latitude Hub");
      await this.upsert("HUB_LATITUDE", String(payload.central_hub_lat), "Latitude Hub");
    }
    if (payload.central_hub_lng !== undefined) {
      await this.upsert("CENTRAL_HUB_LNG", String(payload.central_hub_lng), "Longitude Hub");
      await this.upsert("HUB_LONGITUDE", String(payload.central_hub_lng), "Longitude Hub");
    }
    if (payload.operational_radius_km !== undefined) await this.upsert("OPERATIONAL_RADIUS_KM", String(payload.operational_radius_km), "Radius Hub");
    if (payload.operating_hours_start) await this.upsert("OPERATING_HOURS_START", payload.operating_hours_start, "Jam Mulai Operasi");
    if (payload.operating_hours_end) await this.upsert("OPERATING_HOURS_END", payload.operating_hours_end, "Jam Selesai Operasi");
    if (payload.timezone) await this.upsert("SYSTEM_TIMEZONE", payload.timezone, "Zona Waktu Sistem");

    // Map Preferences
    if (payload.default_basemap) await this.upsert("DEFAULT_BASEMAP", payload.default_basemap, "Tema Peta Default");
    if (payload.default_zoom !== undefined) await this.upsert("DEFAULT_ZOOM", String(payload.default_zoom), "Level Zoom Awal");
    if (payload.show_hub_radius !== undefined) await this.upsert("SHOW_HUB_RADIUS", String(payload.show_hub_radius), "Tampilkan Radius Hub Awal");
    if (payload.show_protocol_roads !== undefined) await this.upsert("SHOW_PROTOCOL_ROADS", String(payload.show_protocol_roads), "Tampilkan Jalan Protokol Awal");
    if (payload.show_poi !== undefined) await this.upsert("SHOW_POI", String(payload.show_poi), "Tampilkan POI Awal");
    if (payload.show_weather !== undefined) await this.upsert("SHOW_WEATHER", String(payload.show_weather), "Tampilkan Cuaca Awal");

    await this.upsert("SYSTEM_SETUP_CURRENT_STEP", "COMPLETED", "Tahapan Wizard Setup");
    await this.upsert("SYSTEM_INITIALIZED", "true", "Status Inisialisasi Pertama Sistem");
    if (userId) {
      await this.upsert("SYSTEM_INITIALIZED_BY", String(userId), "User ID yang menginisialisasi sistem");
    }
  }
};

/*
 * operationalRuleService.ts
 * Centralized Service for Managing Operational Spatial Restriction Rules in system_settings in TypeScript
 */

import { SystemSettingModel } from "../models/systemSettingModel.js";
import { auditLogger } from "../utils/AuditLogger.js";

export class OperationalRuleService {
  private static instance: OperationalRuleService | null = null;

  public static getInstance(): OperationalRuleService {
    if (!OperationalRuleService.instance) {
      OperationalRuleService.instance = new OperationalRuleService();
    }
    return OperationalRuleService.instance;
  }

  /**
   * Helper to parse and strictly validate boolean string configuration values
   */
  public parseStrictBooleanSetting(settingObj: any, settingKey: string): boolean {
    if (!settingObj || settingObj.value === undefined || settingObj.value === null) {
      const error: any = new Error(`Configuration Error: Missing required system_setting '${settingKey}' in database.`);
      error.statusCode = 500;
      throw error;
    }

    const strVal = String(settingObj.value).trim().toLowerCase();
    if (strVal === "true") return true;
    if (strVal === "false") return false;

    const error: any = new Error(
      `Configuration Error: Invalid non-boolean value '${settingObj.value}' for setting '${settingKey}'. Must be 'true' or 'false'.`
    );
    error.statusCode = 500;
    throw error;
  }

  /**
   * Reads dynamic operational rules from system_settings PostgreSQL table
   */
  public async getOperationalRules(): Promise<{ protocol_road_prohibited: boolean; toll_road_prohibited: boolean }> {
    const protocolSetting = await SystemSettingModel.getByKey("OPERATIONAL_RULE_PROTOCOL_ROAD");
    const tollSetting = await SystemSettingModel.getByKey("OPERATIONAL_RULE_TOLL_ROAD");

    const protocol_road_prohibited = this.parseStrictBooleanSetting(protocolSetting, "OPERATIONAL_RULE_PROTOCOL_ROAD");
    const toll_road_prohibited = this.parseStrictBooleanSetting(tollSetting, "OPERATIONAL_RULE_TOLL_ROAD");

    return {
      protocol_road_prohibited,
      toll_road_prohibited,
    };
  }

  /**
   * Updates operational rule settings and triggers PostGIS-scalable zone re-evaluation
   */
  public async updateOperationalRules(
    { protocol_road_prohibited, toll_road_prohibited }: { protocol_road_prohibited?: boolean; toll_road_prohibited?: boolean },
    user: any = {}
  ): Promise<any> {
    if (protocol_road_prohibited !== undefined && typeof protocol_road_prohibited !== "boolean") {
      const error: any = new Error("Nilai 'protocol_road_prohibited' harus berupa boolean (true/false).");
      error.statusCode = 400;
      throw error;
    }

    if (toll_road_prohibited !== undefined && typeof toll_road_prohibited !== "boolean") {
      const error: any = new Error("Nilai 'toll_road_prohibited' harus berupa boolean (true/false).");
      error.statusCode = 400;
      throw error;
    }

    const previousRules = await this.getOperationalRules();
    const newRules = {
      protocol_road_prohibited:
        protocol_road_prohibited !== undefined ? protocol_road_prohibited : previousRules.protocol_road_prohibited,
      toll_road_prohibited:
        toll_road_prohibited !== undefined ? toll_road_prohibited : previousRules.toll_road_prohibited,
    };

    if (protocol_road_prohibited !== undefined) {
      await SystemSettingModel.upsert(
        "OPERATIONAL_RULE_PROTOCOL_ROAD",
        String(newRules.protocol_road_prohibited),
        "Larangan operasional berjualan pada area jalan protokol"
      );

      await auditLogger.logAction({
        userId: user.id || null,
        userRole: user.role || "SUPERADMIN",
        action: "OPERATIONAL_RULE_CHANGED",
        entityType: "SYSTEM_SETTING",
        entityId: "OPERATIONAL_RULE_PROTOCOL_ROAD",
        details: {
          setting: "OPERATIONAL_RULE_PROTOCOL_ROAD",
          previous_value: previousRules.protocol_road_prohibited,
          new_value: newRules.protocol_road_prohibited,
        },
      });
    }

    if (toll_road_prohibited !== undefined) {
      await SystemSettingModel.upsert(
        "OPERATIONAL_RULE_TOLL_ROAD",
        String(newRules.toll_road_prohibited),
        "Larangan operasional berjualan pada area jalan tol"
      );

      await auditLogger.logAction({
        userId: user.id || null,
        userRole: user.role || "SUPERADMIN",
        action: "OPERATIONAL_RULE_CHANGED",
        entityType: "SYSTEM_SETTING",
        entityId: "OPERATIONAL_RULE_TOLL_ROAD",
        details: {
          setting: "OPERATIONAL_RULE_TOLL_ROAD",
          previous_value: previousRules.toll_road_prohibited,
          new_value: newRules.toll_road_prohibited,
        },
      });
    }

    const { zoneService } = await import("./zoneService.ts");
    const reevalSummary = await zoneService.reevaluateAffectedZonesForOperationalRules(previousRules, newRules);

    return {
      success: true,
      previous_data: previousRules,
      data: newRules,
      affected_zones_summary: reevalSummary,
    };
  }
}

export const operationalRuleService = OperationalRuleService.getInstance();

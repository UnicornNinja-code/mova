/*
 * seed-toll-roads.ts
 * Seeding offline spatial restriction layer for Toll Roads (Jalan Tol) to PostGIS
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import format from "pg-format";
import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedTollRoads() {
  console.log("\n================================================================================");
  console.log("🛣️  SEEDING SPATIAL RESTRICTION LAYER (JALAN TOL) KE POSTGIS");
  console.log("================================================================================");

  try {
    const geoJsonPath = path.join(__dirname, "../../public/geojson/jalan_tol.geojson");
    if (!fs.existsSync(geoJsonPath)) {
      console.warn("⚠️ File jalan_tol.geojson tidak ditemukan, melewati seeding offline jalan tol.");
      return;
    }

    const rawData = fs.readFileSync(geoJsonPath, "utf8");
    const geoJson = JSON.parse(rawData);
    const features = geoJson.features || [];

    console.log(`📊 Total Feature Jalan Tol Ditemukan : ${features.length}`);

    const validFeatures: any[] = [];
    for (let idx = 0; idx < features.length; idx++) {
      const feat = features[idx];
      if (feat.geometry?.type === "LineString" && Array.isArray(feat.geometry.coordinates)) {
        const externalId = feat.properties?.id || `way/toll-${idx + 1}`;
        const roadName = feat.properties?.name || "Jalan Tol Sidoarjo";
        const highwayType = feat.properties?.highway || "motorway";
        const geoJsonStr = JSON.stringify(feat.geometry);

        validFeatures.push([
          externalId,
          roadName,
          highwayType,
          "PROHIBITED_TOLL_ROAD",
          JSON.stringify(feat.properties || {}),
          geoJsonStr,
        ]);
      }
    }

    if (validFeatures.length === 0) {
      console.warn("⚠️ Tidak ada LineString feature valid di jalan_tol.geojson");
      return;
    }

    const insertQuery = format(
      `
      INSERT INTO protocol_roads (external_id, name, highway_type, restriction_type, metadata, geom)
      SELECT 
        v.external_id,
        v.name,
        v.highway_type,
        v.restriction_type,
        v.metadata::jsonb,
        ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326)
      FROM (VALUES %L) AS v(external_id, name, highway_type, restriction_type, metadata, geojson)
      ON CONFLICT (external_id) DO UPDATE SET
        name = EXCLUDED.name,
        highway_type = EXCLUDED.highway_type,
        restriction_type = EXCLUDED.restriction_type,
        metadata = EXCLUDED.metadata,
        geom = EXCLUDED.geom,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id;
    `,
      validFeatures
    );

    const { rows } = await pool.query(insertQuery);
    console.log(`✅ Berhasil menyisipkan/memperbarui ${rows.length} ruas jalan tol ke PostGIS!`);

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*)::int AS total FROM protocol_roads WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';"
    );
    console.log(`🛣️  Total Fitur Jalan Tol di PostGIS: ${countRows[0].total}`);
    console.log("================================================================================\n");
  } catch (err: any) {
    console.error("💥 Gagal seeding toll roads:", err.message);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedTollRoads().then(() => pool.end());
}

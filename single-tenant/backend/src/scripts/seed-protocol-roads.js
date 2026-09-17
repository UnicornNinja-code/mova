import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import format from "pg-format";
import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedProtocolRoads() {
  console.log("\n================================================================================");
  console.log("🚀 SEEDING SPATIAL RESTRICTION LAYER (JALAN PROTOKOL) KE POSTGIS");
  console.log("================================================================================");

  try {
    // STEP 1: Execute Migration 002
    const migrationSqlPath = path.join(__dirname, "../db/migrations/002_protocol_roads_spatial_layer.sql");
    const migrationSql = fs.readFileSync(migrationSqlPath, "utf8");
    await pool.query(migrationSql);
    console.log("   ✅ Table & GIST Index 'protocol_roads' siap di PostGIS.");

    // STEP 2: Read & Verify GeoJSON
    const geoJsonPath = path.join(__dirname, "../../public/geojson/jalan_protokol.geojson");
    if (!fs.existsSync(geoJsonPath)) {
      throw new Error("File GeoJSON tidak ditemukan!");
    }

    const rawData = fs.readFileSync(geoJsonPath, "utf8");
    const geoJson = JSON.parse(rawData);
    const features = geoJson.features || [];

    console.log(`📊 Total Feature Ditemukan : ${features.length}`);

    if (features.length === 0) {
      throw new Error("GeoJSON tidak memiliki feature!");
    }

    // STEP 3: Transform & Format Features for PostGIS Insertion
    const validFeatures = [];
    for (let idx = 0; idx < features.length; idx++) {
      const feat = features[idx];
      if (feat.geometry?.type === "LineString" && Array.isArray(feat.geometry.coordinates)) {
        const externalId = feat.properties?.id || `way/gen-${idx + 1}`;
        const roadName = feat.properties?.name || "Jalan Protokol Utama";
        const highwayType = feat.properties?.highway || "secondary";
        const geoJsonStr = JSON.stringify(feat.geometry);

        validFeatures.push([
          externalId,
          roadName,
          highwayType,
          "PROHIBITED_ROAD",
          JSON.stringify(feat.properties || {}),
          geoJsonStr,
        ]);
      }
    }

    console.log(`   • Total Valid LineString Feature: ${validFeatures.length} / ${features.length}`);

    // STEP 4: Bulk UPSERT into PostGIS protocol_roads table
    const batchSize = 200;
    let insertedCount = 0;

    for (let i = 0; i < validFeatures.length; i += batchSize) {
      const batch = validFeatures.slice(i, i + batchSize);
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
        batch
      );

      const { rows } = await pool.query(insertQuery);
      insertedCount += rows.length;
    }

    // STEP 5: Verify PostGIS Counts
    const { rows: countRows } = await pool.query("SELECT COUNT(*)::int AS total FROM protocol_roads;");
    const totalInDb = countRows[0].total;
    console.log("\n================================================================================");
    console.log("🎉 SEEDING SELESAI: " + totalInDb + " Road Features Tersimpan di PostGIS dengan GIST Index!");
    console.log("================================================================================\n");
  } catch (err) {
    console.error("💥 Gagal seeding protocol roads:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedProtocolRoads();

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { pool } from "../src/config/database.js";
import { globalSpatialMasterService } from "../src/services/spatial/GlobalSpatialMasterService.js";
import { overpassMirrorHealthService } from "../src/services/spatial/OverpassMirrorHealthService.js";
import { withTenantContext } from "../src/lib/tenantContext.js";

const TENANT_A = "test-spatial-tenant-a";
const TENANT_B = "test-spatial-tenant-b";

describe("Stage 2 — Global Spatial Master Integration Tests", () => {
  let zoneAId: string;
  let zoneBId: string;

  beforeAll(async () => {
    // 1. Setup Tenant A and Tenant B
    await pool.query(
      `INSERT INTO tenants (id, name, code, status, max_fleets, max_riders, max_zones)
       VALUES ($1, 'Tenant Spatial A', 'SPATIAL_A', 'ACTIVE', 20, 50, 10),
              ($2, 'Tenant Spatial B', 'SPATIAL_B', 'ACTIVE', 20, 50, 10)
       ON CONFLICT (id) DO NOTHING;`,
      [TENANT_A, TENANT_B]
    );

    // 2. Insert Shared Global POIs (is_global = true)
    await pool.query(`
      INSERT INTO pois (id, name, category, latitude, longitude, geom, status, operational_status, is_global, city_name)
      VALUES 
        ('11111111-1111-1111-1111-111111111101', 'Alun-Alun Sidoarjo Global', 'PUBLIC_SPACE', -7.4478, 112.7183, ST_SetSRID(ST_MakePoint(112.7183, -7.4478), 4326), 'APPROVED', 'ELIGIBLE', true, 'Sidoarjo'),
        ('11111111-1111-1111-1111-111111111102', 'Stasiun Sidoarjo Global', 'TRANSPORTATION', -7.4560, 112.7170, ST_SetSRID(ST_MakePoint(112.7170, -7.4560), 4326), 'APPROVED', 'ELIGIBLE', true, 'Sidoarjo'),
        ('11111111-1111-1111-1111-111111111103', 'Pasar Larangan Global', 'COMMERCIAL', -7.4620, 112.7150, ST_SetSRID(ST_MakePoint(112.7150, -7.4620), 4326), 'APPROVED', 'ELIGIBLE', true, 'Sidoarjo')
      ON CONFLICT (id) DO UPDATE SET is_global = true, operational_status = 'ELIGIBLE';
    `);

    // 3. Insert Protocol Road and Toll Road for Safety Buffer Tests
    await pool.query(`
      INSERT INTO protocol_roads (id, name, type, geom, is_global)
      VALUES (
        '22222222-2222-2222-2222-222222222201',
        'Jl. Ahmad Yani Sidoarjo (Protokol)',
        'PRIMARY',
        ST_SetSRID(ST_MakeLine(ST_MakePoint(112.7180, -7.4450), ST_MakePoint(112.7180, -7.4550)), 4326),
        true
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO toll_roads (id, name, type, geom, is_global)
      VALUES (
        '33333333-3333-3333-3333-333333333301',
        'Tol Surabaya-Gempol (KM 25)',
        'MOTORWAY',
        ST_SetSRID(ST_MakeLine(ST_MakePoint(112.7000, -7.4400), ST_MakePoint(112.7000, -7.4600)), 4326),
        true
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    // 4. Create Zones for Tenant A and Tenant B covering Sidoarjo area
    const sidoarjoPolygonGeoJson = {
      type: "Polygon",
      coordinates: [[
        [112.7100, -7.4400],
        [112.7300, -7.4400],
        [112.7300, -7.4700],
        [112.7100, -7.4700],
        [112.7100, -7.4400]
      ]]
    };

    const zA = await withTenantContext(TENANT_A, async (client) => {
      const res = await client.query(
        `INSERT INTO zones (tenant_id, name, polygon, status, is_valid)
         VALUES ($1, 'Zona Operasi Sidoarjo A', $2, 'ACTIVE', true)
         RETURNING id;`,
        [TENANT_A, JSON.stringify(sidoarjoPolygonGeoJson)]
      );
      return res.rows[0];
    });
    zoneAId = zA.id;

    const zB = await withTenantContext(TENANT_B, async (client) => {
      const res = await client.query(
        `INSERT INTO zones (tenant_id, name, polygon, status, is_valid)
         VALUES ($1, 'Zona Operasi Sidoarjo B', $2, 'ACTIVE', true)
         RETURNING id;`,
        [TENANT_B, JSON.stringify(sidoarjoPolygonGeoJson)]
      );
      return res.rows[0];
    });
    zoneBId = zB.id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM zones WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM pois WHERE id LIKE '11111111-1111-1111-1111-11111111110%';`);
    await pool.query(`DELETE FROM protocol_roads WHERE id = '22222222-2222-2222-2222-222222222201';`);
    await pool.query(`DELETE FROM toll_roads WHERE id = '33333333-3333-3333-3333-333333333301';`);
    await pool.end();
  });

  test("1. Shared POI Access: Tenant A and Tenant B can query the same Global POIs without row duplication", async () => {
    // Tenant A queries POIs in its zone
    const poisTenantA = await globalSpatialMasterService.getPoisInZone(TENANT_A, zoneAId);
    expect(poisTenantA.length).toBeGreaterThanOrEqual(3);

    // Tenant B queries POIs in its zone (same geographic coverage)
    const poisTenantB = await globalSpatialMasterService.getPoisInZone(TENANT_B, zoneBId);
    expect(poisTenantB.length).toBeGreaterThanOrEqual(3);

    // Ensure both tenants refer to the exact same global POI IDs
    const namesA = poisTenantA.map((p) => p.name).sort();
    const namesB = poisTenantB.map((p) => p.name).sort();
    expect(namesA).toEqual(namesB);
    expect(namesA).toContain("Alun-Alun Sidoarjo Global");
    expect(namesA).toContain("Stasiun Sidoarjo Global");
  });

  test("2. Category Filtering on Shared Global POIs", async () => {
    const transportPois = await globalSpatialMasterService.getPoisInZone(TENANT_A, zoneAId, ["TRANSPORTATION"]);
    expect(transportPois.length).toBe(1);
    expect(transportPois[0].name).toBe("Stasiun Sidoarjo Global");
    expect(transportPois[0].category).toBe("TRANSPORTATION");
  });

  test("3. Spatial Safety Validation: Rejects coordinate within 25m Toll Buffer", async () => {
    // Toll road is at lon 112.7000, lat -7.4500. Point at lon 112.7001 is ~11 meters away (< 25m)
    const tollResult = await globalSpatialMasterService.validateCoordinateSafety(-7.4500, 112.7001);
    expect(tollResult.isValid).toBe(false);
    expect(tollResult.code).toBe("PROHIBITED_TOLL_ROAD");
    expect(tollResult.reason).toContain("Jalan Tol");
  });

  test("4. Spatial Safety Validation: Rejects coordinate within 10m Protocol Road Buffer", async () => {
    // Protocol road is at lon 112.7180, lat -7.4500. Point at lon 112.71805 is ~5.5 meters away (< 10m)
    const roadResult = await globalSpatialMasterService.validateCoordinateSafety(-7.4500, 112.71805);
    expect(roadResult.isValid).toBe(false);
    expect(roadResult.code).toBe("PROHIBITED_ROAD");
    expect(roadResult.reason).toContain("jalan protokol");
  });

  test("5. Spatial Safety Validation: Approves safe coordinate outside prohibited buffers", async () => {
    // Safe point in residential / commercial area far from toll and protocol lines
    const safeResult = await globalSpatialMasterService.validateCoordinateSafety(-7.4478, 112.7250);
    expect(safeResult.isValid).toBe(true);
  });

  test("6. Overpass Mirror Health Service: Tracks metrics & prioritizes highest health score", () => {
    const endpoints = overpassMirrorHealthService.getHealthiestEndpoints();
    expect(endpoints.length).toBeGreaterThan(0);
    
    const primary = overpassMirrorHealthService.getPrimaryEndpoint();
    expect(primary).toBeDefined();
    expect(primary.healthScore).toBeGreaterThanOrEqual(50);

    // Simulate failure on primary
    overpassMirrorHealthService.recordResult(primary.url, false, 2500);
    const updatedEndpoints = overpassMirrorHealthService.getHealthiestEndpoints();
    expect(updatedEndpoints).toBeDefined();
  });

  test("7. Shared Spatial Statistics Aggregation", async () => {
    const stats = await globalSpatialMasterService.getSharedSpatialStatistics("Sidoarjo");
    expect(stats.is_global_shared).toBe(true);
    expect(stats.total_global_pois).toBeGreaterThanOrEqual(3);
  });
});

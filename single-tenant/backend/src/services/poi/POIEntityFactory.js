/*
 * POIEntityFactory.js
 * Factory Pattern & Schema Ingestion Transformer for Raw Overpass Elements
 */

const MIN_LATITUDE = -90.0;
const MAX_LATITUDE = 90.0;
const MIN_LONGITUDE = -180.0;
const MAX_LONGITUDE = 180.0;
const DEFAULT_COORDINATE_PRECISION = 1000000;

export class POIEntityFactory {
  static instance = null;

  constructor() {
    if (POIEntityFactory.instance) {
      return POIEntityFactory.instance;
    }
    POIEntityFactory.instance = this;
  }

  static getInstance() {
    if (!POIEntityFactory.instance) {
      POIEntityFactory.instance = new POIEntityFactory();
    }
    return POIEntityFactory.instance;
  }

  /**
   * Safely extract canonical OSM Source Identity (osm_type, osm_id, external_id)
   */
  extractSourceIdentity(el) {
    let osmType = el.type || el.osm_type || null;
    if (osmType) {
      osmType = String(osmType).toLowerCase().trim();
      if (!["node", "way", "relation"].includes(osmType)) {
        osmType = null;
      }
    }

    let osmId = null;
    if (el.id !== undefined && el.id !== null) {
      osmId = parseInt(el.id, 10);
    } else if (el.osm_id !== undefined && el.osm_id !== null) {
      osmId = parseInt(el.osm_id, 10);
    }

    if (!osmId || isNaN(osmId)) {
      const geom = el.geometry || el.geom || el.center || { lat: el.lat, lon: el.lon };
      const latVal = geom?.lat || el.lat || 0;
      const lonVal = geom?.lon || el.lon || 0;
      osmId = Math.floor(Math.abs(latVal * DEFAULT_COORDINATE_PRECISION + lonVal * 10000));
    }

    let externalId = null;
    if (osmType && osmId) {
      externalId = `osm:${osmType}:${osmId}`;
    } else if (osmId) {
      externalId = `osm:unspecified:${osmId}`;
    }

    return {
      osm_type: osmType,
      osm_id: osmId,
      external_id: externalId,
    };
  }

  /**
   * Safely extract OSM ID as integer (Legacy Helper)
   */
  extractOsmId(el) {
    return this.extractSourceIdentity(el).osm_id;
  }

  /**
   * Safely extract latitude and longitude with geographic boundary checks
   */
  extractCoordinates(el) {
    const geom = el.geometry || el.geom || el.center || { lat: el.lat, lon: el.lon };
    let lat = geom?.lat || el.lat;
    let lon = geom?.lon || el.lon;

    if (!lat && Array.isArray(geom) && geom.length > 0) {
      lat = geom[0].lat;
      lon = geom[0].lon;
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude < MIN_LATITUDE ||
      latitude > MAX_LATITUDE ||
      longitude < MIN_LONGITUDE ||
      longitude > MAX_LONGITUDE
    ) {
      return { latitude: NaN, longitude: NaN };
    }

    return { latitude, longitude };
  }

  /**
   * Factory method to transform raw Overpass element into standardized POI Entity DTO
   */
  createFromOverpassElement(el, clusterer) {
    const { osm_type, osm_id, external_id } = this.extractSourceIdentity(el);
    const { latitude, longitude } = this.extractCoordinates(el);

    let categoryName = clusterer.cluster(el.tags || {});
    let poiName = el.tags?.name || "";

    // Ghost filter & Blacklist noise filter
    if (
      categoryName === "IGNORED" ||
      (categoryName === "Lainnya" && (poiName.trim() === "" || poiName.trim().toLowerCase() === "lainnya"))
    ) {
      categoryName = "IGNORED";
    }

    // Normalisasi Nama Generik
    if (categoryName !== "IGNORED") {
      const lowerName = poiName.toLowerCase().trim();
      if (poiName.trim() === "" || lowerName === "yes") {
        poiName = `${categoryName} (Tanpa Nama)`;
      } else if (lowerName === "pitch") {
        poiName = "Lapangan Olahraga (Tanpa Nama)";
      } else if (lowerName === "building") {
        poiName = "Gedung (Tanpa Nama)";
      } else if (lowerName === "park") {
        poiName = "Taman Kota / Terbuka (Tanpa Nama)";
      }
    }

    const operationalData = clusterer.classifyOperationalStatus
      ? clusterer.classifyOperationalStatus(el.tags || {})
      : { operational_status: "ELIGIBLE", exclusion_reason: null };

    return {
      external_id,
      osm_type,
      osm_id,
      name: poiName,
      category: categoryName,
      latitude,
      longitude,
      status: "APPROVED",
      approval_status: "APPROVED",
      operational_status: operationalData.operational_status,
      exclusion_reason: operationalData.exclusion_reason,
      metadata: {
        raw_tags: el.tags || {},
        source: "OVERPASS_API",
        ingested_at: new Date().toISOString(),
      },
    };
  }
}

export const poiEntityFactory = POIEntityFactory.getInstance();

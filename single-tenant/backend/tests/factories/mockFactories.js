/*
 * mockFactories.js
 * Test Factory Utilities following Testing Patterns Skill (DRY, Sensible Defaults, Partial Overrides).
 */

/**
 * Factory for Mock User
 * @param {Partial<{id: string, name: string, email: string, role: string, is_active: boolean}>} overrides
 */
export const getMockUser = (overrides = {}) => {
  const id = overrides.id || `usr-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    name: "Test Rider User",
    username: `rider_${id}`,
    email: `${id}@mova.test`,
    role: "RIDER",
    is_active: true,
    first_login: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
};

/**
 * Factory for Mock Product
 * @param {Partial<{id: string, name: string, category: string, price: number, is_active: boolean, status: string}>} overrides
 */
export const getMockProduct = (overrides = {}) => {
  const id = overrides.id || `prod-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    name: "Kopi Susu Gula Aren",
    category: "COFFEE",
    price: 15000,
    cost_price: 8000,
    is_active: true,
    status: "AVAILABLE",
    stock_quantity: 100,
    ...overrides,
  };
};

/**
 * Factory for Mock Zone
 * @param {Partial<{id: string, name: string, code: string, status: string, max_capacity: number, polygon: any}>} overrides
 */
export const getMockZone = (overrides = {}) => {
  const id = overrides.id || `zone-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    name: "Zona Uji Coba Alpha",
    code: `ZN-${id.substring(0, 4).toUpperCase()}`,
    status: "ACTIVE",
    max_capacity: 5,
    active_riders_count: 0,
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [112.7100, -7.4400],
          [112.7300, -7.4400],
          [112.7300, -7.4600],
          [112.7100, -7.4600],
          [112.7100, -7.4400],
        ],
      ],
    },
    ...overrides,
  };
};

/**
 * Factory for Mock Armada (Fleet)
 * @param {Partial<{id: string, armada_code: string, status: string, current_rider_id: string|null}>} overrides
 */
export const getMockArmada = (overrides = {}) => {
  const id = overrides.id || `arm-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    armada_code: `MOVA-${Math.floor(100 + Math.random() * 900)}`,
    status: "ACTIVE",
    current_rider_id: null,
    held_by_rider_id: null,
    held_until: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
};

/**
 * Factory for Mock Telemetry / GPS Ping
 * @param {Partial<{lat: number, lon: number, latitude: number, longitude: number, speed: number, heading: number, battery: number}>} overrides
 */
export const getMockTelemetry = (overrides = {}) => {
  const base = {
    latitude: -7.4478,
    longitude: 112.7183,
    speed: 15.5,
    heading: 90,
    accuracy: 5.0,
    battery: 85,
    timestamp: new Date().toISOString(),
  };

  // If override specifies alias lat/lon without latitude/longitude, adjust base
  if (overrides.lat !== undefined && overrides.latitude === undefined) {
    delete base.latitude;
  }
  if (overrides.lon !== undefined && overrides.longitude === undefined) {
    delete base.longitude;
  }

  return {
    ...base,
    ...overrides,
  };
};

/**
 * Factory for Mock Sale Payload
 * @param {Partial<{saleId: string, riderId: string, productId: string, qty: number, unitPrice: number, totalPrice: number}>} overrides
 */
export const getMockSale = (overrides = {}) => {
  const qty = overrides.qty || 2;
  const unitPrice = overrides.unitPrice || 15000;
  return {
    saleId: overrides.saleId || `sale-${Math.random().toString(36).substring(2, 9)}`,
    assignmentId: overrides.assignmentId || `assign-${Math.random().toString(36).substring(2, 9)}`,
    riderId: overrides.riderId || `rider-${Math.random().toString(36).substring(2, 9)}`,
    riderName: overrides.riderName || "Rider Testing",
    zoneId: overrides.zoneId || "zone-test-1",
    zoneName: overrides.zoneName || "Zona Testing Pusat",
    productId: overrides.productId || "prod-test-1",
    productName: overrides.productName || "Kopi Mantap",
    qty,
    unitPrice,
    totalPrice: overrides.totalPrice || qty * unitPrice,
    lat: overrides.lat || -7.4478,
    lon: overrides.lon || 112.7183,
    ...overrides,
  };
};

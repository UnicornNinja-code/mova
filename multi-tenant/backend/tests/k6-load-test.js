/*
 * k6-load-test.js
 * Comprehensive K6 Performance & Stress Testing Suite
 * MantaKopi COZIS DSS Engine (Bun + PostGIS + Redis)
 *
 * Scenarios:
 * 1. Health & Session Baseline (Micro-benchmarks)
 * 2. Heavy PostGIS GeoJSON Spatial Retrieval (885 Protocol Roads + Zones)
 * 3. DSS TOPSIS Decision Engine Matrix Computation under load
 * 4. High-Concurrency Operational & Fleet Endpoints
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Metrics
const dssLatency = new Trend('dss_calculation_duration');
const spatialLatency = new Trend('spatial_geojson_duration');
const failureRate = new Rate('custom_failure_rate');

export const options = {
  stages: [
    { duration: '5s', target: 10 },   // Warm-up ramp up to 10 VUs
    { duration: '15s', target: 30 },  // Sustained load with 30 concurrent VUs
    { duration: '10s', target: 50 },  // Stress spike to 50 concurrent VUs
    { duration: '5s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<350', 'p(99)<800'], // 95% of requests under 350ms
    http_req_failed: ['rate<0.01'],                 // Under 1% errors allowed
    custom_failure_rate: ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:9000';

const publicHeaders = {
  headers: {
    'x-test-suite': 'true',
  },
};

// Global setup: obtain authentication tokens once
export function setup() {
  const loginPayload = JSON.stringify({
    identifier: 'superadmin@kopikeliling.com',
    password: 'password123',
  });

  const res = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
  });

  check(res, {
    'Setup: Super Admin Login successful': (r) => r.status === 200,
  });

  const token = res.json('token');
  return { token };
}

export default function (data) {
  const authHeaders = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
      'x-test-suite': 'true',
    },
  };

  // GROUP 1: Health & Baseline Session Check
  group('1. Baseline Health & Auth', function () {
    const resHealth = http.get(`${BASE_URL}/api/health`, publicHeaders);
    const healthOk = check(resHealth, {
      'Health check status is 200': (r) => r.status === 200,
      'Runtime is Bun + TS': (r) => r.json('runtime') === 'Bun + TypeScript',
    });
    if (!healthOk) failureRate.add(1);

    const resMe = http.get(`${BASE_URL}/api/auth/me`, authHeaders);
    const meOk = check(resMe, {
      'Auth /me status is 200': (r) => r.status === 200,
      'User is SUPERADMIN': (r) => r.json('user.role') === 'SUPERADMIN',
    });
    if (!meOk) failureRate.add(1);
  });

  // GROUP 2: Heavy PostGIS Spatial Layer Queries
  group('2. PostGIS Spatial Restriction Layers', function () {
    const t0 = Date.now();
    const resProtocol = http.get(`${BASE_URL}/api/roads/protocol`, publicHeaders);
    spatialLatency.add(Date.now() - t0);

    const protoOk = check(resProtocol, {
      'Protocol Roads status is 200': (r) => r.status === 200,
      'Has 885 Protocol Road Features': (r) => {
        const feats = r.json('features');
        return Array.isArray(feats) && feats.length >= 885;
      },
    });
    if (!protoOk) failureRate.add(1);

    const resZones = http.get(`${BASE_URL}/api/zones`, authHeaders);
    const zonesOk = check(resZones, {
      'Zones status is 200': (r) => r.status === 200,
      'Operational zones returned': (r) => {
        const z = r.json('zones') || r.json();
        return Array.isArray(z) && z.length > 0;
      },
    });
    if (!zonesOk) failureRate.add(1);
  });

  // GROUP 3: Decision Support System (BWM + TOPSIS) Engine
  group('3. Decision Support System (BWM & TOPSIS)', function () {
    const t0 = Date.now();
    const resTopsis = http.get(
      `${BASE_URL}/api/dss/recommendations?timeSlot=SIANG`,
      authHeaders
    );
    dssLatency.add(Date.now() - t0);

    const topsisOk = check(resTopsis, {
      'TOPSIS status is 200': (r) => r.status === 200,
      'TOPSIS rankings calculated': (r) => {
        const ranks = r.json('rankings');
        return Array.isArray(ranks) && ranks.length > 0;
      },
    });
    if (!topsisOk) failureRate.add(1);

    const resBwm = http.get(`${BASE_URL}/api/dss/bwm/active`, authHeaders);
    const bwmOk = check(resBwm, {
      'BWM Active Config is 200': (r) => r.status === 200,
      'BWM Config name present': (r) => !!r.json('config.name'),
    });
    if (!bwmOk) failureRate.add(1);
  });

  // GROUP 4: Operational Distribution, Fleet & Dashboard
  group('4. Operational Fleet & Distribution', function () {
    const resOverview = http.get(
      `${BASE_URL}/api/distribution/overview`,
      authHeaders
    );
    const overviewOk = check(resOverview, {
      'Distribution overview is 200': (r) => r.status === 200,
      'Has active operational session': (r) => !!r.json('session.id'),
    });
    if (!overviewOk) failureRate.add(1);

    const resArmadas = http.get(`${BASE_URL}/api/armadas`, authHeaders);
    const armadaOk = check(resArmadas, {
      'Armadas status is 200': (r) => r.status === 200,
      'Fleet units listed': (r) => {
        const list = r.json('armadas') || r.json();
        return Array.isArray(list) && list.length > 0;
      },
    });
    if (!armadaOk) failureRate.add(1);

    const resSummary = http.get(`${BASE_URL}/api/dashboard/summary`, authHeaders);
    const summaryOk = check(resSummary, {
      'Dashboard summary is 200': (r) => r.status === 200,
    });
    if (!summaryOk) failureRate.add(1);
  });

  // Polite pause between VU iterations (100ms - 300ms)
  sleep(0.2);
}

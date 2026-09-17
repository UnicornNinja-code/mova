/*
 * OverpassMirrorHealthService.ts
 * Overpass Mirror Health Score Tracker & Dynamic Failover Service
 * 
 * Melacak latensi, tingkat keberhasilan/kegagalan, dan health score per endpoint mirror
 * untuk memilih endpoint Overpass API publik paling sehat secara dinamis.
 */

export interface MirrorEndpoint {
  url: string;
  name: string;
  latencyMs: number;
  successCount: number;
  failureCount: number;
  healthScore: number; // 0 to 100
  lastCheckedAt?: Date;
  isAvailable: boolean;
}

export class OverpassMirrorHealthService {
  private static instance: OverpassMirrorHealthService | null = null;
  private endpoints: MirrorEndpoint[] = [
    {
      url: "https://overpass.kumi.systems/api/interpreter",
      name: "Kumi Systems Mirror",
      latencyMs: 150,
      successCount: 10,
      failureCount: 0,
      healthScore: 100,
      isAvailable: true,
    },
    {
      url: "https://overpass-api.de/api/interpreter",
      name: "Main German Overpass API",
      latencyMs: 300,
      successCount: 8,
      failureCount: 1,
      healthScore: 88,
      isAvailable: true,
    },
    {
      url: "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      name: "Mail.ru Mirror",
      latencyMs: 450,
      successCount: 5,
      failureCount: 2,
      healthScore: 71,
      isAvailable: true,
    },
  ];

  public static getInstance(): OverpassMirrorHealthService {
    if (!OverpassMirrorHealthService.instance) {
      OverpassMirrorHealthService.instance = new OverpassMirrorHealthService();
    }
    return OverpassMirrorHealthService.instance;
  }

  /**
   * Mengambil daftar mirror terurut berdasarkan Health Score tertinggi
   */
  public getHealthiestEndpoints(): MirrorEndpoint[] {
    return [...this.endpoints].sort((a, b) => b.healthScore - a.healthScore);
  }

  /**
   * Mengambil endpoint terbaik saat ini
   */
  public getPrimaryEndpoint(): MirrorEndpoint {
    const sorted = this.getHealthiestEndpoints();
    return sorted[0] || this.endpoints[0];
  }

  /**
   * Mencatat hasil eksekusi kueri pada endpoint
   */
  public recordResult(url: string, success: boolean, latencyMs: number): void {
    const endpoint = this.endpoints.find((e) => e.url === url);
    if (!endpoint) return;

    endpoint.lastCheckedAt = new Date();
    endpoint.latencyMs = Math.round((endpoint.latencyMs * 0.7) + (latencyMs * 0.3));

    if (success) {
      endpoint.successCount++;
    } else {
      endpoint.failureCount++;
    }

    // Recalculate health score (Success ratio 70% + Latency penalty 30%)
    const total = endpoint.successCount + endpoint.failureCount;
    const successRatio = total > 0 ? (endpoint.successCount / total) * 70 : 70;
    const latencyFactor = Math.max(0, 30 - Math.min(30, (endpoint.latencyMs / 1000) * 10));

    endpoint.healthScore = Math.min(100, Math.max(0, Math.round(successRatio + latencyFactor)));
    endpoint.isAvailable = endpoint.healthScore > 20;
  }

  /**
   * Simulasi check health cepat / ping ringan
   */
  public async pingMirror(url: string): Promise<boolean> {
    const start = Date.now();
    try {
      const response = await fetch(`${url}?data=[out:json];node(1);out;`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      const latency = Date.now() - start;
      const success = response.ok;
      this.recordResult(url, success, latency);
      return success;
    } catch {
      const latency = Date.now() - start;
      this.recordResult(url, false, latency);
      return false;
    }
  }
}

export const overpassMirrorHealthService = OverpassMirrorHealthService.getInstance();

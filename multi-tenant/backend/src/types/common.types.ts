/*
 * common.types.ts
 * Universal API envelopes, pagination, and GeoJSON types
 */

export interface ApiResponse<T = any> {
  status: "success" | "error" | "fail";
  statusCode?: number;
  message?: string;
  msg?: string;
  data?: T;
  meta?: PaginationMeta;
  error?: string;
  code?: string;
  details?: any;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface PaginationQuery {
  page?: number | string;
  limit?: number | string;
  search?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC" | "asc" | "desc";
  status?: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][]; // [ [ [lng, lat], ... ] ]
}

export interface GeoJSONMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export type GeoJSONGeometry = GeoJSONPoint | GeoJSONPolygon | GeoJSONMultiPolygon;

export interface GeoJSONFeature<G = GeoJSONGeometry, P = Record<string, any>> {
  type: "Feature";
  geometry: G;
  properties: P;
}

export interface GeoJSONFeatureCollection<G = GeoJSONGeometry, P = Record<string, any>> {
  type: "FeatureCollection";
  features: GeoJSONFeature<G, P>[];
}

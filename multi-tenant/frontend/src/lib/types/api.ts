/*
 * api.ts
 * Single Source of Truth TypeScript interfaces for API Envelopes, Paginated Responses,
 * and Centralized RFC 7807/JSend Error Contracts in Svelte 5 Frontend.
 */

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: {
    timestamp: string;
    request_id?: string;
  };
}

export interface ApiPaginationMeta {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ApiPaginatedResponse<T> {
  success: boolean;
  message?: string;
  data: T[];
  pagination: ApiPaginationMeta;
  meta?: {
    timestamp: string;
    request_id?: string;
  };
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
  code?: string;
}

export interface ApiErrorEnvelope {
  success: false;
  status?: "error";
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta?: {
    timestamp: string;
    request_id?: string;
  };
}

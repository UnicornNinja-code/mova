/*
 * product.types.ts & sales.types.ts
 */

export interface Product {
  id: number;
  code: string;
  name: string;
  category?: string;
  price: number;
  cost_price?: number;
  is_active: boolean;
  image_url?: string | null;
  stock?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface SalesTransaction {
  id: number;
  transaction_code: string;
  rider_id: number;
  rider_name?: string;
  armada_id?: number | null;
  zone_id?: number | null;
  poi_id?: number | null;
  total_amount: number;
  payment_method: "CASH" | "QRIS" | "TRANSFER";
  status: "COMPLETED" | "CANCELLED" | "PENDING";
  items?: SalesTransactionItem[];
  created_at?: Date | string;
}

export interface SalesTransactionItem {
  id?: number;
  transaction_id?: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SalesEntryDto {
  rider_id?: number;
  armada_id?: number;
  zone_id?: number;
  poi_id?: number;
  payment_method: "CASH" | "QRIS" | "TRANSFER";
  items: Array<{
    product_id: number;
    quantity: number;
    unit_price?: number;
  }>;
}

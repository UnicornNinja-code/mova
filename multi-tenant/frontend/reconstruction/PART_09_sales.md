# FRONTEND PART 09 — POS MOBILE CATALOG, CART & SALES RECORDING

## 1. Objective
Reconstruct Point-of-Sale (POS) mobile interfaces for riders and catalog management for supervisors: instant product catalog with WebP image previews, responsive cart state, cash change calculation, dynamic QRIS generation, and shift sales aggregation.

## 2. Target Svelte Components & Routes
- `src/pages/rider/RiderDashboardPage.svelte` (Tab POS/Kasir)
- `src/pages/superadmin/SuperAdminCatalogPage.svelte`
- `src/pages/supervisor/SupervisorCatalogPage.svelte`
- `src/components/rider/PosCatalogGrid.svelte`
- `src/components/rider/PosCartDrawer.svelte`
- `src/components/rider/PaymentModal.svelte`
- `src/components/rider/ShiftSummaryCard.svelte`
- `src/components/catalog/ProductFormModal.svelte`
- `src/services/productService.ts`
- `src/services/riderService.ts`

## 3. API Contract Binding (Backend Dependency)
- `GET /api/products?status=active` → Response `ProductItem[]`
- `POST /api/rider/record-sale` → Request `{ items: [{ product_id, quantity }], payment_method: "CASH"|"QRIS", cash_received? }` → Response `{ sale_id, items, total_price, payment, created_at }`
- `GET /api/rider/my-sales` → Response `{ shift_summary: { total_transactions, total_items_sold, total_revenue, cash_revenue, qris_revenue }, sales: [...] }`
- `GET /api/sales/overview` → Response `{ total_revenue, total_units, product_breakdown, zone_breakdown }`
- `POST /api/products`, `PUT /api/products/:id`, `PATCH /api/products/:id/status`, `DELETE /api/products/:id`
- `POST /api/products/upload-image` → Form-data → Response `{ image_url, file_size_kb, format: "webp" }`

## 4. State Management & Svelte 5 Runes Spec
- **Cart State:**
  ```typescript
  class CartState {
    items = $state<Map<string, { product: ProductItem; quantity: number }>>(new Map());
    totalItems = $derived(Array.from(this.items.values()).reduce((sum, i) => sum + i.quantity, 0));
    estimatedTotal = $derived(Array.from(this.items.values()).reduce((sum, i) => sum + i.quantity * i.product.price, 0));

    addItem(product: ProductItem) { ... }
    removeItem(productId: string) { ... }
    clear() { this.items.clear(); }
  }
  ```

## 5. UI/UX Interaction & Edge Cases
- **Fast Cash Preset Buttons:** Quick denomination buttons (Rp 20.000, Rp 50.000, Rp 100.000) that automatically calculate change (`cash_received - total_price`).
- **QRIS Modal Flow:** When QRIS is selected, displays high-contrast QR code. Rider memverifikasi pembayaran via tombol "Konfirmasi Pembayaran Diterima" (*show-and-confirm manual verification*) sebelum transaksi disimpan.
- **Server-Side Price Authority:** UI hanya menampilkan kalkulasi lokal sebagai estimasi visual; total resmi selalu dikonfirmasi oleh backend saat transaksi disimpan.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export interface ProductItem {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category?: string;
  is_active: boolean;
  created_at: string;
}

export interface ShiftSummaryData {
  total_transactions: number;
  total_items_sold: number;
  total_revenue: number;
  cash_revenue: number;
  qris_revenue: number;
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:** `src/pages/superadmin/SuperAdminCatalogPage.svelte`, `src/pages/supervisor/SupervisorCatalogPage.svelte`, `src/components/rider/Pos*`, `src/components/catalog/*`, `src/services/productService.ts`
- **Forbidden:** Core PostGIS geometry layers.

## 8. Verification & Acceptance Criteria
- [x] Cart updates totals dynamically with zero-latency response on mobile.
- [x] Recording sale successfully records CASH change or QRIS payload.
- [x] Shift summary aggregates sales totals and displays instant revenue badges.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 09 Setup | POS catalog, cart drawer, payment modal & product service verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |

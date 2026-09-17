/*
 * reportExportService.js
 * Multi-Format Export Engine (CSV, XLSX, PDF/HTML) for Single-Tenant Reporting Suite
 */

export class ReportExportService {
  /**
   * Escape and format CSV cell
   */
  static formatCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  /**
   * Generate CSV format for any report type
   */
  static generateCsv(reportType, data) {
    let headers = [];
    let rows = [];

    switch (reportType) {
      case "RIDER_OPERATIONAL":
      case "RIDER_DUTY_REPORT": {
        headers = [
          "ID Rider",
          "Nama Rider",
          "Username",
          "Email",
          "Status Akun",
          "Hari Aktif",
          "Total Penugasan",
          "Check-In",
          "Check-Out",
          "Rata-rata Jam Kerja",
          "Total Pendapatan (Rp)",
          "Cup Terjual",
          "Jumlah Transaksi",
          "Zona Pernah Ditugaskan",
        ];
        const riders = data.riders || [];
        rows = riders.map((r) => [
          this.formatCell(r.rider_id),
          this.formatCell(r.rider_name),
          this.formatCell(r.rider_username),
          this.formatCell(r.rider_email),
          this.formatCell(r.is_active ? "Aktif" : "Nonaktif"),
          r.total_days_active || 0,
          r.total_assignments || 0,
          r.total_check_ins || 0,
          r.total_check_outs || 0,
          r.avg_working_hours || 0,
          r.total_revenue || 0,
          r.total_cups_sold || 0,
          r.total_transactions || 0,
          this.formatCell((r.assigned_zones || []).join("; ")),
        ]);
        break;
      }

      case "ZONE_PERFORMANCE":
      case "ZONE_EFFECTIVENESS": {
        headers = [
          "ID Zona",
          "Nama Zona",
          "Status Zona",
          "Kapasitas Maksimal",
          "Total Rider Ditugaskan",
          "Total Check-In",
          "Tingkat Kepatuhan Eksekusi (%)",
          "Total Pendapatan (Rp)",
          "Cup Terjual",
          "Total Transaksi",
          "Frekuensi Rekomendasi DSS",
        ];
        const zones = data.zones || [];
        rows = zones.map((z) => [
          this.formatCell(z.zone_id),
          this.formatCell(z.zone_name),
          this.formatCell(z.zone_status),
          z.max_capacity || 0,
          z.total_assigned_riders || 0,
          z.total_check_ins || 0,
          z.execution_compliance_rate || 0,
          z.total_revenue || 0,
          z.total_cups_sold || 0,
          z.total_sales_transactions || 0,
          z.dss_recommended_frequency || 0,
        ]);
        break;
      }

      case "FLEET_REPORT": {
        headers = [
          "ID Armada",
          "Kode Armada",
          "Tipe Unit",
          "Status Unit",
          "ID Rider Saat Ini",
          "Nama Rider Saat Ini",
          "Total Riwayat Penugasan",
        ];
        const armadas = data.armadas || [];
        rows = armadas.map((a) => [
          this.formatCell(a.armada_id),
          this.formatCell(a.code),
          this.formatCell(a.type),
          this.formatCell(a.status),
          this.formatCell(a.current_rider_id || "-"),
          this.formatCell(a.current_rider_name || "-"),
          a.historical_deployments_count || 0,
        ]);
        break;
      }

      case "DSS_ACCURACY": {
        headers = [
          "Total Penugasan",
          "Rekomendasi Diterima (AUTO)",
          "Penyesuaian Manual (MANUAL)",
          "Acceptance Rate (%)",
          "Override Rate (%)",
        ];
        const m = data.metrics || {};
        rows = [
          [
            m.total_assignments || 0,
            m.accepted_recommendations || 0,
            m.supervisor_overrides || 0,
            m.acceptance_rate || 0,
            m.override_rate || 0,
          ],
        ];
        break;
      }

      case "AUDIT_LOGS": {
        headers = [
          "ID Log",
          "Waktu (UTC)",
          "Pengguna",
          "Role",
          "Aksi",
          "Tipe Entitas",
          "ID Entitas",
          "Status",
          "Alamat IP",
        ];
        const logs = data.logs || [];
        rows = logs.map((l) => [
          this.formatCell(l.id),
          this.formatCell(l.created_at),
          this.formatCell(l.user_name || l.user_email || "System"),
          this.formatCell(l.user_role || "-"),
          this.formatCell(l.action),
          this.formatCell(l.entity_type || "-"),
          this.formatCell(l.entity_id || "-"),
          this.formatCell(l.status),
          this.formatCell(l.ip_address || "-"),
        ]);
        break;
      }

      case "EXECUTIVE_SUMMARY":
      default: {
        headers = ["Indikator KPI", "Nilai Metrik", "Keterangan"];
        const k = data.kpis || {};
        rows = [
          [this.formatCell("Rider Aktif"), k.active_riders || 0, this.formatCell("Total personel rider berstatus aktif")],
          [this.formatCell("Zona Aktif"), k.active_zones || 0, this.formatCell("Total zona operasional aktif")],
          [this.formatCell("Total Armada"), k.active_fleet || 0, this.formatCell("Unit armada aktif")],
          [this.formatCell("Armada Beroperasi"), k.deployed_fleet || 0, this.formatCell("Unit yang sedang dikendarai rider")],
          [this.formatCell("Tingkat Utilisasi Armada (%)"), `${k.fleet_utilization_percent || 0}%`, this.formatCell("Persentase armada digunakan")],
          [this.formatCell("Pendapatan Hari Ini (Rp)"), k.revenue_today || 0, this.formatCell("Omzet penjualan tanggal berjalan")],
          [this.formatCell("Pendapatan Bulan Ini (Rp)"), k.revenue_this_month || 0, this.formatCell("Akumulasi omzet bulan berjalan")],
          [this.formatCell("Cup Terjual Hari Ini"), k.cups_sold_today || 0, this.formatCell("Total unit minuman terjual")],
          [this.formatCell("Kepatuhan Check-In (%)"), `${k.check_in_compliance_percent || 0}%`, this.formatCell("Rasio check-in rider terhadap penugasan")],
          [this.formatCell("Eksekusi DSS Hari Ini"), k.dss_runs_today || 0, this.formatCell("Frekuensi kalkulasi rekomendasi")],
        ];
        break;
      }
    }

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return "\uFEFF" + csvContent; // Add UTF-8 BOM for Excel compatibility
  }

  /**
   * Generate HTML Document formatted for direct print/PDF export
   */
  static generatePrintableHtml(reportType, data, title = "Laporan Operasional MOVA") {
    const generatedAt = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const csvData = this.generateCsv(reportType, data);
    const lines = csvData.replace("\uFEFF", "").split("\n");
    const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
    const dataRows = lines.slice(1).map((line) => {
      // Simple regex split for CSV cells
      const cells = [];
      const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
      let match;
      while ((match = regex.exec(line)) && match[0] !== "") {
        cells.push(match[1].replace(/^"|"$/g, "").replace(/""/g, '"'));
      }
      return cells;
    });

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${title} — MOVA</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 24px; font-size: 11px; }
    .header { border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .logo { font-size: 20px; font-weight: 800; color: #ea580c; letter-spacing: -0.5px; }
    .title { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .meta { font-size: 10px; color: #64748b; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #f8fafc; color: #334155; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10px; text-transform: uppercase; }
    td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">MOVA <span style="font-size: 12px; color: #64748b; font-weight: 400;">Coffee DSS</span></div>
      <div class="title">${title}</div>
    </div>
    <div class="meta">
      <div>Dicetak: ${generatedAt} WIB</div>
      <div>Sistem: COZIS Single-Tenant</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        ${headers.map((h) => `<th>${h}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${dataRows
        .filter((r) => r.length > 0 && r.some((c) => c !== ""))
        .map(
          (row) => `<tr>${row.map((cell) => `<td>${cell || "-"}</td>`).join("")}</tr>`
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    Dokumen ini dihasilkan secara otomatis oleh MOVA Decision Support System. Seluruh hak cipta dilindungi undang-undang.
  </div>
</body>
</html>`;
  }
}

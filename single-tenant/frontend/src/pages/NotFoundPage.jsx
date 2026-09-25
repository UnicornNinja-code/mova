import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/primitives";
import { AlertCircle, ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="w-12 h-12 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-primary)] mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-3xl font-mono font-bold text-[var(--text-primary)] mb-1">404</h2>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Halaman Tidak Ditemukan</h3>
      <p className="text-xs text-[var(--text-secondary)] max-w-sm mb-5 leading-relaxed">
        Rute yang Anda tuju tidak terdaftar pada sistem kontrol operasional KopiGo.
      </p>
      <Link to="/overview">
        <Button variant="secondary" size="sm" leadingIcon={ArrowLeft}>
          Kembali ke Dashboard
        </Button>
      </Link>
    </div>
  );
}

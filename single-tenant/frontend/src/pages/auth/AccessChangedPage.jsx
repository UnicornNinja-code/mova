import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout/AuthLayout";
import { Button } from "@/components/primitives";
import { ShieldAlert, ArrowRight, LogIn, AlertCircle, Lock } from "lucide-react";
import { formatRoleName, getRoleConfig } from "@/lib/formatters";

export function AccessChangedPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Try reading from React Router navigation state, or fallback to sessionStorage
  const [transitionData] = React.useState(() => {
    if (location.state?.previousRole || location.state?.newRole) {
      return location.state;
    }
    try {
      const stored = sessionStorage.getItem("mova_access_changed_state");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return {};
  });

  const previousRole = transitionData.previousRole || "PREVIOUS_ROLE";
  const newRole = transitionData.newRole || "NEW_ROLE";
  const reason = transitionData.reason || "Perubahan hak akses peran oleh Superadmin";

  const prevConfig = getRoleConfig(previousRole);
  const newConfig = getRoleConfig(newRole);

  const handleSignInAgain = () => {
    try {
      sessionStorage.removeItem("mova_access_changed_state");
    } catch (e) {}
    navigate("/login", { replace: true });
  };

  return (
    <AuthLayout
      badgeText="SECURITY • SESSION INVALIDATION"
      title="HAK AKSES DIPERBARUI"
      subtitle="Mutasi wewenang peran & penegakan kebijakan sesi MOVA"
      maxWidth="max-w-lg"
    >
      <div className="space-y-6 pt-1 text-center">
        {/* Security Shield Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-xs">
          <ShieldAlert className="h-7 w-7" />
        </div>

        {/* Main Headings */}
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
            Perubahan Hak Akses Peran
          </h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">
            Wewenang akun Anda telah diperbarui. Demi keamanan dan integritas operasional, sesi aktif sebelumnya telah diakhiri secara otomatis.
          </p>
        </div>

        {/* Role Transition Visualizer Box */}
        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-raised)]/60 border border-[var(--border-subtle)] space-y-3 text-left">
          <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-[var(--text-muted)] block text-center">
            Jalur Perubahan Peran
          </span>

          <div className="flex items-center justify-center gap-3">
            {/* Previous Role Pill */}
            <div className="flex-1 text-center p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border-subtle)]">
              <span className="text-[9px] uppercase font-semibold text-[var(--text-muted)] block">
                Peran Sebelumnya
              </span>
              <span className="font-semibold text-xs text-[var(--text-muted)] line-through block mt-0.5">
                {formatRoleName(previousRole)}
              </span>
            </div>

            <ArrowRight className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />

            {/* New Role Pill */}
            <div className={`flex-1 text-center p-2.5 rounded-[var(--radius-sm)] border ${newConfig.badgeClass}`}>
              <span className="text-[9px] uppercase font-semibold block opacity-80">
                Peran Baru
              </span>
              <span className="font-bold text-xs block mt-0.5">
                {formatRoleName(newRole)}
              </span>
            </div>
          </div>
        </div>

        {/* Informative Security Callout */}
        <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border-subtle)] text-left flex items-start gap-3">
          <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
          <div className="space-y-1 text-[11px] text-[var(--text-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--text-primary)] block">
              Penegakan Keamanan (OWASP Session Management)
            </span>
            <p>
              Sistem telah mencabut token otentikasi lama Anda. Silakan login kembali untuk masuk ke ruang kerja sesuai wewenang dan profil peran baru Anda.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSignInAgain}
            className="w-full flex items-center justify-center gap-2 text-xs h-10 shadow-sm font-semibold"
          >
            <LogIn className="w-4 h-4" />
            <span>Masuk Kembali ke MOVA</span>
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}

export default AccessChangedPage;

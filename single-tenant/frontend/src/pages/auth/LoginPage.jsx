import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";
import { authService } from "@/services/authService";
import {
  Panel,
  Button,
  Input,
  Select,
  SelectItem,
  Alert,
  Stack,
} from "@/components/primitives";
import { FormField, FormLabel, FormErrorText } from "@/components/composites";
import { ShieldCheck, Lock, User, KeyRound } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [username, setUsername] = useState("supervisor");
  const [password, setPassword] = useState("password123");
  const [selectedRole, setSelectedRole] = useState("SUPERVISOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        username,
        password,
      });

      setAuth(response.accessToken, response.user);

      if (response.user.role === "RIDER") {
        navigate("/rider");
      } else {
        navigate("/overview");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Gagal masuk ke sistem.");
    } finally {
      setLoading(false);
    }
  };

  // Demo shortcut helper
  const handleQuickRole = (role, user, pass = "password123") => {
    setSelectedRole(role);
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--background)] p-4">
      <div className="w-full max-w-md">
        <Panel className="p-6 md:p-8 shadow-xl border-[var(--border)]">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border-subtle)]">
            <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--accent-primary)] flex items-center justify-center text-white font-mono font-bold text-lg shadow-md">
              M
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                MOVA CONTROL ROOM
              </h1>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                Sidoarjo Operational Command System
              </p>
            </div>
          </div>

          {error && (
            <Alert variant="danger" className="mb-5">
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <FormField>
              <FormLabel htmlFor="username" required>Username / Email</FormLabel>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                leadingIcon={User}
                placeholder="Masukkan username"
                required
              />
            </FormField>

            <FormField>
              <FormLabel htmlFor="password" required>Kata Sandi</FormLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leadingIcon={Lock}
                placeholder="Masukkan kata sandi"
                required
              />
            </FormField>

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2" leadingIcon={ShieldCheck}>
              Masuk ke Sesi Operasional
            </Button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Pilihan Akun Uji Coba Cepat (SSOT Role):
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <Button variant="outline" size="sm" onClick={() => handleQuickRole("SUPERADMIN", "superadmin")}>
                Superadmin
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickRole("MANAGEMENT", "management")}>
                Management
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickRole("SUPERVISOR", "supervisor")}>
                Supervisor
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickRole("RIDER", "rider1")}>
                Rider #1
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

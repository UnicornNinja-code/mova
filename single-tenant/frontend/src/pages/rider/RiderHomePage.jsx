import React, { useState } from "react";
import { Stack, Panel, Button, Alert, Skeleton, EmptyState } from "@/components/primitives";
import { RiderAction, AssignmentCard, GpsStatusIndicator } from "@/components/rider";
import { MapPin, Navigation, ShoppingBag, LogOut, CheckCircle2, ShieldAlert } from "lucide-react";
import { useActiveDuty, useCheckInMutation, useCheckoutMutation } from "@/hooks/queries/useRiderOps";

export function RiderHomePage() {
  const { data: dutyData, isLoading: loadingDuty, refetch: refetchDuty } = useActiveDuty();
  const checkInMutation = useCheckInMutation();
  const checkoutMutation = useCheckoutMutation();
  const [gpsError, setGpsError] = useState(null);

  const isCheckedIn = dutyData?.status === "CHECKED_IN" || dutyData?.status === "IN_PROGRESS";
  const isActionLoading = checkInMutation.isPending || checkoutMutation.isPending;

  const handleCheckIn = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("Browser tidak mendukung geolokasi GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await checkInMutation.mutateAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            zoneId: dutyData?.zone_id,
          });
          refetchDuty();
        } catch (err) {
          setGpsError(err?.response?.data?.message || err.message || "Gagal melakukan verifikasi check-in spasial.");
        }
      },
      (err) => {
        setGpsError(`Gagal membaca sinyal GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCheckOut = async () => {
    try {
      await checkoutMutation.mutateAsync({
        sessionId: dutyData?.id,
      });
      refetchDuty();
    } catch (err) {
      setGpsError(err?.response?.data?.message || err.message || "Gagal menyelesaikan shift.");
    }
  };

  if (loadingDuty) {
    return (
      <Stack gap="md" className="p-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </Stack>
    );
  }

  if (!dutyData || !dutyData.zone_id) {
    return (
      <Stack gap="md">
        <Panel>
          <div className="p-8 text-center">
            <EmptyState
              title="Belum Ada Penugasan Shift Aktif"
              description="Anda belum dialokasikan ke zona operasional atau armada gerobak. Silakan hubungi Supervisor Operasional untuk memulai shift hari ini."
            />
          </div>
        </Panel>
        <Alert variant="info">
          Setelah armada dan zona dialokasikan oleh sistem DSS, kartu penugasan akan otomatis muncul pada layar ini.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Live GPS Telemetry Status */}
      <GpsStatusIndicator
        isLive={true}
        complianceStatus={isCheckedIn ? "COMPLIANT" : "INACTIVE"}
        accuracyMeters={4}
      />

      {gpsError && (
        <Alert variant="danger" icon={ShieldAlert}>
          {gpsError}
        </Alert>
      )}

      {/* Assignment Card */}
      <AssignmentCard
        zoneName={dutyData.zone_name || "Zona Operasional"}
        hubCity={dutyData.hub_city || "Sidoarjo"}
        armadaName={dutyData.armada_code || dutyData.armada_name || "Armada Utama"}
        shiftTime={dutyData.shift_name || "Shift Operasional"}
        status={dutyData.status || "ACTIVE"}
      />

      {/* Primary Action Button (One Decision Per Screen) */}
      <div className="pt-2">
        {!isCheckedIn ? (
          <RiderAction
            label="Mulai Check-In Spasial"
            sublabel={`Verifikasi koordinat di dalam area ${dutyData.zone_name || "Zona"}`}
            icon={MapPin}
            variant="primary"
            loading={isActionLoading}
            onClick={handleCheckIn}
          />
        ) : (
          <Stack gap="sm">
            <RiderAction
              label="Catat Penjualan (POS)"
              sublabel="Input transaksi pesanan kopi pelanggan"
              icon={ShoppingBag}
              variant="success"
              onClick={() => alert("Membuka Modal POS Kasir")}
            />
            <RiderAction
              label="Selesaikan Shift & Check-Out"
              sublabel="Kembalikan armada ke hub operasional"
              icon={LogOut}
              variant="secondary"
              loading={isActionLoading}
              onClick={handleCheckOut}
            />
          </Stack>
        )}
      </div>

      {/* Operational Notice */}
      <Alert variant="info">
        Tetap patuhi batas kecepatan maksimum 25 km/jam dan hindari memasuki ruas Jalan Protokol & Tol terlarang.
      </Alert>
    </Stack>
  );
}


export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <h2 className="text-3xl font-mono font-bold text-[var(--accent-primary)] mb-2">404</h2>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Halaman Tidak Ditemukan</h3>
      <p className="text-xs text-[var(--text-secondary)] max-w-sm mb-4">
        Rute yang Anda tuju tidak terdaftar pada sistem kontrol operasional MOVA.
      </p>
      <Button variant="secondary" size="sm" onClick={() => window.history.back()}>
        Kembali ke Halaman Sebelumnya
      </Button>
    </div>
  );
}

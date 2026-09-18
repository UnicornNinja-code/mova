import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSocket, getSocket } from "@/services/socketService";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  dashboardKeys,
  riderKeys,
  fleetKeys,
  zoneKeys,
  dssKeys,
  competitorKeys,
} from "@/lib/queryKeys";

/**
 * useRealtimeSync
 * Subscribes to Socket.IO backend domain events and automatically invalidates
 * the corresponding TanStack Query cache boundaries.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket();

    const handleSaleRecorded = () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
    };

    const handleArmadaStatusChanged = () => {
      queryClient.invalidateQueries({ queryKey: fleetKeys.all });
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
    };

    const handleRiderStatusChanged = () => {
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    };

    const handleGeofenceAlert = () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: riderKeys.liveLocations() });
    };

    const handleZoneChanged = () => {
      queryClient.invalidateQueries({ queryKey: zoneKeys.all });
      queryClient.invalidateQueries({ queryKey: dssKeys.all });
    };

    const handleCompetitorUpdated = () => {
      queryClient.invalidateQueries({ queryKey: competitorKeys.all });
    };

    const handleAccessChanged = (data) => {
      console.warn("🔒 [REAL-TIME] Access/Role changed on server:", data);
      const clearAuth = useAuthStore.getState().clearAuth;
      clearAuth();
      try {
        sessionStorage.setItem(
          "mova_access_changed_state",
          JSON.stringify({
            previousRole: data?.previousRole || null,
            newRole: data?.newRole || null,
            reason: data?.reason || "Perubahan hak akses peran oleh Superadmin.",
          })
        );
      } catch (e) {}
      if (typeof window !== "undefined" && window.location.pathname !== "/access-changed") {
        window.location.href = "/access-changed";
      }
    };

    socket.on("access:changed", handleAccessChanged);
    socket.on("SALE_RECORDED", handleSaleRecorded);
    socket.on("ARMADA_HELD", handleArmadaStatusChanged);
    socket.on("ARMADA_CLAIMED", handleArmadaStatusChanged);
    socket.on("ARMADA_RELEASED", handleArmadaStatusChanged);
    socket.on("RIDER_CHECKED_IN", handleRiderStatusChanged);
    socket.on("RIDER_CHECKED_OUT", handleRiderStatusChanged);
    socket.on("RIDER_LBS_UPDATE", handleRiderStatusChanged);
    socket.on("GEOFENCE_BREACH", handleGeofenceAlert);
    socket.on("ZONE_UPDATED", handleZoneChanged);
    socket.on("COMPETITOR_UPDATED", handleCompetitorUpdated);

    return () => {
      socket.off("access:changed", handleAccessChanged);
      socket.off("SALE_RECORDED", handleSaleRecorded);
      socket.off("ARMADA_HELD", handleArmadaStatusChanged);
      socket.off("ARMADA_CLAIMED", handleArmadaStatusChanged);
      socket.off("ARMADA_RELEASED", handleArmadaStatusChanged);
      socket.off("RIDER_CHECKED_IN", handleRiderStatusChanged);
      socket.off("RIDER_CHECKED_OUT", handleRiderStatusChanged);
      socket.off("RIDER_LBS_UPDATE", handleRiderStatusChanged);
      socket.off("GEOFENCE_BREACH", handleGeofenceAlert);
      socket.off("ZONE_UPDATED", handleZoneChanged);
      socket.off("COMPETITOR_UPDATED", handleCompetitorUpdated);
    };
  }, [token, queryClient]);
}

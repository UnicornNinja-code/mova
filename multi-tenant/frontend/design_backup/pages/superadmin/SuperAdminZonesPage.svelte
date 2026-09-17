<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { zoneService, type ZoneItem, type ZoneConfig } from '../../services/zoneService';
  import { mapService, type POIFeature } from '../../services/mapService';
  import { createBasemapLayer, getBasemapProviders } from '../../lib/mapProviders';
  import { confirmModal } from '../../lib/stores/confirmModal.svelte';
  import ZoneFormModal from '../../components/zones/ZoneFormModal.svelte';
  import ZoneDetailDrawer from '../../components/zones/ZoneDetailDrawer.svelte';

  interface Props {
    onNavigate?: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  // State: Zones Data
  let zones = $state<ZoneItem[]>([]);
  let zoneConfig = $state<ZoneConfig | null>(null);
  let selectedZoneId = $state<string | null>(null);
  let loading = $state(true);
  let searchQuery = $state('');
  let statusFilter = $state('ALL');

  // State: Road & POI Spatial Layers
  let protocolRoadsGeoJson = $state<any>(null);
  let tollRoadsGeoJson = $state<any>(null);
  let pois = $state<POIFeature[]>([]);

  // Map & Leaflet State
  let mapElement: HTMLDivElement;
  let mapInstance: any = null;
  let currentTileLayer: any = null;
  let L: any = null;

  let zoneLayersMap: Record<string, any> = {};
  let drawingLayerGroup: any = null;
  let protocolRoadLayerGroup: any = null;
  let tollRoadLayerGroup: any = null;
  let poiLayerGroup: any = null;

  // Layer Toggles
  let selectedBasemapId = $state('openmaptiles-dark');
  let basemapProviders = $derived(getBasemapProviders());
  let showProtocolRoads = $state(true);
  let showTollRoads = $state(true);
  let showPois = $state(true);

  // Drawing & Editing State
  let isDrawingMode = $state(false);
  let drawnPoints = $state<[number, number][]>([]); // [lat, lng]
  let drawingPolygonLayer: any = null;

  // Automated Real-Time Spatial Warnings
  let spatialViolationWarning = $state<string | null>(null);
  let spatialOverlapWarning = $state<string | null>(null);
  let intersectedRoadNames = $state<string[]>([]);

  // Modal & Drawer State
  let showZoneModal = $state(false);
  let showPolygonDrawer = $state(false);
  let isEditing = $state(false);

  // Form Model
  let formId = $state('');
  let formName = $state('');
  let formCode = $state('');
  let formDescription = $state('');
  let formMaxCapacity = $state(5);
  let formStatus = $state<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  let formPolygonCoordinates = $state<[number, number][]>([]);
  let formErrorMessage = $state<string | null>(null);
  let isSubmitting = $state(false);

  // Computed / Derived
  let filteredZones = $derived(
    zones.filter(z => {
      const matchSearch = searchQuery === '' || 
        z.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (z.code && z.code.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus = statusFilter === 'ALL' || z.status === statusFilter;
      return matchSearch && matchStatus;
    })
  );

  let totalCapacity = $derived(zones.reduce((sum, z) => sum + (z.max_capacity || 0), 0));
  let activeZonesCount = $derived(zones.filter(z => z.status === 'ACTIVE').length);
  let selectedZone = $derived(zones.find(z => z.id === selectedZoneId) || null);

  function parsePolygonToLatLngs(polygon: any): [number, number][] {
    if (!polygon) return [];
    try {
      const parsed = typeof polygon === 'string' ? JSON.parse(polygon) : polygon;
      const ring = parsed.coordinates?.[0] || parsed.coordinates || [];
      return ring.map((pt: [number, number]) => [Number(pt[1]), Number(pt[0])]);
    } catch {
      return [];
    }
  }

  // Calculate polygon area in km²
  function calculatePolygonAreaKm2(coords: [number, number][]): number {
    if (coords.length < 3) return 0;
    const radius = 6371; // km
    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      const lat1 = (coords[i][0] * Math.PI) / 180;
      const lat2 = (coords[j][0] * Math.PI) / 180;
      const lng1 = (coords[i][1] * Math.PI) / 180;
      const lng2 = (coords[j][1] * Math.PI) / 180;
      area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    area = Math.abs((area * radius * radius) / 2);
    return Number(area.toFixed(3));
  }

  // Check Overlap with Other Zones and Prohibited Roads
  function checkSpatialViolations(coords: [number, number][]) {
    if (coords.length < 3) {
      spatialViolationWarning = null;
      spatialOverlapWarning = null;
      intersectedRoadNames = [];
      return;
    }

    const minLat = Math.min(...coords.map(c => c[0]));
    const maxLat = Math.max(...coords.map(c => c[0]));
    const minLng = Math.min(...coords.map(c => c[1]));
    const maxLng = Math.max(...coords.map(c => c[1]));

    // 1. Check Prohibited Roads (Toll & Protocol)
    const intersected: string[] = [];
    let hasToll = false;
    let hasProtocol = false;

    if (tollRoadsGeoJson?.features) {
      for (const feat of tollRoadsGeoJson.features) {
        const lineCoords = feat.geometry?.coordinates || [];
        for (const pt of lineCoords) {
          const [lon, lat] = pt;
          if (lat >= minLat && lat <= maxLat && lon >= minLng && lon <= maxLng) {
            hasToll = true;
            const name = feat.properties?.name || 'Jalan Tol';
            if (!intersected.includes(name)) intersected.push(name);
            break;
          }
        }
      }
    }

    if (protocolRoadsGeoJson?.features) {
      for (const feat of protocolRoadsGeoJson.features) {
        const lineCoords = feat.geometry?.coordinates || [];
        for (const pt of lineCoords) {
          const [lon, lat] = pt;
          if (lat >= minLat && lat <= maxLat && lon >= minLng && lon <= maxLng) {
            hasProtocol = true;
            const name = feat.properties?.name || 'Jalan Protokol';
            if (!intersected.includes(name)) intersected.push(name);
            break;
          }
        }
      }
    }

    intersectedRoadNames = intersected;

    if (hasToll && hasProtocol) {
      spatialViolationWarning = `Poligon melintasi Jalan Tol & Jalan Protokol (${intersected.slice(0, 2).join(', ')}). Kopi keliling dilarang beroperasi di koridor ini.`;
    } else if (hasToll) {
      spatialViolationWarning = `Poligon melintasi Area Jalan Tol (${intersected.slice(0, 2).join(', ')}). Kopi keliling dilarang masuk area tol.`;
    } else if (hasProtocol) {
      spatialViolationWarning = `Poligon melintasi Jalan Protokol Utama (${intersected.slice(0, 2).join(', ')}).`;
    } else {
      spatialViolationWarning = null;
    }

    // 2. Check Overlap with Existing Other Zones
    const overlappingNames: string[] = [];
    zones.forEach(other => {
      if (isEditing && other.id === formId) return;
      if (other.id === selectedZoneId && !isDrawingMode) return;

      const otherCoords = parsePolygonToLatLngs(other.polygon);
      if (otherCoords.length >= 3) {
        const oMinLat = Math.min(...otherCoords.map(c => c[0]));
        const oMaxLat = Math.max(...otherCoords.map(c => c[0]));
        const oMinLng = Math.min(...otherCoords.map(c => c[1]));
        const oMaxLng = Math.max(...otherCoords.map(c => c[1]));

        // Bounding box intersection test
        const overlapLat = minLat <= oMaxLat && maxLat >= oMinLat;
        const overlapLng = minLng <= oMaxLng && maxLng >= oMinLng;

        if (overlapLat && overlapLng) {
          overlappingNames.push(other.name);
        }
      }
    });

    if (overlappingNames.length > 0) {
      spatialOverlapWarning = `Terdeteksi tumpang-tindih (overlap) spasial dengan zona: ${overlappingNames.join(', ')}. Pastikan batas zona tidak saling menumpuk.`;
    } else {
      spatialOverlapWarning = null;
    }
  }

  const loadData = async () => {
    loading = true;
    try {
      const [zonesData, configData, protoRoads, tollRoads, poisData] = await Promise.allSettled([
        zoneService.getAllZones(),
        zoneService.getZoneConfig(),
        mapService.getProtocolRoads(),
        mapService.getTollRoads(),
        mapService.getPOIs(),
      ]);

      if (zonesData.status === 'fulfilled' && zonesData.value) zones = zonesData.value;
      if (configData.status === 'fulfilled' && configData.value) zoneConfig = configData.value;
      if (protoRoads.status === 'fulfilled' && protoRoads.value) protocolRoadsGeoJson = protoRoads.value;
      if (tollRoads.status === 'fulfilled' && tollRoads.value) tollRoadsGeoJson = tollRoads.value;
      if (poisData.status === 'fulfilled' && poisData.value) pois = poisData.value;

      renderAllMapLayers();
    } catch (err) {
      console.error('💥 Gagal memuat data zona:', err);
    } finally {
      loading = false;
    }
  };

  const switchBasemap = (providerId: string) => {
    if (!mapInstance || !L) return;
    selectedBasemapId = providerId;
    if (currentTileLayer) mapInstance.removeLayer(currentTileLayer);
    const { layer } = createBasemapLayer(L, providerId);
    currentTileLayer = layer;
    currentTileLayer.addTo(mapInstance);
    currentTileLayer.bringToBack();
  };

  const initMap = async () => {
    if (typeof window === 'undefined' || !mapElement) return;
    L = (await import('leaflet')).default;

    mapInstance = L.map(mapElement, {
      zoomControl: false,
      attributionControl: false,
    }).setView([-7.4450, 112.7150], 13);

    const { layer } = createBasemapLayer(L, selectedBasemapId);
    currentTileLayer = layer;
    currentTileLayer.addTo(mapInstance);

    protocolRoadLayerGroup = L.layerGroup().addTo(mapInstance);
    tollRoadLayerGroup = L.layerGroup().addTo(mapInstance);
    poiLayerGroup = L.layerGroup().addTo(mapInstance);
    drawingLayerGroup = L.layerGroup().addTo(mapInstance);

    // Map Click Listener for Drawing Mode
    mapInstance.on('click', (e: any) => {
      if (!isDrawingMode) return;
      const { lat, lng } = e.latlng;
      addDrawnPoint(lat, lng);
    });

    await loadData();
  };

  const renderAllMapLayers = () => {
    if (!mapInstance || !L) return;

    // 1. Protocol Roads
    protocolRoadLayerGroup.clearLayers();
    if (showProtocolRoads && protocolRoadsGeoJson) {
      L.geoJSON(protocolRoadsGeoJson, {
        style: {
          color: '#F59E0B',
          weight: 3,
          dashArray: '5, 5',
          opacity: 0.85,
        },
        onEachFeature: (feature: any, layer: any) => {
          const name = feature.properties?.name || 'Jalan Protokol';
          layer.bindPopup(`
            <div style="font-family: Outfit, sans-serif;">
              <span style="background: #FEF3C7; color: #D97706; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">JALAN PROTOKOL (TERLARANG)</span>
              <div style="font-weight: 700; font-size: 12px; margin-top: 4px; color: #18181B;">${name}</div>
            </div>
          `);
        },
      }).addTo(protocolRoadLayerGroup);
    }

    // 2. Toll Roads
    tollRoadLayerGroup.clearLayers();
    if (showTollRoads && tollRoadsGeoJson) {
      L.geoJSON(tollRoadsGeoJson, {
        style: {
          color: '#EF4444',
          weight: 4.5,
          opacity: 0.9,
        },
        onEachFeature: (feature: any, layer: any) => {
          const name = feature.properties?.name || 'Jalan Tol';
          layer.bindPopup(`
            <div style="font-family: Outfit, sans-serif;">
              <span style="background: #FEE2E2; color: #DC2626; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">JALAN TOL (AREA MERAH)</span>
              <div style="font-weight: 700; font-size: 12px; margin-top: 4px; color: #18181B;">${name}</div>
            </div>
          `);
        },
      }).addTo(tollRoadLayerGroup);
    }

    // 3. POIs
    poiLayerGroup.clearLayers();
    if (showPois && pois.length > 0) {
      pois.slice(0, 100).forEach(p => {
        const icon = L.divIcon({
          html: '<div style="background: #8B5CF6; width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid white;"></div>',
          className: 'poi-marker',
          iconSize: [7, 7],
          iconAnchor: [3.5, 3.5],
        });
        L.marker([p.latitude, p.longitude], { icon })
          .bindPopup(`<strong style="font-family: Outfit; color: #18181B;">${p.name}</strong><br><span style="font-size: 10px; color: #71717A;">${p.category}</span>`)
          .addTo(poiLayerGroup);
      });
    }

    // 4. Zones
    Object.values(zoneLayersMap).forEach((l: any) => mapInstance.removeLayer(l));
    zoneLayersMap = {};

    zones.forEach(z => {
      const latLngs = parsePolygonToLatLngs(z.polygon);
      if (latLngs.length > 0) {
        const isSelected = selectedZoneId === z.id;
        const isActive = z.status === 'ACTIVE';
        const layer = L.polygon(latLngs, {
          color: isSelected ? '#3B82F6' : isActive ? '#FF634A' : '#71717A',
          fillColor: isSelected ? '#3B82F6' : isActive ? '#FF634A' : '#71717A',
          fillOpacity: isSelected ? 0.45 : isActive ? 0.25 : 0.1,
          weight: isSelected ? 3.5 : 2.5,
        }).addTo(mapInstance);

        layer.on('click', () => {
          selectZone(z.id);
        });

        layer.bindPopup(`
          <div style="font-family: Outfit, sans-serif; min-width: 170px;">
            <div style="font-weight: 700; color: #FF634A; font-size: 13px;">${z.name}</div>
            <div style="font-size: 10px; color: #71717A; margin-bottom: 4px;">Kode: ${z.code || '-'}</div>
            <div style="display: flex; justify-content: space-between; font-size: 11px;">
              <span>Kapasitas:</span>
              <strong>${z.current_riders || 0} / ${z.max_capacity} Unit</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 2px;">
              <span>Status:</span>
              <strong style="color: ${isActive ? '#10B981' : '#EF4444'};">${z.status}</strong>
            </div>
          </div>
        `);

        zoneLayersMap[z.id] = layer;
      }
    });
  };

  const selectZone = (id: string) => {
    selectedZoneId = id;
    renderAllMapLayers();
    const z = zones.find(item => item.id === id);
    if (z && mapInstance) {
      const coords = parsePolygonToLatLngs(z.polygon);
      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        checkSpatialViolations(coords);
      }
    }
  };

  // Unified User Flow: "+ Tambah Poligon Zona"
  const startDrawingNewZone = () => {
    isDrawingMode = true;
    selectedZoneId = null;
    drawnPoints = [];
    spatialViolationWarning = null;
    spatialOverlapWarning = null;
    drawingLayerGroup?.clearLayers();
    renderAllMapLayers();
  };

  const cancelDrawingNewZone = () => {
    isDrawingMode = false;
    drawnPoints = [];
    spatialViolationWarning = null;
    spatialOverlapWarning = null;
    drawingLayerGroup?.clearLayers();
  };

  const addDrawnPoint = (lat: number, lng: number) => {
    drawnPoints = [...drawnPoints, [lat, lng]];
    updateDrawingVisualization();
    checkSpatialViolations(drawnPoints);
  };

  const removeDrawnPoint = (idx: number) => {
    drawnPoints = drawnPoints.filter((_, i) => i !== idx);
    updateDrawingVisualization();
    checkSpatialViolations(drawnPoints);
  };

  const updateDrawingVisualization = () => {
    if (!drawingLayerGroup || !L) return;
    drawingLayerGroup.clearLayers();

    drawnPoints.forEach((pt, idx) => {
      const marker = L.circleMarker(pt, {
        radius: 6,
        color: '#FFFFFF',
        fillColor: '#FF634A',
        fillOpacity: 1,
        weight: 2,
      }).addTo(drawingLayerGroup);

      marker.bindTooltip(`P${idx + 1}`, { permanent: true, direction: 'top', className: 'vertex-tooltip' });
    });

    if (drawnPoints.length >= 3) {
      L.polygon(drawnPoints, {
        color: '#FF634A',
        fillColor: '#FF634A',
        fillOpacity: 0.3,
        dashArray: '4, 4',
        weight: 2.5,
      }).addTo(drawingLayerGroup);
    } else if (drawnPoints.length === 2) {
      L.polyline(drawnPoints, {
        color: '#FF634A',
        weight: 2.5,
        dashArray: '4, 4',
      }).addTo(drawingLayerGroup);
    }
  };

  const proceedToSaveNewZone = () => {
    isEditing = false;
    formId = '';
    formName = '';
    formCode = `SDR-${String(zones.length + 1).padStart(2, '0')}`;
    formDescription = '';
    formMaxCapacity = 5;
    formStatus = 'ACTIVE';
    formPolygonCoordinates = [...drawnPoints];
    formErrorMessage = null;
    showZoneModal = true;
  };

  const openEditModal = (z: ZoneItem) => {
    isEditing = true;
    formId = z.id;
    formName = z.name;
    formCode = z.code || '';
    formDescription = z.description || '';
    formMaxCapacity = z.max_capacity;
    formStatus = (z.status as any) || 'ACTIVE';
    formPolygonCoordinates = parsePolygonToLatLngs(z.polygon);
    formErrorMessage = null;
    showZoneModal = true;
  };

  const openPolygonDrawerForZone = (z: ZoneItem) => {
    selectedZoneId = z.id;
    drawnPoints = parsePolygonToLatLngs(z.polygon);
    updateDrawingVisualization();
    checkSpatialViolations(drawnPoints);
    showPolygonDrawer = true;
  };

  const handleSaveZone = async (e?: Event) => {
    if (e) e.preventDefault();
    if (!formName.trim()) {
      formErrorMessage = 'Nama zona wajib diisi.';
      return;
    }

    if (formPolygonCoordinates.length < 3) {
      formErrorMessage = 'Poligon geofence wajib memiliki minimal 3 titik koordinat.';
      return;
    }

    const geoJsonRing = formPolygonCoordinates.map(pt => [pt[1], pt[0]]);
    if (geoJsonRing[0][0] !== geoJsonRing[geoJsonRing.length - 1][0] || 
        geoJsonRing[0][1] !== geoJsonRing[geoJsonRing.length - 1][1]) {
      geoJsonRing.push([...geoJsonRing[0]]);
    }

    const polygonPayload = {
      type: 'Polygon',
      coordinates: [geoJsonRing],
    };

    const isConfirmed = await confirmModal.verify({
      context: 'ZONE_CREATE_UPDATE',
      title: isEditing ? 'Simpan Perubahan Zona Wilayah' : 'Konfirmasi Pembuatan Zona Operasional',
      subtitle: `Memproses geofence untuk "${formName}" dengan kuota kapasitas ${formMaxCapacity} rider.`,
      targetName: `${formName} (${formCode || 'Zona'})`,
      confirmLabel: isEditing ? 'Simpan Perubahan' : 'Terbitkan Zona Baru',
    });

    if (!isConfirmed) return;

    isSubmitting = true;
    formErrorMessage = null;

    try {
      if (isEditing) {
        await zoneService.updateZone(formId, {
          name: formName,
          description: formDescription,
          max_capacity: formMaxCapacity,
          status: formStatus,
          polygon: polygonPayload,
        });
      } else {
        await zoneService.createZone({
          name: formName,
          description: formDescription,
          max_capacity: formMaxCapacity,
          status: formStatus,
          polygon: polygonPayload,
        });
      }

      showZoneModal = false;
      isDrawingMode = false;
      drawnPoints = [];
      await loadData();
    } catch (err: any) {
      formErrorMessage = err.response?.data?.msg || err.message || 'Gagal menyimpan data zona.';
    } finally {
      isSubmitting = false;
    }
  };

  const handleToggleStatus = async (z: ZoneItem) => {
    const nextStatus = z.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    await confirmModal.verify({
      context: 'ZONE_TOGGLE_STATUS',
      title: nextStatus === 'ACTIVE' ? 'Aktifkan Zona Operasional' : 'Nonaktifkan Zona Operasional',
      subtitle: nextStatus === 'ACTIVE'
        ? `Aktifkan kembali zona "${z.name}" agar dapat dialokasikan pada plotting shift rute rider.`
        : `Nonaktifkan zona "${z.name}". Zona ini tidak akan dimasukkan dalam simulasi auto-plotting dan pemeringkatan TOPSIS.`,
      targetName: `${z.name} (${z.code || 'ZONE'})`,
      severity: nextStatus === 'ACTIVE' ? 'info' : 'warning',
      confirmLabel: nextStatus === 'ACTIVE' ? 'Aktifkan Zona' : 'Nonaktifkan Zona',
      verificationLabel: nextStatus === 'ACTIVE'
        ? `Saya mengonfirmasi pengaktifan kembali zona "${z.name}".`
        : `Saya memahami bahwa zona "${z.name}" tidak akan menerima plotting rider baru.`,
      onConfirm: async () => {
        await zoneService.updateZoneStatus(z.id, nextStatus);
        await loadData();
      },
    });
  };

  const handleDeleteZone = async (z: ZoneItem) => {
    await confirmModal.verify({
      context: 'ZONE_DELETE',
      targetName: `${z.name} (${z.code || 'ZONE'})`,
      subtitle: `Apakah Anda yakin ingin menghapus permanen zona "${z.name}"? Batas poligon spasial dan riwayat plotting pada zona ini akan terhapus.`,
      onConfirm: async () => {
        await zoneService.deleteZone(z.id);
        if (selectedZoneId === z.id) selectedZoneId = null;
        await loadData();
      },
    });
  };

  const applyDrawerPolygon = async () => {
    if (drawnPoints.length < 3) {
      alert('Poligon minimal memiliki 3 titik koordinat.');
      return;
    }

    if (!selectedZoneId) return;

    const geoJsonRing = drawnPoints.map(pt => [pt[1], pt[0]]);
    if (geoJsonRing[0][0] !== geoJsonRing[geoJsonRing.length - 1][0] || 
        geoJsonRing[0][1] !== geoJsonRing[geoJsonRing.length - 1][1]) {
      geoJsonRing.push([...geoJsonRing[0]]);
    }

    const polygonPayload = {
      type: 'Polygon',
      coordinates: [geoJsonRing],
    };

    try {
      const current = zones.find(z => z.id === selectedZoneId);
      if (!current) return;

      await zoneService.updateZone(selectedZoneId, {
        name: current.name,
        description: current.description,
        max_capacity: current.max_capacity,
        status: (current.status as any) || 'ACTIVE',
        polygon: polygonPayload,
      });

      showPolygonDrawer = false;
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.msg || 'Gagal memperbarui poligon geofence.');
    }
  };

  onMount(() => {
    initMap();
  });

  onDestroy(() => {
    if (mapInstance) mapInstance.remove();
  });
</script>

<div class="h-full flex flex-col space-y-4 p-4 sm:p-6 bg-[#09090B] text-white font-outfit-400 select-none overflow-y-auto">
  <!-- HEADER & TOOLBAR -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#24242A]">
    <div>
      <div class="flex items-center gap-2">
        <h2 class="text-xl sm:text-2xl font-outfit-600 text-white tracking-tight">Manajemen Zona & Geofence</h2>
        <span class="px-2.5 py-0.5 rounded-full bg-[#FF634A]/10 text-[#FF634A] text-xs font-outfit-600 border border-[#FF634A]/30">
          {zones.length} Wilayah
        </span>
      </div>
      <p class="text-xs text-[#A1A1AA] mt-0.5">
        Pengaturan batas wilayah operasional, kapasitas armada gerobak, dan proteksi jalur terlarang.
      </p>
    </div>

    <!-- Actions (Clear Unified Flow) -->
    <div class="flex items-center gap-2">
      {#if isDrawingMode}
        <button
          onclick={cancelDrawingNewZone}
          class="pill-btn-dark text-xs"
        >
          <span class="px-3.5 py-1.5 font-outfit-600 text-rose-400 flex items-center gap-1.5">
            <i class="ri-close-line text-base"></i>
            <span>Batalkan Pembuatan</span>
          </span>
        </button>
        <button
          onclick={proceedToSaveNewZone}
          class="pill-btn-orange text-xs cursor-pointer"
          disabled={drawnPoints.length < 3}
        >
          <span class="px-3.5 py-1.5 flex items-center gap-1.5 font-outfit-600 text-white">
            <i class="ri-check-line text-sm"></i>
            <span>Simpan & Atur Atribut ({drawnPoints.length} Titik)</span>
          </span>
        </button>
      {:else}
        <button
          onclick={startDrawingNewZone}
          class="pill-btn-orange text-xs cursor-pointer"
        >
          <span class="px-3.5 py-1.5 flex items-center gap-1.5 font-outfit-600 text-white">
            <i class="ri-shape-line text-base"></i>
            <span>+ Tambah Poligon Zona</span>
          </span>
        </button>
      {/if}
    </div>
  </div>

  <!-- SPATIAL VIOLATION & OVERLAP WARNING BANNERS -->
  {#if spatialViolationWarning}
    <div class="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-start gap-2.5 shadow-lg font-outfit-400">
      <i class="ri-alert-fill text-amber-400 text-lg shrink-0 mt-0.5"></i>
      <div class="flex-1">
        <div class="font-outfit-600 text-amber-300 text-sm">Peringatan Area Terlarang Spasial:</div>
        <div class="mt-0.5 text-amber-200/90">{spatialViolationWarning}</div>
      </div>
      <button 
        type="button"
        onclick={() => spatialViolationWarning = null} 
        class="text-amber-400 hover:text-white cursor-pointer"
        aria-label="Tutup Peringatan Spasial"
      >
        <i class="ri-close-line text-lg"></i>
      </button>
    </div>
  {/if}

  {#if spatialOverlapWarning}
    <div class="p-3 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2.5 shadow-lg font-outfit-400">
      <i class="ri-error-warning-fill text-rose-400 text-lg shrink-0 mt-0.5"></i>
      <div class="flex-1">
        <div class="font-outfit-600 text-rose-300 text-sm">Peringatan Tumpang-Tindih (Overlap) Zona:</div>
        <div class="mt-0.5 text-rose-200/90">{spatialOverlapWarning}</div>
      </div>
      <button 
        type="button"
        onclick={() => spatialOverlapWarning = null} 
        class="text-rose-400 hover:text-white cursor-pointer"
        aria-label="Tutup Peringatan Overlap"
      >
        <i class="ri-close-line text-lg"></i>
      </button>
    </div>
  {/if}

  <!-- MAIN SPLIT VIEW (Table 45% + Map 55%) -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[560px]">
    <!-- LEFT PANEL: ZONE LIST TABLE (5 Cols / 42%) -->
    <div class="lg:col-span-5 flex flex-col space-y-3">
      <!-- Search & Filter Controls -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A] text-sm"></i>
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Cari nama zona atau kode..."
            class="w-full pl-8 pr-3 py-1.5 text-xs bg-[#131316] border border-[#24242A] rounded-xl focus:outline-none focus:border-[#FF634A] text-white placeholder:text-[#71717A]"
          />
        </div>

        <select
          bind:value={statusFilter}
          class="px-2.5 py-1.5 text-xs bg-[#131316] border border-[#24242A] rounded-xl text-white font-outfit-600 focus:outline-none focus:border-[#FF634A]"
        >
          <option value="ALL">Semua Status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="INACTIVE">Nonaktif</option>
        </select>
      </div>

      <!-- Zone Table / Card List -->
      <div class="card-dark p-3 flex-1 flex flex-col overflow-hidden">
        <div class="text-[11px] font-outfit-600 text-[#71717A] uppercase tracking-wider pb-2 border-b border-[#24242A] flex items-center justify-between">
          <span>Daftar Zona ({filteredZones.length})</span>
          <span>{activeZonesCount} Aktif • {totalCapacity} Kapasitas</span>
        </div>

        <div class="flex-1 overflow-y-auto divide-y divide-[#1F1F24] pr-1 mt-1 space-y-1">
          {#if loading}
            <div class="p-8 text-center text-xs text-[#71717A] animate-pulse">Memuat data zona...</div>
          {:else if filteredZones.length === 0}
            <div class="p-8 text-center text-xs text-[#71717A]">Tidak ada zona yang sesuai kriteria pencarian.</div>
          {:else}
            {#each filteredZones as z}
              {@const isSelected = selectedZoneId === z.id}
              {@const isActive = z.status === 'ACTIVE'}
              {@const coords = parsePolygonToLatLngs(z.polygon)}
              {@const areaKm2 = calculatePolygonAreaKm2(coords)}
              <div 
                role="button"
                tabindex="0"
                onclick={() => selectZone(z.id)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectZone(z.id); }}
                class="p-2.5 rounded-xl transition-all cursor-pointer flex flex-col gap-1.5 text-left
                {isSelected ? 'bg-[#1F1F26] border border-blue-500/50 shadow-md' : 'hover:bg-[#18181D]'}"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full {isActive ? 'bg-emerald-400' : 'bg-zinc-600'}"></span>
                    <span class="font-outfit-600 text-sm text-white">{z.name}</span>
                    {#if z.code}
                      <span class="px-1.5 py-0.2 rounded bg-[#24242A] text-[#A1A1AA] text-[10px] font-mono font-bold">
                        {z.code}
                      </span>
                    {/if}
                  </div>

                  <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600 {isActive ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : 'bg-zinc-800 text-zinc-400'}">
                    {z.status}
                  </span>
                </div>

                <div class="flex items-center justify-between text-[11px] text-[#A1A1AA]">
                  <span>Kapasitas: <strong class="text-white font-outfit-600">{z.current_riders || 0} / {z.max_capacity} Unit</strong></span>
                  <span>Luas: <strong class="text-white font-outfit-600">{areaKm2} km²</strong> ({coords.length} Titik)</span>
                </div>

                <!-- Quick Action Buttons -->
                <div class="flex items-center justify-end gap-1 pt-1 border-t border-[#24242A]/50">
                  <button
                    onclick={(e) => { e.stopPropagation(); openPolygonDrawerForZone(z); }}
                    class="px-2 py-1 rounded-lg text-[10px] font-outfit-600 text-[#A1A1AA] hover:text-white hover:bg-[#24242A] flex items-center gap-1 transition-colors"
                  >
                    <i class="ri-shape-line"></i>
                    <span>Poligon</span>
                  </button>
                  <button
                    onclick={(e) => { e.stopPropagation(); openEditModal(z); }}
                    class="px-2 py-1 rounded-lg text-[10px] font-outfit-600 text-[#A1A1AA] hover:text-white hover:bg-[#24242A] flex items-center gap-1 transition-colors"
                  >
                    <i class="ri-edit-line"></i>
                    <span>Atribut</span>
                  </button>
                  <button
                    onclick={(e) => { e.stopPropagation(); handleToggleStatus(z); }}
                    class="px-2 py-1 rounded-lg text-[10px] font-outfit-600 {isActive ? 'text-amber-400 hover:bg-amber-950/30' : 'text-emerald-400 hover:bg-emerald-950/30'} flex items-center gap-1 transition-colors"
                  >
                    <i class="{isActive ? 'ri-pause-circle-line' : 'ri-play-circle-line'}"></i>
                    <span>{isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                  </button>
                  <button
                    onclick={(e) => { e.stopPropagation(); handleDeleteZone(z); }}
                    class="px-1.5 py-1 rounded-lg text-[10px] font-outfit-600 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
                    title="Hapus Zona"
                  >
                    <i class="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <!-- RIGHT PANEL: INTERACTIVE GEOFENCE MAP (7 Cols / 58%) -->
    <div class="lg:col-span-7 card-dark p-0 overflow-hidden relative flex flex-col min-h-[480px]">
      <!-- Map Container -->
      <div bind:this={mapElement} class="w-full h-full flex-1 z-0"></div>

      <!-- Top-Right Floating Controls (Basemap & Layer Switchers) -->
      <div class="absolute top-3 right-3 z-20 bg-[#131316]/95 backdrop-blur-md p-3 rounded-2xl border border-[#2E2E38] shadow-2xl text-xs space-y-2.5 w-64 text-white">
        <div class="text-[10px] font-outfit-600 uppercase tracking-wider text-[#71717A] flex items-center justify-between">
          <span>Layer Spasial PostGIS</span>
          <i class="ri-layers-line text-sm text-[#FF634A]"></i>
        </div>

        <div class="space-y-1.5 text-[11px] font-outfit-600">
          <label class="flex items-center justify-between cursor-pointer hover:text-white text-[#A1A1AA]">
            <span class="flex items-center gap-1.5">
              <input type="checkbox" bind:checked={showProtocolRoads} onchange={renderAllMapLayers} class="accent-[#F59E0B] rounded cursor-pointer" />
              <span class="text-amber-400">Jalan Protokol ({protocolRoadsGeoJson?.features ? protocolRoadsGeoJson.features.length : 0})</span>
            </span>
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          </label>

          <label class="flex items-center justify-between cursor-pointer hover:text-white text-[#A1A1AA]">
            <span class="flex items-center gap-1.5">
              <input type="checkbox" bind:checked={showTollRoads} onchange={renderAllMapLayers} class="accent-[#EF4444] rounded cursor-pointer" />
              <span class="text-rose-400">Jalan Tol ({tollRoadsGeoJson?.features ? tollRoadsGeoJson.features.length : 0})</span>
            </span>
            <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          </label>

          <label class="flex items-center justify-between cursor-pointer hover:text-white text-[#A1A1AA]">
            <span class="flex items-center gap-1.5">
              <input type="checkbox" bind:checked={showPois} onchange={renderAllMapLayers} class="accent-purple-500 rounded cursor-pointer" />
              <span>Titik POI Overpass</span>
            </span>
            <span class="w-2 h-2 rounded-full bg-purple-400"></span>
          </label>
        </div>

        <div class="pt-1.5 border-t border-[#24242A]">
          <select
            value={selectedBasemapId}
            onchange={(e) => switchBasemap((e.target as HTMLSelectElement).value)}
            class="w-full px-2 py-1 text-[11px] bg-[#1F1F24] border border-[#2E2E38] rounded-lg font-outfit-600 text-white focus:outline-none cursor-pointer"
          >
            {#each basemapProviders as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Bottom Map Status Overlay -->
      <div class="absolute bottom-3 left-3 right-3 z-20 bg-[#131316]/95 backdrop-blur-md p-2.5 px-4 rounded-2xl border border-[#2E2E38] shadow-xl flex flex-wrap items-center justify-between gap-2 text-xs text-[#A1A1AA]">
        <div class="flex items-center gap-2">
          {#if isDrawingMode}
            <span class="w-2 h-2 rounded-full bg-[#FF634A] animate-pulse"></span>
            <span class="text-white font-outfit-600">Mode Gambar Aktif: Klik pada peta untuk menambah titik sudut ({drawnPoints.length} Titik)</span>
          {:else if selectedZone}
            <span class="text-white font-outfit-600">Zona Terpilih: {selectedZone.name} ({selectedZone.code || '-'})</span>
          {:else}
            <span>Pilih zona pada daftar atau klik tombol "+ Tambah Poligon Zona".</span>
          {/if}
        </div>

        {#if isDrawingMode}
          <div class="flex items-center gap-2">
            <button
              onclick={() => { drawnPoints = []; updateDrawingVisualization(); }}
              class="px-2 py-0.5 rounded-lg bg-[#24242A] text-xs text-[#A1A1AA] hover:text-white cursor-pointer font-outfit-600"
            >
              Reset Titik
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- MODAL: ATRIBUT ZONA FORM -->
  <ZoneFormModal
    show={showZoneModal}
    {isEditing}
    {formName}
    {formCode}
    {formMaxCapacity}
    {formDescription}
    {formStatus}
    {formErrorMessage}
    {isSubmitting}
    onClose={() => showZoneModal = false}
    onSubmit={handleSaveZone}
    onUpdateName={(val) => formName = val}
    onUpdateCode={(val) => formCode = val}
    onUpdateMaxCapacity={(val) => formMaxCapacity = val}
    onUpdateDescription={(val) => formDescription = val}
    onUpdateStatus={(val) => formStatus = val}
  />

  <!-- DRAWER: EDITOR POLIGON VERTEX GEOFENCE -->
  <ZoneDetailDrawer
    show={showPolygonDrawer}
    {selectedZone}
    {drawnPoints}
    {spatialViolationWarning}
    {spatialOverlapWarning}
    calculateAreaKm2={calculatePolygonAreaKm2}
    onClose={() => showPolygonDrawer = false}
    onRemovePoint={removeDrawnPoint}
    onResetPoints={() => {
      drawnPoints = parsePolygonToLatLngs(selectedZone?.polygon);
      updateDrawingVisualization();
    }}
    onApplyPolygon={applyDrawerPolygon}
  />
</div>

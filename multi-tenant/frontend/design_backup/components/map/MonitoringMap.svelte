<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    Search, 
    Layers, 
    Maximize2, 
    Plus, 
    Minus, 
    RefreshCw,
    X,
    ArrowRight,
    Compass,
    Cloud,
    Sun,
    CloudRain,
    Wind,
    Droplets,
    Battery,
    Navigation,
    ShieldAlert,
    ShieldCheck,
    MapPin,
    Radio,
    Sparkles,
    Check,
    ArrowLeft,
    Layers3
  } from 'lucide-svelte';
  import { 
    mapService, 
    type NearbyRider, 
    type ZoneFeature, 
    type POIFeature,
    type HubWeatherOverview,
    type GeocodeResult
  } from '../../services/mapService';
  import { 
    createBasemapLayer, 
    getBasemapProviders 
  } from '../../lib/mapProviders';
  import { getSocket } from '../../lib/socket';
  import RiderDetailDrawer from './RiderDetailDrawer.svelte';
  import BroadcastAlertModal from './BroadcastAlertModal.svelte';
  import MapTimeSlotBar from './panels/MapTimeSlotBar.svelte';
  import MapFloatingToolbar from './panels/MapFloatingToolbar.svelte';
  import MapSearchPanel from './panels/MapSearchPanel.svelte';
  import MapLayersPanel from './panels/MapLayersPanel.svelte';
  import MapRidersPanel from './panels/MapRidersPanel.svelte';
  import MapWeatherPanel from './panels/MapWeatherPanel.svelte';
  import MapLegendPanel from './panels/MapLegendPanel.svelte';
  import MapBasemapPanel from './panels/MapBasemapPanel.svelte';

  interface Props {
    onNavigate?: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let mapElement: HTMLDivElement;
  let mapInstance: any = null;
  let currentTileLayer: any = null;
  let L: any = null;

  // Layer Group References
  let riderLayerGroup: any = null;
  let zoneLayerGroup: any = null;
  let hubLayerGroup: any = null;
  let protocolRoadLayerGroup: any = null;
  let tollRoadLayerGroup: any = null;
  let poiLayerGroup: any = null;
  let searchPinLayerGroup: any = null;

  // State: Basemap Selection
  let selectedBasemapId = $state('openmaptiles-dark');
  let basemapProviders = $derived(getBasemapProviders());

  // State: Layers Checkboxes
  let layerRiders = $state(true);
  let layerZones = $state(true);
  let layerHub = $state(true);
  let layerProtocolRoads = $state(true);
  let layerTollRoads = $state(true);
  let layerPoi = $state(true);
  let zoneConfig = $state<any>(null);

  // Tabbed Vertical Panel State: Only 1 panel is active at a time (mutually exclusive)
  type ActivePanelType = 'search' | 'layers' | 'riders' | 'weather' | 'legend' | 'basemap' | null;
  let activePanel = $state<ActivePanelType>(null);

  const togglePanel = (panel: ActivePanelType) => {
    if (activePanel === panel) {
      activePanel = null;
    } else {
      activePanel = panel;
    }
  };

  // Filter Mode: All vs Only Currently Crowded POIs vs Category Filter
  let poiFilterCategory = $state<'ALL' | 'PEAK_ONLY' | 'EDUKASI' | 'KANTOR' | 'PASAR' | 'KULINER' | 'TRANSIT' | 'KESEHATAN' | 'IBADAH'>('ALL');

  // Time Slot Selection (Defaults to actual current time, but admin can preview other slots)
  const getAutoSlotKey = (): 'pagi' | 'siang' | 'sore' | 'malam' => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) return 'pagi';
    if (hour >= 11 && hour < 15) return 'siang';
    if (hour >= 15 && hour < 19) return 'sore';
    return 'malam';
  };

  let selectedTimeSlotKey = $state<'pagi' | 'siang' | 'sore' | 'malam'>(getAutoSlotKey());

  const timeSlotDefinitions: Record<'pagi' | 'siang' | 'sore' | 'malam', { name: string; timeRange: string; icon: string; desc: string }> = {
    pagi: { name: 'PAGI', timeRange: '06:00 - 10:59', icon: 'ri-sun-cloudy-line', desc: 'Jam masuk sekolah, kantor, & pasar' },
    siang: { name: 'SIANG', timeRange: '11:00 - 14:59', icon: 'ri-sun-fill', desc: 'Istirahat makan siang & pulang sekolah' },
    sore: { name: 'SORE', timeRange: '15:00 - 18:59', icon: 'ri-sunset-line', desc: 'Rush hour pulang kerja & GOR Delta' },
    malam: { name: 'MALAM', timeRange: '19:00 - 23:59', icon: 'ri-moon-clear-line', desc: 'Hangout kuliner malam & alun-alun' },
  };

  let activeTimeSlot = $derived(timeSlotDefinitions[selectedTimeSlotKey]);

  // C3 Crowd Profile Matrix per Category & Time Slot
  interface CategoryCrowdProfile {
    groupKey: 'EDUKASI' | 'KANTOR' | 'PASAR' | 'KULINER' | 'TRANSIT' | 'KESEHATAN' | 'IBADAH' | 'LAINNYA';
    label: string;
    icon: string;
    color: string;
    scores: Record<'pagi' | 'siang' | 'sore' | 'malam', { score: number; level: 'SANGAT_RAMAI' | 'RAMAI' | 'NORMAL' | 'SEPI'; note: string }>;
  }

  const categoryCrowdProfiles: Record<string, CategoryCrowdProfile> = {
    'EDUKASI': {
      groupKey: 'EDUKASI',
      label: 'Sekolah & Perguruan Tinggi',
      icon: 'ri-graduation-cap-line',
      color: '#3B82F6',
      scores: {
        pagi: { score: 0.96, level: 'SANGAT_RAMAI', note: 'Jam masuk sekolah & mahasiswa pagi' },
        siang: { score: 0.85, level: 'RAMAI', note: 'Jam istirahat & pulang sekolah' },
        sore: { score: 0.25, level: 'NORMAL', note: 'Kegiatan ekstrakurikuler' },
        malam: { score: 0.05, level: 'SEPI', note: 'Kampus / sekolah tutup' },
      },
    },
    'KANTOR': {
      groupKey: 'KANTOR',
      label: 'Perkantoran & Layanan Pemkab',
      icon: 'ri-building-line',
      color: '#8B5CF6',
      scores: {
        pagi: { score: 0.94, level: 'SANGAT_RAMAI', note: 'Jam mulai kantor & dinas warga' },
        siang: { score: 0.80, level: 'RAMAI', note: 'Istirahat siang kantor' },
        sore: { score: 0.92, level: 'SANGAT_RAMAI', note: 'Jam bubaran pulang kantor' },
        malam: { score: 0.08, level: 'SEPI', note: 'Kantor tutup' },
      },
    },
    'PASAR': {
      groupKey: 'PASAR',
      label: 'Pasar Tradisional & Supermarket',
      icon: 'ri-store-2-line',
      color: '#F59E0B',
      scores: {
        pagi: { score: 0.95, level: 'SANGAT_RAMAI', note: 'Puncak belanja bahan pagi warga' },
        siang: { score: 0.65, level: 'NORMAL', note: 'Aktivitas toko normal' },
        sore: { score: 0.88, level: 'SANGAT_RAMAI', note: 'Pasar sore & belanja sepulang kerja' },
        malam: { score: 0.45, level: 'NORMAL', note: 'Minimarket & toko malam' },
      },
    },
    'KULINER': {
      groupKey: 'KULINER',
      label: 'Kafe, Kedai Kopi & Kuliner',
      icon: 'ri-cup-line',
      color: '#10B981',
      scores: {
        pagi: { score: 0.45, level: 'NORMAL', note: 'Sarapan kopi pagi' },
        siang: { score: 0.95, level: 'SANGAT_RAMAI', note: 'Puncak jam makan siang' },
        sore: { score: 0.82, level: 'RAMAI', note: 'Ngopi santai sore' },
        malam: { score: 0.98, level: 'SANGAT_RAMAI', note: 'Prime hangout & nongkrong malam' },
      },
    },
    'TRANSIT': {
      groupKey: 'TRANSIT',
      label: 'Stasiun, SPBU & Halte Transit',
      icon: 'ri-gas-station-line',
      color: '#06B6D4',
      scores: {
        pagi: { score: 0.95, level: 'SANGAT_RAMAI', note: 'Rush hour berangkat stasiun & SPBU' },
        siang: { score: 0.70, level: 'NORMAL', note: 'Pengisian bahan bakar & transit' },
        sore: { score: 0.96, level: 'SANGAT_RAMAI', note: 'Rush hour pulang kereta/bus' },
        malam: { score: 0.60, level: 'NORMAL', note: 'Perjalanan antar kota malam' },
      },
    },
    'KESEHATAN': {
      groupKey: 'KESEHATAN',
      label: 'Rumah Sakit, Apotek & Klinik',
      icon: 'ri-hospital-line',
      color: '#EC4899',
      scores: {
        pagi: { score: 0.88, level: 'RAMAI', note: 'Pendaftaran rawat jalan & poliklinik' },
        siang: { score: 0.75, level: 'NORMAL', note: 'Layanan medis siang' },
        sore: { score: 0.80, level: 'RAMAI', note: 'Jam jenguk pasien' },
        malam: { score: 0.40, level: 'NORMAL', note: 'Instalasi Gawat Darurat (IGD)' },
      },
    },
    'IBADAH': {
      groupKey: 'IBADAH',
      label: 'Masjid, Taman & Fasilitas Publik',
      icon: 'ri-community-line',
      color: '#14B8A6',
      scores: {
        pagi: { score: 0.85, level: 'RAMAI', note: 'Sholat Subuh & jogging pagi GOR Delta' },
        siang: { score: 0.88, level: 'RAMAI', note: 'Sholat Dhuhur berjamaah' },
        sore: { score: 0.94, level: 'SANGAT_RAMAI', note: 'Sholat Ashar & rekreasi taman' },
        malam: { score: 0.86, level: 'RAMAI', note: 'Sholat Isya & alun-alun malam' },
      },
    },
  };

  // Helper to categorize raw POI strings from DB
  function mapPoiToGroup(category: string): 'EDUKASI' | 'KANTOR' | 'PASAR' | 'KULINER' | 'TRANSIT' | 'KESEHATAN' | 'IBADAH' | 'LAINNYA' {
    const c = (category || '').toLowerCase();
    if (c.includes('sekolah') || c.includes('perguruan') || c.includes('paud') || c.includes('sd') || c.includes('smp') || c.includes('sma')) return 'EDUKASI';
    if (c.includes('pemerintahan') || c.includes('perkantoran') || c.includes('bank') || c.includes('atm') || c.includes('logistik')) return 'KANTOR';
    if (c.includes('pasar') || c.includes('minimarket') || c.includes('supermarket') || c.includes('mall') || c.includes('retail') || c.includes('toko')) return 'PASAR';
    if (c.includes('kafe') || c.includes('kopi') || c.includes('food') || c.includes('restoran') || c.includes('cepat saji') || c.includes('roti') || c.includes('minuman')) return 'KULINER';
    if (c.includes('spbu') || c.includes('stasiun') || c.includes('halte') || c.includes('transit') || c.includes('parkir') || c.includes('bengkel')) return 'TRANSIT';
    if (c.includes('rumah sakit') || c.includes('apotek') || c.includes('klinik') || c.includes('puskesmas')) return 'KESEHATAN';
    if (c.includes('masjid') || c.includes('mushola') || c.includes('gereja') || c.includes('pura') || c.includes('taman') || c.includes('olahraga') || c.includes('balai') || c.includes('ibadah')) return 'IBADAH';
    return 'PASAR';
  }

  // State: Real Data from Backend
  let realZones = $state<ZoneFeature[]>([]);
  let activeRiders = $state<NearbyRider[]>([]);
  let protocolRoadsGeoJson = $state<any>(null);
  let tollRoadsGeoJson = $state<any>(null);
  let realPois = $state<POIFeature[]>([]);
  let weatherData = $state<HubWeatherOverview | null>(null);

  // Search & Geocoding State
  let searchQuery = $state('');
  let searchResults = $state<Array<{
    type: 'ZONE' | 'ROAD' | 'POI' | 'GEOCODE';
    title: string;
    subtitle: string;
    badge: string;
    color: string;
    lat: number;
    lng: number;
    rawData?: any;
  }>>([]);
  let isSearching = $state(false);
  let activePinnedLocation = $state<{ title: string; lat: number; lng: number } | null>(null);

  // Rider Panel Filtering
  let riderSearchQuery = $state('');
  let filteredRiders = $derived(
    activeRiders.filter(r => {
      if (!riderSearchQuery.trim()) return true;
      const q = riderSearchQuery.toLowerCase();
      return (
        r.name?.toLowerCase().includes(q) ||
        r.plateNumber?.toLowerCase().includes(q) ||
        r.zoneName?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q)
      );
    })
  );

  // Modal / Drawer states
  let selectedRider = $state<NearbyRider | null>(null);
  let drawerOpen = $state(false);
  let broadcastModalOpen = $state(false);
  let loading = $state(true);
  let syncingWeather = $state(false);

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

  const switchBasemap = (providerId: string) => {
    if (!mapInstance || !L) return;
    selectedBasemapId = providerId;

    if (currentTileLayer) {
      mapInstance.removeLayer(currentTileLayer);
    }

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

    // Initialize Layer Groups in correct z-order
    zoneLayerGroup = L.layerGroup().addTo(mapInstance);
    hubLayerGroup = L.layerGroup().addTo(mapInstance);
    protocolRoadLayerGroup = L.layerGroup().addTo(mapInstance);
    tollRoadLayerGroup = L.layerGroup().addTo(mapInstance);
    poiLayerGroup = L.layerGroup().addTo(mapInstance);
    searchPinLayerGroup = L.layerGroup().addTo(mapInstance);
    riderLayerGroup = L.layerGroup().addTo(mapInstance);

    await loadAllSpatialData();
    await fetchWeatherData();
    renderHub();

    // Socket.IO live updates
    const socket = getSocket();
    socket.on('rider:location_updated', (data: any) => {
      if (data && data.riderId) {
        updateRiderPosition(data);
      }
    });
  };

  const renderZones = () => {
    if (!zoneLayerGroup || !L) return;
    zoneLayerGroup.clearLayers();

    if (!layerZones) return;

    realZones.forEach((z) => {
      const latLngs = parsePolygonToLatLngs(z.polygon);
      if (latLngs.length > 0) {
        const isActive = z.status === 'ACTIVE';
        const polygon = L.polygon(latLngs, {
          color: isActive ? '#FF634A' : '#71717A',
          fillColor: isActive ? '#FF634A' : '#71717A',
          fillOpacity: isActive ? 0.22 : 0.1,
          weight: 2.5,
        }).addTo(zoneLayerGroup);

        polygon.bindPopup(`
          <div style="font-family: Outfit, sans-serif; min-width: 170px;">
            <div style="font-weight: 700; color: #FF634A; font-size: 13px; margin-bottom: 2px;">${z.name}</div>
            <div style="font-size: 11px; color: #71717A; margin-bottom: 6px;">Kode: ${z.code || '-'}</div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; border-top: 1px solid #E4E4E7; padding-top: 4px;">
              <span>Kapasitas:</span>
              <strong style="color: #18181B;">${z.current_riders || 0} / ${z.max_capacity} Unit</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 2px;">
              <span>Status:</span>
              <span style="font-weight: 700; color: ${isActive ? '#10B981' : '#EF4444'};">${z.status}</span>
            </div>
          </div>
        `);

        // Centroid Label
        const centerLat = latLngs.reduce((sum, p) => sum + p[0], 0) / latLngs.length;
        const centerLng = latLngs.reduce((sum, p) => sum + p[1], 0) / latLngs.length;

        const labelIcon = L.divIcon({
          html: `
            <div class="px-2.5 py-1 rounded-xl bg-[#131316]/90 backdrop-blur-md border border-[#2E2E38] shadow-lg text-[10px] font-outfit-600 text-white whitespace-nowrap">
              ${z.name}
            </div>
          `,
          className: 'zone-centroid-label',
          iconAnchor: [40, 12],
        });

        L.marker([centerLat, centerLng], { icon: labelIcon }).addTo(zoneLayerGroup);
      }
    });
  };

  const renderHub = () => {
    if (!hubLayerGroup || !L) return;
    hubLayerGroup.clearLayers();

    if (!layerHub || !zoneConfig) return;

    const hubLat = zoneConfig.hub_latitude || -7.397402;
    const hubLng = zoneConfig.hub_longitude || 112.711958;
    const hubName = zoneConfig.hub_city_name || 'Sidoarjo';

    // 1. Buffer Coverage Circle (12km radius operasional)
    L.circle([hubLat, hubLng], {
      radius: 12000,
      color: '#FF634A',
      fillColor: '#FF634A',
      fillOpacity: 0.04,
      weight: 1.5,
      dashArray: '6, 6',
    }).addTo(hubLayerGroup);

    // 2. Radiant Beacon Pin Icon
    const hubIconHtml = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; width: 36px; height: 36px;">
        <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(255, 99, 74, 0.4); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, #FF634A, #FF8573); border: 2.5px solid #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(255, 99, 74, 0.95); z-index: 10;">
          <span style="font-size: 13px; font-weight: bold; color: #09090B;">🏢</span>
        </div>
        <span style="position: absolute; top: -20px; background: #131316; color: #FF634A; font-size: 9px; font-family: Outfit, sans-serif; font-weight: 800; padding: 1px 6px; border-radius: 6px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.5); border: 1px solid #FF634A;">
          HUB ${hubName.toUpperCase()}
        </span>
      </div>
    `;

    const hubIcon = L.divIcon({
      html: hubIconHtml,
      className: 'custom-central-hub-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const w = weatherData?.hub_overview;
    const marker = L.marker([hubLat, hubLng], { icon: hubIcon });
    marker.bindPopup(`
      <div style="font-family: Outfit, sans-serif; min-width: 230px; color: #18181B;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E4E4E7; padding-bottom: 4px; margin-bottom: 6px;">
          <strong style="font-size: 12px; color: #FF634A;">🏢 CENTRAL HUB ${hubName.toUpperCase()}</strong>
          <span style="font-size: 9px; background: #ECFDF5; color: #059669; font-weight: 700; padding: 2px 6px; border-radius: 9999px;">PUSAT</span>
        </div>
        <div style="font-size: 11px; color: #71717A; margin-bottom: 6px;">
          Gudang Utama & Pusat Plotting Gerobak
        </div>
        <div style="background: #F4F4F5; border-radius: 8px; padding: 6px; font-size: 10px; line-height: 1.5; color: #27272A;">
          <div>🌡️ Suhu: <strong>${w?.avg_temperature_c ?? 30.5}°C</strong> (Terasa: <strong>${(w as any)?.apparent_temperature_c ?? 32}°C</strong>)</div>
          <div>💧 Kelembaban: <strong>${(w as any)?.relative_humidity_2m ?? 65}%</strong> | Titik Embun: <strong>${(w as any)?.dew_point_2m ?? 23.4}°C</strong></div>
          <div>🌧️ Peluang Hujan (C4): <strong>${w?.max_rain_probability_percent ?? 0}%</strong> | Curah: <strong>${(w as any)?.precipitation_rain_mm ?? 0} mm</strong></div>
          <div>☁️ Kondisi: <strong>${w?.weather_condition ?? 'Cerah Berawan'}</strong> (WMO ${w?.weather_code ?? 2})</div>
        </div>
        <div style="font-size: 9px; color: #A1A1AA; margin-top: 4px; text-align: right;">
          Koordinat: ${Number(hubLat).toFixed(4)}, ${Number(hubLng).toFixed(4)}
        </div>
      </div>
    `);
    marker.addTo(hubLayerGroup);
  };

  const renderProtocolRoads = () => {
    if (!protocolRoadLayerGroup || !L) return;
    protocolRoadLayerGroup.clearLayers();

    if (!layerProtocolRoads || !protocolRoadsGeoJson) return;

    try {
      L.geoJSON(protocolRoadsGeoJson, {
        style: {
          color: '#F59E0B',
          weight: 3.5,
          dashArray: '6, 6',
          opacity: 0.85,
        },
        onEachFeature: (feature: any, layer: any) => {
          const name = feature.properties?.name || 'Jalan Protokol Utama';
          layer.bindPopup(`
            <div style="font-family: Outfit, sans-serif;">
              <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: #FEF3C7; color: #D97706; font-size: 10px; font-weight: 700;">JALAN PROTOKOL (TERLARANG)</span>
              <div style="font-weight: 700; font-size: 12px; margin-top: 4px; color: #18181B;">${name}</div>
              <div style="font-size: 10px; color: #71717A; margin-top: 2px;">Dilarang berjualan / mangkal kopi keliling di koridor ini.</div>
            </div>
          `);
        },
      }).addTo(protocolRoadLayerGroup);
    } catch (e) {
      console.warn('Gagal render layer jalan protokol:', e);
    }
  };

  const renderTollRoads = () => {
    if (!tollRoadLayerGroup || !L) return;
    tollRoadLayerGroup.clearLayers();

    if (!layerTollRoads || !tollRoadsGeoJson) return;

    try {
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
              <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: #FEE2E2; color: #DC2626; font-size: 10px; font-weight: 700;">JALAN TOL (AREA MERAH)</span>
              <div style="font-weight: 700; font-size: 12px; margin-top: 4px; color: #18181B;">${name}</div>
              <div style="font-size: 10px; color: #71717A; margin-top: 2px;">Jalan tol dilarang total untuk operasional gerobak kopi keliling.</div>
            </div>
          `);
        },
      }).addTo(tollRoadLayerGroup);
    } catch (e) {
      console.warn('Gagal render layer jalan tol:', e);
    }
  };

  const renderPois = () => {
    if (!poiLayerGroup || !L) return;
    poiLayerGroup.clearLayers();

    if (!layerPoi) return;

    const visiblePois = realPois.filter(p => {
      const groupKey = mapPoiToGroup(p.category);
      const profile = categoryCrowdProfiles[groupKey];
      const slotEval = profile ? profile.scores[selectedTimeSlotKey] : { score: 0.5, level: 'NORMAL' };
      const isPeak = slotEval.level === 'SANGAT_RAMAI';

      if (poiFilterCategory === 'PEAK_ONLY' && !isPeak) return false;
      if (poiFilterCategory !== 'ALL' && poiFilterCategory !== 'PEAK_ONLY' && groupKey !== poiFilterCategory) return false;

      return true;
    });

    // Render up to 250 POIs
    visiblePois.slice(0, 250).forEach((poi) => {
      const groupKey = mapPoiToGroup(poi.category);
      const profile = categoryCrowdProfiles[groupKey] || categoryCrowdProfiles['PASAR'];
      const slotEval = profile.scores[selectedTimeSlotKey];
      const isPeak = slotEval.level === 'SANGAT_RAMAI';
      const isRamai = slotEval.level === 'RAMAI';

      let markerHtml = '';
      if (isPeak) {
        markerHtml = `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: ${profile.color}; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="background-color: ${profile.color}; width: 11px; height: 11px; border-radius: 50%; border: 2px solid #FFFFFF; box-shadow: 0 0 10px ${profile.color}; z-index: 2;"></div>
          </div>
        `;
      } else if (isRamai) {
        markerHtml = `
          <div style="display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="background-color: ${profile.color}; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #FFFFFF; box-shadow: 0 0 4px ${profile.color};"></div>
          </div>
        `;
      } else {
        markerHtml = `
          <div style="display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0.65;">
            <div style="background-color: ${profile.color}; width: 6px; height: 6px; border-radius: 50%; border: 1px solid #FFFFFF;"></div>
          </div>
        `;
      }

      const poiIcon = L.divIcon({
        html: markerHtml,
        className: 'poi-c3-dot-marker',
        iconSize: [isPeak ? 22 : 10, isPeak ? 22 : 10],
        iconAnchor: [isPeak ? 11 : 5, isPeak ? 11 : 5],
      });

      L.marker([poi.latitude, poi.longitude], { icon: poiIcon })
        .bindPopup(`
          <div style="font-family: Outfit, sans-serif; min-width: 190px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
              <span style="font-size: 9px; font-weight: 700; color: ${profile.color}; text-transform: uppercase;">${profile.label}</span>
              <span style="font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 4px; background: ${isPeak ? '#DC2626' : isRamai ? '#D97706' : '#71717A'}; color: #FFFFFF;">
                ${isPeak ? '🔥 SANGAT RAMAI' : isRamai ? '⚡ RAMAI' : '☕ NORMAL'}
              </span>
            </div>
            <strong style="font-size: 12px; color: #18181B; display: block; margin-bottom: 2px;">${poi.name}</strong>
            <span style="font-size: 10px; color: #71717A;">Kategori: ${poi.category}</span>
            <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #E4E4E7; font-size: 10px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span>Evaluasi C3 Waktu (${activeTimeSlot.name}):</span>
                <strong style="color: ${profile.color}; font-size: 11px;">Skor ${slotEval.score.toFixed(2)}</strong>
              </div>
              <p style="font-size: 9px; color: #52525B; margin: 0; line-height: 1.3;">${slotEval.note}</p>
            </div>
          </div>
        `)
        .addTo(poiLayerGroup);
    });
  };

  const renderRiders = (riders: NearbyRider[]) => {
    if (!riderLayerGroup || !L) return;
    riderLayerGroup.clearLayers();

    if (!layerRiders) return;

    riders.forEach((r) => {
      const isBreach = r.status === 'BREACH';
      const markerHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background: ${isBreach ? '#EF4444' : '#10B981'}; opacity: 0.25; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="background-color: ${isBreach ? '#EF4444' : '#10B981'}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 2px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 3;">
            <i class="ri-motorbike-line" style="font-size: 12px; color: #FFFFFF;"></i>
          </div>
          <span style="position: absolute; top: -19px; background: #131316; color: #FFFFFF; font-size: 9px; font-family: Outfit, sans-serif; font-weight: 700; padding: 1px 6px; border-radius: 6px; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.35); border: 1px solid #2E2E38;">
            ${r.name ? r.name.split(' ')[0] : 'Rider'}
          </span>
        </div>
      `;

      const riderIcon = L.divIcon({
        html: markerHtml,
        className: 'rider-live-marker',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const marker = L.marker([r.latitude, r.longitude], { icon: riderIcon });
      marker.on('click', () => {
        focusRider(r);
      });
      marker.addTo(riderLayerGroup);
    });
  };

  const updateRiderPosition = (data: NearbyRider) => {
    const idx = activeRiders.findIndex((r) => r.riderId === data.riderId);
    if (idx !== -1) {
      activeRiders[idx] = { ...activeRiders[idx], ...data };
    } else {
      activeRiders = [...activeRiders, data];
    }
    renderRiders(activeRiders);
  };

  const loadAllSpatialData = async () => {
    loading = true;
    try {
      const [zonesRes, ridersRes, protoRoadsRes, tollRoadsRes, poisRes, configRes] = await Promise.allSettled([
        mapService.getAllZones(),
        mapService.getNearbyRiders(-7.4450, 112.7150, 50000),
        mapService.getProtocolRoads(),
        mapService.getTollRoads(),
        mapService.getPOIs(),
        mapService.getZoneConfig(),
      ]);

      if (zonesRes.status === 'fulfilled' && zonesRes.value) realZones = zonesRes.value;
      if (ridersRes.status === 'fulfilled' && ridersRes.value) activeRiders = ridersRes.value;
      if (protoRoadsRes.status === 'fulfilled' && protoRoadsRes.value) protocolRoadsGeoJson = protoRoadsRes.value;
      if (tollRoadsRes.status === 'fulfilled' && tollRoadsRes.value) tollRoadsGeoJson = tollRoadsRes.value;
      if (poisRes.status === 'fulfilled' && poisRes.value) realPois = poisRes.value;
      if (configRes.status === 'fulfilled' && configRes.value) zoneConfig = configRes.value;

      renderZones();
      renderHub();
      renderProtocolRoads();
      renderTollRoads();
      renderPois();
      renderRiders(activeRiders);
    } catch (err) {
      console.error('💥 Gagal memuat data spasial monitoring:', err);
    } finally {
      loading = false;
    }
  };

  const fetchWeatherData = async () => {
    try {
      const wRes = await mapService.getHubWeather('sidoarjo');
      if (wRes) {
        weatherData = wRes;
      }
    } catch (err) {
      console.warn('Gagal memuat info cuaca Sidoarjo:', err);
    }
  };

  const handleSyncWeather = async () => {
    syncingWeather = true;
    try {
      await mapService.syncWeather();
      await fetchWeatherData();
    } catch (e) {
      console.error('Gagal sync cuaca:', e);
    } finally {
      syncingWeather = false;
    }
  };

  // Focus and FlyTo Rider
  const focusRider = (rider: NearbyRider) => {
    if (!mapInstance || !L) return;
    mapInstance.flyTo([rider.latitude, rider.longitude], 16, { duration: 1.2 });
    selectedRider = rider;
    drawerOpen = true;
  };

  // Perform Location & Object Search
  const handlePerformSearch = async () => {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    isSearching = true;
    const q = searchQuery.toLowerCase().trim();
    const results: typeof searchResults = [];

    // 1. Check Zones
    realZones.forEach(z => {
      if (z.name.toLowerCase().includes(q) || (z.code && z.code.toLowerCase().includes(q))) {
        const latLngs = parsePolygonToLatLngs(z.polygon);
        if (latLngs.length > 0) {
          const centerLat = latLngs.reduce((sum, p) => sum + p[0], 0) / latLngs.length;
          const centerLng = latLngs.reduce((sum, p) => sum + p[1], 0) / latLngs.length;
          results.push({
            type: 'ZONE',
            title: z.name,
            subtitle: `Zona Operasional (Kode: ${z.code || '-'}) • Kapasitas ${z.max_capacity} unit`,
            badge: 'Zona',
            color: '#FF634A',
            lat: centerLat,
            lng: centerLng,
            rawData: z,
          });
        }
      }
    });

    // 2. Check Protocol Roads
    if (protocolRoadsGeoJson?.features) {
      protocolRoadsGeoJson.features.forEach((feat: any) => {
        const name = feat.properties?.name || '';
        if (name.toLowerCase().includes(q)) {
          const coords = feat.geometry?.coordinates || [];
          const firstCoord = Array.isArray(coords[0]) ? coords[0] : coords;
          const [lng, lat] = Array.isArray(firstCoord[0]) ? firstCoord[0] : firstCoord;
          if (lat && lng) {
            results.push({
              type: 'ROAD',
              title: name,
              subtitle: 'Jalan Protokol Sidoarjo (Terlarang untuk Kopi Keliling)',
              badge: 'Jalan Protokol',
              color: '#F59E0B',
              lat: Number(lat),
              lng: Number(lng),
              rawData: feat,
            });
          }
        }
      });
    }

    // 3. Check POIs
    realPois.forEach(p => {
      if (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) {
        results.push({
          type: 'POI',
          title: p.name,
          subtitle: `Kategori: ${p.category}`,
          badge: 'POI C3',
          color: '#8B5CF6',
          lat: p.latitude,
          lng: p.longitude,
          rawData: p,
        });
      }
    });

    // 4. Geocode Search in Sidoarjo
    try {
      const geoRes = await mapService.searchSidoarjoLocation(searchQuery);
      geoRes.forEach(g => {
        results.push({
          type: 'GEOCODE',
          title: g.display_name.split(',')[0],
          subtitle: g.display_name,
          badge: 'Lokasi Sidoarjo',
          color: '#10B981',
          lat: Number(g.lat),
          lng: Number(g.lon),
          rawData: g,
        });
      });
    } catch (e) {
      console.warn('Geocoding error:', e);
    }

    searchResults = results;
    isSearching = false;

    if (results.length === 1) {
      selectSearchResult(results[0]);
    }
  };

  // Pin & Focus selected Search Result
  const selectSearchResult = (item: typeof searchResults[0]) => {
    if (!mapInstance || !L) return;
    activePinnedLocation = { title: item.title, lat: item.lat, lng: item.lng };

    // Drop temporary search pin
    if (searchPinLayerGroup) {
      searchPinLayerGroup.clearLayers();

      const pinHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: ${item.color}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="background: ${item.color}; color: #FFFFFF; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 5;">
            <i class="ri-map-pin-2-fill" style="font-size: 16px;"></i>
          </div>
          <div style="margin-top: 4px; background: #131316; color: #FFFFFF; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 8px; white-space: nowrap; border: 1px solid #2E2E38; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
            ${item.title}
          </div>
        </div>
      `;

      const pinIcon = L.divIcon({
        html: pinHtml,
        className: 'search-drop-pin',
        iconSize: [32, 48],
        iconAnchor: [16, 24],
      });

      const pinMarker = L.marker([item.lat, item.lng], { icon: pinIcon }).addTo(searchPinLayerGroup);
      pinMarker.bindPopup(`
        <div style="font-family: Outfit, sans-serif; min-width: 180px;">
          <span style="font-size: 9px; font-weight: 700; color: ${item.color}; text-transform: uppercase;">${item.badge}</span>
          <h4 style="font-weight: 700; font-size: 13px; color: #18181B; margin: 2px 0;">${item.title}</h4>
          <p style="font-size: 10px; color: #71717A; margin: 0;">${item.subtitle}</p>
        </div>
      `).openPopup();
    }

    mapInstance.flyTo([item.lat, item.lng], item.type === 'ZONE' ? 15 : 17, { duration: 1.2 });
  };

  const clearSearchPin = () => {
    if (searchPinLayerGroup) {
      searchPinLayerGroup.clearLayers();
    }
    activePinnedLocation = null;
    searchQuery = '';
    searchResults = [];
  };

  // Map Controls
  const handleZoomIn = () => mapInstance?.zoomIn();
  const handleZoomOut = () => mapInstance?.zoomOut();
  const fitAllBounds = () => {
    if (!mapInstance) return;
    mapInstance.setView([-7.4450, 112.7150], 13);
  };

  // Reactive layer toggles
  $effect(() => {
    layerZones;
    renderZones();
  });

  $effect(() => {
    layerProtocolRoads;
    renderProtocolRoads();
  });

  $effect(() => {
    layerTollRoads;
    renderTollRoads();
  });

  $effect(() => {
    layerPoi;
    selectedTimeSlotKey;
    poiFilterCategory;
    renderPois();
  });

  $effect(() => {
    layerRiders;
    renderRiders(activeRiders);
  });

  onMount(() => {
    initMap();
  });

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
    }
  });
</script>

<div class="relative w-full h-full min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-4.5rem)] overflow-hidden bg-[#09090B] font-outfit-400 select-none">
  <!-- LEAFLET MAP ELEMENT (Edge-to-edge full width & height) -->
  <div bind:this={mapElement} class="w-full h-full z-0"></div>

  <!-- TOP-LEFT: PANEL FILTER TIME SLOTS AT VERY TOP-LEFT, WITH VERTICAL TOOLBAR & SUBPANEL UNDERNEATH -->
  <div class="absolute top-4 left-4 z-30 flex flex-col items-start gap-2.5 max-w-[calc(100vw-2rem)] sm:max-w-none">
    
    <MapTimeSlotBar
      {selectedTimeSlotKey}
      {timeSlotDefinitions}
      onSelectSlot={(slotKey) => selectedTimeSlotKey = slotKey}
      onBackToDashboard={onNavigate ? () => onNavigate('/dashboard') : undefined}
    />

    <!-- 2. VERTICAL TOOLBAR & ATTACHED DYNAMIC SUB-PANEL -->
    <div class="flex items-start gap-2.5">
      <!-- VERTICAL FLOATING TOOLBAR DOCK -->
      <MapFloatingToolbar
        {activePanel}
        activeRidersCount={activeRiders.length}
        onTogglePanel={togglePanel}
      />

      <!-- DYNAMIC ACTIVE SUB-PANEL -->
      {#if activePanel !== null}
        <div class="w-80 sm:w-88 bg-[#131316]/98 backdrop-blur-xl border border-[#2E2E38] rounded-3xl shadow-2xl p-3.5 text-white max-h-[calc(100vh-180px)] overflow-y-auto space-y-3 animate-in fade-in slide-in-from-left-3">
          
          {#if activePanel === 'search'}
            <MapSearchPanel
              {searchQuery}
              {isSearching}
              {searchResults}
              {activePinnedLocation}
              hubCityName={zoneConfig?.hub_city_name}
              onClose={() => activePanel = null}
              onSearchInput={(val) => {
                searchQuery = val;
                if (val.trim().length >= 2) handlePerformSearch();
              }}
              onPerformSearch={handlePerformSearch}
              onSelectResult={selectSearchResult}
              onClearPin={clearSearchPin}
            />
          {:else if activePanel === 'layers'}
            <MapLayersPanel
              {layerHub}
              {layerRiders}
              {layerZones}
              {layerProtocolRoads}
              {layerTollRoads}
              {layerPoi}
              activeRidersCount={activeRiders.length}
              activeZonesCount={realZones.length}
              hubCityName={zoneConfig?.hub_city_name}
              {poiFilterCategory}
              onClose={() => activePanel = null}
              onToggleHub={(val) => { layerHub = val; renderHub(); }}
              onToggleRiders={(val) => { layerRiders = val; renderRiders(activeRiders); }}
              onToggleZones={(val) => { layerZones = val; renderZones(); }}
              onToggleProtocolRoads={(val) => { layerProtocolRoads = val; renderProtocolRoads(); }}
              onToggleTollRoads={(val) => { layerTollRoads = val; renderTollRoads(); }}
              onTogglePoi={(val) => { layerPoi = val; renderPois(); }}
              onChangePoiFilter={(cat) => poiFilterCategory = cat}
            />
          {:else if activePanel === 'riders'}
            <MapRidersPanel
              {activeRiders}
              onClose={() => activePanel = null}
              onSelectRider={(rider) => {
                selectedRider = rider;
                drawerOpen = true;
              }}
              onOpenBroadcast={() => broadcastModalOpen = true}
            />
          {:else if activePanel === 'weather'}
            <MapWeatherPanel
              {weatherData}
              {syncingWeather}
              hubCityName={zoneConfig?.hub_city_name}
              onClose={() => activePanel = null}
              onSyncWeather={handleSyncWeather}
            />
          {:else if activePanel === 'legend'}
            <MapLegendPanel
              onClose={() => activePanel = null}
            />
          {:else if activePanel === 'basemap'}
            <MapBasemapPanel
              {basemapProviders}
              {selectedBasemapId}
              onClose={() => activePanel = null}
              onSelectBasemap={switchBasemap}
            />
          {/if}

        </div>
      {/if}
    </div>

  </div>

  <!-- TOP-RIGHT: PANEL INFORMASI UTAMA DI SAMPING KIRI TOMBOL KEMBALI KE DASHBOARD -->
  <div class="absolute top-4 right-4 z-30 flex items-center gap-2.5">
    
    <!-- 1. Main Telemetry Info HUD (Positioned to the left of the back button) -->
    <div class="h-11 bg-[#131316]/95 backdrop-blur-xl border border-[#2E2E38] rounded-3xl shadow-2xl px-3.5 sm:px-4 flex items-center gap-3 sm:gap-4 text-xs text-white shrink-0">
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-[#A1A1AA]">Rider: <strong class="text-emerald-400 font-outfit-600">{activeRiders.length} Aktif</strong></span>
      </div>

      <div class="hidden sm:block text-[#A1A1AA]">
        <span>Zona: <strong class="text-white font-outfit-600">{realZones.length} Area</strong></span>
      </div>

      <div class="hidden sm:block text-[#A1A1AA]">
        <span>POI: <strong class="text-purple-400 font-outfit-600">{realPois.length}</strong></span>
      </div>

      <div class="hidden md:block text-[#A1A1AA]">
        <span>Jalan Terlarang: <strong class="text-amber-400 font-outfit-600">{protocolRoadsGeoJson?.features?.length || 885}</strong></span>
      </div>
    </div>

    <!-- 2. Floating Back to Dashboard Button (Rightmost element) -->
    {#if onNavigate}
      <button
        onclick={() => onNavigate('/dashboard')}
        class="h-11 px-3.5 sm:px-4 rounded-3xl bg-[#131316]/95 hover:bg-[#1F1F24] text-white border border-[#2E2E38] text-xs font-outfit-600 transition-all cursor-pointer shadow-2xl backdrop-blur-md flex items-center gap-2 hover:border-[#FF634A] shrink-0"
      >
        <ArrowLeft class="w-3.5 h-3.5 text-[#FF634A]" />
        <span>Kembali ke Dashboard</span>
      </button>
    {/if}

  </div>

  <!-- BOTTOM-RIGHT: TOMBOL REFRESH & BROADCAST PERINGATAN (Moved to Bottom-Right) -->
  <div class="absolute bottom-4 right-4 z-30 flex items-center gap-2">
    <button
      onclick={loadAllSpatialData}
      class="px-3.5 py-2.5 rounded-2xl bg-[#131316]/95 hover:bg-[#1F1F24] text-white border border-[#2E2E38] shadow-2xl backdrop-blur-md transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-outfit-600"
      title="Refresh Data Spasial"
    >
      <RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
      <span class="hidden sm:inline">Refresh Data</span>
    </button>

    <button
      onclick={() => broadcastModalOpen = true}
      class="px-4 py-2.5 rounded-2xl bg-[#FF634A] hover:bg-[#FF4D30] text-white text-xs font-outfit-600 shadow-2xl backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer shadow-orange-950/30"
    >
      <i class="ri-broadcast-line text-sm"></i>
      <span>Broadcast Peringatan</span>
    </button>
  </div>

  <!-- BOTTOM-LEFT: ARAH MATA ANGIN & ZOOM CONTROLS -->
  <div class="absolute bottom-4 left-4 z-20 flex flex-col items-center gap-1.5">
    <!-- Arah Mata Angin (Compass Rose Widget) -->
    <div class="bg-[#131316]/95 backdrop-blur-md p-1.5 rounded-2xl border border-[#2E2E38] shadow-2xl text-white flex flex-col items-center">
      <button
        onclick={fitAllBounds}
        class="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[#1F1F24] transition-colors cursor-pointer group"
        title="Arah Mata Angin (Klik untuk reset orientasi ke Utara)"
      >
        <div class="w-7 h-7 rounded-full border border-[#3E3E48] flex items-center justify-center relative">
          <div class="w-1 h-3 bg-[#EF4444] rounded-t-sm absolute top-0.5"></div>
          <div class="w-1 h-3 bg-zinc-400 rounded-b-sm absolute bottom-0.5"></div>
          <div class="w-2 h-2 rounded-full bg-white shadow-xs z-10"></div>
          <span class="absolute -top-3.5 text-[8px] font-extrabold text-[#EF4444] tracking-widest font-mono">U</span>
        </div>
      </button>
    </div>

    <!-- Zoom Controls -->
    <div class="bg-[#131316]/95 backdrop-blur-md p-1 rounded-2xl border border-[#2E2E38] shadow-2xl text-white flex flex-col gap-0.5">
      <button onclick={handleZoomIn} class="p-2 text-[#A1A1AA] hover:text-white hover:bg-[#1F1F24] rounded-xl cursor-pointer transition-colors" title="Perbesar Peta">
        <Plus class="w-4 h-4" />
      </button>
      <button onclick={handleZoomOut} class="p-2 text-[#A1A1AA] hover:text-white hover:bg-[#1F1F24] rounded-xl cursor-pointer transition-colors" title="Perkecil Peta">
        <Minus class="w-4 h-4" />
      </button>
      <button onclick={fitAllBounds} class="p-2 text-[#A1A1AA] hover:text-white hover:bg-[#1F1F24] rounded-xl cursor-pointer transition-colors" title="Fokuskan Semua Sidoarjo">
        <Maximize2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>

  <!-- Rider Detail Drawer -->
  {#if selectedRider}
    <RiderDetailDrawer
      rider={selectedRider}
      isOpen={drawerOpen}
      onClose={() => {
        drawerOpen = false;
        selectedRider = null;
      }}
    />
  {/if}

  <!-- Broadcast Alert Modal -->
  {#if broadcastModalOpen}
    <BroadcastAlertModal
      isOpen={broadcastModalOpen}
      onClose={() => broadcastModalOpen = false}
    />
  {/if}
</div>

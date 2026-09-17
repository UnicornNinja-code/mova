/*
 * setupStore.svelte.ts
 * Svelte 5 Reactive Store for MOVA 7-Step First-Run Onboarding & Initialization Wizard
 */

import { setupService, type SetupStatusResponse, type InitialFleetUnit } from '../../services/setupService';
import { getSocket } from '../socket';

export interface SyncTaskItem {
  id: string;
  label: string;
  desc: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  error?: string;
}

class SetupStore {
  status = $state<'REQUIRED' | 'IN_PROGRESS' | 'APPLYING' | 'COMPLETED'>('COMPLETED');
  loading = $state(false);
  currentStep = $state<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);

  // STEP 01: Identitas Operasional
  identity = $state({
    businessName: '',
    hubCityName: '',
    centralHubName: '',
    centralHubAddress: '',
    centralHubLat: 0,
    centralHubLng: 0,
    timezone: 'Asia/Jakarta',
  });

  // STEP 02: Kebijakan Operasional
  operationalPolicy = $state({
    operatingHoursStart: '07:00',
    operatingHoursEnd: '21:00',
    operationalRadiusKm: 12,
  });

  // STEP 03: Armada Awal (Minimal 1 unit)
  fleets = $state<InitialFleetUnit[]>([
    {
      code: 'M-001',
      name: 'Armada Perdana M-001',
      type: 'MOTOR',
      status: 'ACTIVE',
    },
  ]);

  // STEP 04: Preferensi Peta
  mapPreferences = $state({
    basemapId: 'osm-standard',
    defaultZoom: 13,
    showHubRadius: true,
    showProtocolRoads: true,
    showPoi: false, // Default OFF to prevent clutter
    showWeather: true,
  });

  // STEP 05: Model DSS (BWM)
  dss = $state({
    bestCriteriaId: '1', // C1 Densitas POI
    worstCriteriaId: '5', // C5 Jarak Aksesibilitas
    bestToOthers: <Record<string, number>>{
      '1': 1,
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 7,
      '6': 5,
    },
    othersToWorst: <Record<string, number>>{
      '1': 7,
      '2': 5,
      '3': 4,
      '4': 3,
      '5': 1,
      '6': 2,
    },
    weights: <Record<string, number>>{},
    cr: 0,
    isConsistent: false,
    calibrated: false,
    details: <any[]>[],
  });

  // STEP 06: Distributed Spatial ETL & State-Guarded Sync Pipeline
  syncState = $state<'IDLE' | 'DRAFT' | 'LOCKED_SYNCING' | 'READY_FOR_REVIEW' | 'COMPLETED' | 'FAILED' | 'ABORTED'>('IDLE');
  syncError = $state<string | null>(null);

  datasets = $state<{
    toll_roads: { status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'; progress: number; count: number; version: number | null; error?: string };
    protocol_roads: { status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'; progress: number; count: number; version: number | null; error?: string };
    poi: { status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'; progress: number; count: number; version: number | null; error?: string };
  }>({
    toll_roads: { status: 'PENDING', progress: 0, count: 0, version: null },
    protocol_roads: { status: 'PENDING', progress: 0, count: 0, version: null },
    poi: { status: 'PENDING', progress: 0, count: 0, version: null },
  });

  isCompleted = $derived(this.status === 'COMPLETED');
  isSetupRequired = $derived(this.status === 'REQUIRED' || this.status === 'IN_PROGRESS');
  isSyncingLocked = $derived(this.syncState === 'LOCKED_SYNCING');
  isAllDatasetsReady = $derived(
    this.datasets.toll_roads.status === 'COMPLETED' &&
    this.datasets.protocol_roads.status === 'COMPLETED' &&
    this.datasets.poi.status === 'COMPLETED'
  );
  hasFailedDatasets = $derived(
    this.datasets.toll_roads.status === 'FAILED' ||
    this.datasets.protocol_roads.status === 'FAILED' ||
    this.datasets.poi.status === 'FAILED' ||
    this.syncState === 'FAILED'
  );
  overallSyncProgress = $derived(
    Math.round((this.datasets.toll_roads.progress + this.datasets.protocol_roads.progress + this.datasets.poi.progress) / 3)
  );

  /**
   * Fetch initialization status from PostgreSQL backend
   */
  async checkStatus(): Promise<SetupStatusResponse | null> {
    this.loading = true;
    try {
      const data = await setupService.getSetupStatus();
      this.status = data.status;

      if (data.hub_config) {
        if (data.hub_config.system_name) this.identity.businessName = data.hub_config.system_name;
        if (data.hub_config.hub_city_name) this.identity.hubCityName = data.hub_config.hub_city_name;
        if (data.hub_config.central_hub_name) this.identity.centralHubName = data.hub_config.central_hub_name;
        if (data.hub_config.central_hub_address) this.identity.centralHubAddress = data.hub_config.central_hub_address;
        if (data.hub_config.central_hub_lat) this.identity.centralHubLat = data.hub_config.central_hub_lat;
        if (data.hub_config.central_hub_lng) this.identity.centralHubLng = data.hub_config.central_hub_lng;
        if (data.hub_config.timezone) this.identity.timezone = data.hub_config.timezone;
      }

      // Step mapping
      const stepMap: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
        IDENTITY: 1,
        OPERATIONS: 2,
        FLEET: 3,
        MAP: 4,
        DSS: 5,
        SYNC: 6,
        REVIEW: 7,
        COMPLETED: 7,
      };

      if (data.current_step && stepMap[data.current_step]) {
        this.currentStep = stepMap[data.current_step];
      } else if (this.status === 'COMPLETED') {
        this.currentStep = 7;
      } else {
        this.currentStep = 1;
      }

      return data;
    } catch (err) {
      console.warn('[SetupStore] Gagal mengecek status setup sistem:', err);
      return null;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Save progress of a step
   */
  async saveStep(step: 1 | 2 | 3 | 4 | 5 | 6 | 7): Promise<boolean> {
    const stepNames: Record<number, string> = {
      1: 'IDENTITY',
      2: 'OPERATIONS',
      3: 'FLEET',
      4: 'MAP',
      5: 'DSS',
      6: 'SYNC',
      7: 'REVIEW',
    };

    const payload = {
      step_id: stepNames[step] || 'IDENTITY',
      data: {
        system_name: this.identity.businessName.trim() || 'MOVA',
        business_name: this.identity.businessName.trim() || 'MOVA',
        hub_city_name: this.identity.hubCityName.trim(),
        central_hub_name: this.identity.centralHubName.trim(),
        central_hub_address: this.identity.centralHubAddress.trim(),
        central_hub_lat: Number(this.identity.centralHubLat) || 0,
        central_hub_lng: Number(this.identity.centralHubLng) || 0,
        timezone: this.identity.timezone || 'Asia/Jakarta',
        operational_radius_km: Number(this.operationalPolicy.operationalRadiusKm) || 12,
        operating_hours_start: this.operationalPolicy.operatingHoursStart,
        operating_hours_end: this.operationalPolicy.operatingHoursEnd,
        initial_fleets: this.fleets,
        default_basemap: this.mapPreferences.basemapId,
        default_zoom: this.mapPreferences.defaultZoom,
        show_hub_radius: this.mapPreferences.showHubRadius,
        show_protocol_roads: this.mapPreferences.showProtocolRoads,
        show_poi: this.mapPreferences.showPoi,
        show_weather: this.mapPreferences.showWeather,
      },
    };

    try {
      await setupService.saveSetupStep(payload);
      return true;
    } catch (err) {
      console.error('[SetupStore] Gagal menyimpan progress step:', err);
      return false;
    }
  }

  /**
   * Final apply configuration to backend
   */
  async applyConfiguration(): Promise<boolean> {
    this.status = 'APPLYING';
    try {
      const payload = {
        system_name: this.identity.businessName || 'MOVA',
        business_name: this.identity.businessName || 'MOVA',
        hub_city_name: this.identity.hubCityName,
        central_hub_name: this.identity.centralHubName,
        central_hub_address: this.identity.centralHubAddress,
        central_hub_lat: this.identity.centralHubLat,
        central_hub_lng: this.identity.centralHubLng,
        timezone: this.identity.timezone,
        operational_radius_km: this.operationalPolicy.operationalRadiusKm,
        operating_hours_start: this.operationalPolicy.operatingHoursStart,
        operating_hours_end: this.operationalPolicy.operatingHoursEnd,
        initial_fleets: this.fleets,
        default_basemap: this.mapPreferences.basemapId,
        default_zoom: this.mapPreferences.defaultZoom,
        show_hub_radius: this.mapPreferences.showHubRadius,
        show_protocol_roads: this.mapPreferences.showProtocolRoads,
        show_poi: this.mapPreferences.showPoi,
        show_weather: this.mapPreferences.showWeather,
        dss_best_id: this.dss.bestCriteriaId,
        dss_worst_id: this.dss.worstCriteriaId,
        dss_weights: this.dss.weights,
        dss_baseline_accepted: true,
      };

      await setupService.applySetup(payload);
      this.status = 'COMPLETED';
      return true;
    } catch (err) {
      console.error('[SetupStore] Gagal menerapkan konfigurasi sistem:', err);
      this.status = 'IN_PROGRESS';
      return false;
    }
  }

  /**
   * Initialize Socket.IO listeners for real-time spatial sync progress
   */
  private socketInitialized = false;
  initSocketListeners(): void {
    if (this.socketInitialized) return;
    const socket = getSocket();

    socket.on('SPATIAL_SYNC_PROGRESS', (data: any) => {
      const type = (data.datasetType || '').toLowerCase();
      if (type.includes('toll')) {
        this.datasets.toll_roads.progress = data.progress;
        this.datasets.toll_roads.status = data.progress >= 100 ? 'COMPLETED' : 'PROCESSING';
      } else if (type.includes('road') || type.includes('protocol')) {
        this.datasets.protocol_roads.progress = data.progress;
        this.datasets.protocol_roads.status = data.progress >= 100 ? 'COMPLETED' : 'PROCESSING';
      } else if (type.includes('poi')) {
        this.datasets.poi.progress = data.progress;
        this.datasets.poi.status = data.progress >= 100 ? 'COMPLETED' : 'PROCESSING';
      }
    });

    socket.on('SPATIAL_SYNC_DATASET_COMPLETED', (data: any) => {
      const type = (data.datasetType || '').toLowerCase();
      if (type.includes('toll')) {
        this.datasets.toll_roads.status = 'COMPLETED';
        this.datasets.toll_roads.progress = 100;
        this.datasets.toll_roads.count = data.featuresCount || 0;
        this.datasets.toll_roads.version = data.version;
      } else if (type.includes('road') || type.includes('protocol')) {
        this.datasets.protocol_roads.status = 'COMPLETED';
        this.datasets.protocol_roads.progress = 100;
        this.datasets.protocol_roads.count = data.featuresCount || 0;
        this.datasets.protocol_roads.version = data.version;
      } else if (type.includes('poi')) {
        this.datasets.poi.status = 'COMPLETED';
        this.datasets.poi.progress = 100;
        this.datasets.poi.count = data.featuresCount || 0;
        this.datasets.poi.version = data.version;
      }
    });

    socket.on('SPATIAL_SYNC_DATASET_FAILED', (data: any) => {
      const type = (data.datasetType || '').toLowerCase();
      if (type.includes('toll')) {
        this.datasets.toll_roads.status = 'FAILED';
        this.datasets.toll_roads.error = data.error;
      } else if (type.includes('road') || type.includes('protocol')) {
        this.datasets.protocol_roads.status = 'FAILED';
        this.datasets.protocol_roads.error = data.error;
      } else if (type.includes('poi')) {
        this.datasets.poi.status = 'FAILED';
        this.datasets.poi.error = data.error;
      }
      this.syncState = 'FAILED';
      this.syncError = data.error || 'Terjadi kesalahan pada salah satu proses ETL.';
    });

    socket.on('SPATIAL_SYNC_ALL_COMPLETED', (data: any) => {
      if (data.success) {
        this.syncState = 'READY_FOR_REVIEW';
        this.datasets.toll_roads.status = 'COMPLETED';
        this.datasets.toll_roads.progress = 100;
        this.datasets.protocol_roads.status = 'COMPLETED';
        this.datasets.protocol_roads.progress = 100;
        this.datasets.poi.status = 'COMPLETED';
        this.datasets.poi.progress = 100;
      }
    });

    socket.on('SPATIAL_SYNC_ABORTED', (data: any) => {
      this.syncState = 'ABORTED';
      this.syncError = data.message || 'Sinkronisasi dibatalkan.';
    });

    this.socketInitialized = true;
  }

  /**
   * Fetch current spatial sync status from backend
   */
  async fetchSpatialSyncStatus(): Promise<void> {
    try {
      const res = await setupService.getSpatialSyncStatus();
      if (res) {
        const rawFsm = typeof res.fsmState === 'object' ? res.fsmState?.value : res.fsmState;
        this.syncState = rawFsm || (res.allReady ? 'READY_FOR_REVIEW' : 'IDLE');

        if (res.datasets?.toll_roads?.active) {
          this.datasets.toll_roads.status = 'COMPLETED';
          this.datasets.toll_roads.progress = 100;
          this.datasets.toll_roads.count = res.datasets.toll_roads.feature_count ?? 0;
          this.datasets.toll_roads.version = res.datasets.toll_roads.version;
        }
        if (res.datasets?.protocol_roads?.active) {
          this.datasets.protocol_roads.status = 'COMPLETED';
          this.datasets.protocol_roads.progress = 100;
          this.datasets.protocol_roads.count = res.datasets.protocol_roads.feature_count ?? 0;
          this.datasets.protocol_roads.version = res.datasets.protocol_roads.version;
        }
        if (res.datasets?.poi?.active) {
          this.datasets.poi.status = 'COMPLETED';
          this.datasets.poi.progress = 100;
          this.datasets.poi.count = res.datasets.poi.feature_count ?? 0;
          this.datasets.poi.version = res.datasets.poi.version;
        }
        if (res.allReady) {
          this.syncState = 'READY_FOR_REVIEW';
        }
      }
    } catch (err: any) {
      console.warn('[SetupStore] Gagal memuat status sinkronisasi:', err.message);
    }
  }

  /**
   * Start full FlowProducer pipeline
   */
  async startSpatialSync(): Promise<boolean> {
    this.initSocketListeners();
    this.syncState = 'LOCKED_SYNCING';
    this.syncError = null;
    this.datasets.toll_roads = { status: 'PROCESSING', progress: 5, count: 0, version: null };
    this.datasets.protocol_roads = { status: 'PROCESSING', progress: 5, count: 0, version: null };
    this.datasets.poi = { status: 'PROCESSING', progress: 5, count: 0, version: null };

    try {
      await setupService.startSpatialSync();
      return true;
    } catch (err: any) {
      this.syncState = 'FAILED';
      this.syncError = err.response?.data?.msg || err.message || 'Gagal memulai sinkronisasi.';
      return false;
    }
  }

  /**
   * Partial retry for a single dataset
   */
  async retryDataset(datasetType: 'TOLL_ROADS' | 'PROTOCOL_ROADS' | 'POI'): Promise<boolean> {
    this.initSocketListeners();
    this.syncState = 'LOCKED_SYNCING';
    if (datasetType === 'TOLL_ROADS') {
      this.datasets.toll_roads = { status: 'PROCESSING', progress: 5, count: 0, version: null };
    } else if (datasetType === 'PROTOCOL_ROADS') {
      this.datasets.protocol_roads = { status: 'PROCESSING', progress: 5, count: 0, version: null };
    } else if (datasetType === 'POI') {
      this.datasets.poi = { status: 'PROCESSING', progress: 5, count: 0, version: null };
    }

    try {
      await setupService.retryPartialSpatialSync(datasetType);
      return true;
    } catch (err: any) {
      this.syncState = 'FAILED';
      this.syncError = err.response?.data?.msg || err.message || `Gagal retry dataset ${datasetType}.`;
      return false;
    }
  }

  /**
   * Retry all failed datasets
   */
  async retryFailedOnly(): Promise<void> {
    if (this.datasets.toll_roads.status === 'FAILED') {
      await this.retryDataset('TOLL_ROADS');
    }
    if (this.datasets.protocol_roads.status === 'FAILED') {
      await this.retryDataset('PROTOCOL_ROADS');
    }
    if (this.datasets.poi.status === 'FAILED') {
      await this.retryDataset('POI');
    }
  }

  /**
   * Abort running sync
   */
  async abortSpatialSync(): Promise<boolean> {
    try {
      await setupService.abortSpatialSync();
      this.syncState = 'ABORTED';
      return true;
    } catch (err: any) {
      console.error('[SetupStore] Gagal membatalkan sinkronisasi:', err);
      return false;
    }
  }
}

export const setupStore = new SetupStore();

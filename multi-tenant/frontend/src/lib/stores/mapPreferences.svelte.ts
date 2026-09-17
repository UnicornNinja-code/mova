/*
 * mapPreferences.svelte.ts
 * Reactive User Map Preferences Store (Svelte 5 Runes)
 * Persists user's preferred Leaflet basemap tiles and spatial layer toggles to localStorage
 */

import { getBasemapProviders, type BasemapProvider } from '../mapProviders';

export interface MapPreferencesState {
  basemapId: string;
  showProtocolRoads: boolean;
  showWeatherLayer: boolean;
  showPoiLayer: boolean;
  showZonesLayer: boolean;
  showRidersLayer: boolean;
  geofenceBufferMeters: number;
}

const STORAGE_KEY = 'mova_map_preferences';

const DEFAULT_PREFERENCES: MapPreferencesState = {
  basemapId: 'openmaptiles-dark',
  showProtocolRoads: true,
  showWeatherLayer: true,
  showPoiLayer: true,
  showZonesLayer: true,
  showRidersLayer: true,
  geofenceBufferMeters: 50,
};

const loadInitialPreferences = (): MapPreferencesState => {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

class MapPreferencesStore {
  state = $state<MapPreferencesState>(loadInitialPreferences());

  providers = $derived<BasemapProvider[]>(getBasemapProviders());

  activeProvider = $derived.by<BasemapProvider>(() => {
    const found = this.providers.find((p) => p.id === this.state.basemapId);
    return found || this.providers[0];
  });

  private persist() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (err) {
        console.warn('Gagal menyimpan preferensi peta ke localStorage:', err);
      }
    }
  }

  setBasemap(id: string) {
    if (this.providers.some((p) => p.id === id)) {
      this.state.basemapId = id;
      this.persist();
    }
  }

  toggleLayer(layer: 'showProtocolRoads' | 'showWeatherLayer' | 'showPoiLayer' | 'showZonesLayer' | 'showRidersLayer') {
    this.state[layer] = !this.state[layer];
    this.persist();
  }

  setBufferMeters(meters: number) {
    this.state.geofenceBufferMeters = Math.max(10, Math.min(200, meters));
    this.persist();
  }

  resetDefaults() {
    this.state = { ...DEFAULT_PREFERENCES };
    this.persist();
  }
}

export const mapPreferences = new MapPreferencesStore();

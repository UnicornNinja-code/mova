import L from 'leaflet'
import apiClient from './api'
import type { ApiEnvelope } from '@/types/auth'

export interface MapSystemConfig {
  default_center: [number, number]
  default_zoom: number
  maptiler_style?: string
  hub_coordinates?: [number, number]
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || 'AyUpCtiyI63hcNskeC7K'

export const mapService = {
  getTileLayer(style: 'streets-v2' | 'dataviz-dark' | 'hybrid' = 'dataviz-dark'): L.TileLayer {
    if (MAPTILER_KEY) {
      const url = `https://api.maptiler.com/maps/${style}/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
      return L.tileLayer(url, {
        attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
        maxZoom: 20,
        tileSize: 256,
        crossOrigin: true,
      })
    }

    // Fallback to Carto Dark or OSM if no key
    return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    })
  },

  async getMapConfig(): Promise<MapSystemConfig> {
    try {
      const response = await apiClient.get<ApiEnvelope<MapSystemConfig>>('/system-settings/map-config')
      return response.data.data
    } catch {
      // Default to Jakarta central coordinates
      return {
        default_center: [-6.2088, 106.8456],
        default_zoom: 12,
        maptiler_style: 'dataviz-dark',
      }
    }
  },
}

export default mapService

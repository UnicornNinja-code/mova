/*
 * mapProviders.ts
 * Reliable High-Performance Map Tiles Layer Providers (OpenMapTiles / MapTiler)
 * Mendukung 6 preset OpenMapTiles: Streets, Satellite, Outdoor, Basic, Light, Dark
 */

export interface BasemapProvider {
  id: string;
  name: string;
  url: string;
  fallbackUrl?: string;
  subdomains?: string | string[];
  attribution: string;
  maxZoom: number;
  tileSize?: number;
  zoomOffset?: number;
}

export const getMapTilerKey = (): string => {
  return (
    import.meta.env.VITE_MAPTILER_KEY ||
    import.meta.env.VITE_MAPTILER_API_KEY ||
    ''
  );
};

export const getBasemapProviders = (): BasemapProvider[] => {
  const maptilerKey = getMapTilerKey().trim();
  const hasKey = maptilerKey.length > 0;

  return [
    {
      id: 'openmaptiles-dark',
      name: 'OpenMapTiles Dark (Kontras Gelap)',
      url: hasKey
        ? `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${maptilerKey}`
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      fallbackUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      subdomains: hasKey ? undefined : ['a', 'b', 'c', 'd'],
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      attribution:
        '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; OpenStreetMap contributors',
      maxZoom: 20,
    },
    {
      id: 'openmaptiles-streets',
      name: 'OpenMapTiles Streets (Jalan & Bangunan)',
      url: hasKey
        ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      fallbackUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: hasKey ? undefined : ['a', 'b', 'c'],
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      attribution:
        '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; OpenStreetMap contributors',
      maxZoom: 20,
    },
    {
      id: 'openmaptiles-satellite',
      name: 'OpenMapTiles Satellite (Citra Satelit Hybrid)',
      url: hasKey
        ? `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${maptilerKey}`
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      attribution:
        '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; Esri & OpenStreetMap contributors',
      maxZoom: 20,
    },
    {
      id: 'openmaptiles-outdoor',
      name: 'OpenMapTiles Outdoor (Topografi & Kontur)',
      url: hasKey
        ? `https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${maptilerKey}`
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      fallbackUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: hasKey ? undefined : ['a', 'b', 'c'],
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      attribution:
        '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; OpenStreetMap contributors',
      maxZoom: 20,
    },
    {
      id: 'openmaptiles-basic',
      name: 'OpenMapTiles Basic (Sederhana)',
      url: hasKey
        ? `https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=${maptilerKey}`
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      fallbackUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: hasKey ? undefined : ['a', 'b', 'c'],
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      attribution:
        '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; OpenStreetMap contributors',
      maxZoom: 20,
    },
    {
      id: 'openmaptiles-light',
      name: 'OpenMapTiles Light (Minimalis Terang)',
      url: hasKey
        ? `https://api.maptiler.com/maps/dataviz-light/{z}/{x}/{y}.png?key=${maptilerKey}`
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      fallbackUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      subdomains: hasKey ? undefined : ['a', 'b', 'c', 'd'],
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      attribution:
        '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; OpenStreetMap contributors',
      maxZoom: 20,
    },
    {
      id: 'osm-standard',
      name: 'OpenStreetMap Standard',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
  ];
};

export const createBasemapLayer = (L: any, providerId: string) => {
  const providers = getBasemapProviders();
  
  // Robust match with backward compatibility fallback
  let selected = providers.find((p) => p.id === providerId);
  if (!selected) {
    if (providerId.includes('dark')) {
      selected = providers.find((p) => p.id === 'openmaptiles-dark');
    } else if (providerId.includes('street')) {
      selected = providers.find((p) => p.id === 'openmaptiles-streets');
    } else if (providerId.includes('sat')) {
      selected = providers.find((p) => p.id === 'openmaptiles-satellite');
    } else if (providerId.includes('light')) {
      selected = providers.find((p) => p.id === 'openmaptiles-light');
    } else if (providerId.includes('out') || providerId.includes('topo')) {
      selected = providers.find((p) => p.id === 'openmaptiles-outdoor');
    } else if (providerId.includes('osm') || providerId.includes('openstreet')) {
      selected = providers.find((p) => p.id === 'osm-standard');
    }
  }
  if (!selected) {
    selected = providers[0];
  }

  const options: any = {
    maxZoom: selected.maxZoom,
    attribution: selected.attribution,
    crossOrigin: true,
  };

  if (selected.subdomains) {
    options.subdomains = selected.subdomains;
  }
  if (selected.tileSize) {
    options.tileSize = selected.tileSize;
  }
  if (selected.zoomOffset !== undefined) {
    options.zoomOffset = selected.zoomOffset;
  }

  const layer = L.tileLayer(selected.url, options);

  return { layer, provider: selected };
};

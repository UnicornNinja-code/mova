import React, { useState } from 'react'
import {
  Box,
  Card,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  ButtonText,
} from '@gluestack-ui/themed'
import {
  Truck,
  TrendingUp,
  MapPin,
  Zap,
  Send,
  RefreshCw,
  Compass,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'fleets' | 'spatial' | 'recommendations'>('fleets')

  const stats = [
    { label: 'Total Armada Aktif', value: '48 Unit', change: '+12%', icon: Truck, color: 'text-emerald-400' },
    { label: 'Revenue Hari Ini', value: formatCurrency(24500000), change: '+8.4%', icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Titik POI Terpetakan', value: '134 POI', change: '+18%', icon: MapPin, color: 'text-amber-400' },
    { label: 'Akurasi Rekomendasi DSS', value: '96.2%', change: '+3.1%', icon: Zap, color: 'text-purple-400' },
  ]

  const activeFleets = [
    { id: 'ARM-01', driver: 'Budi Santoso', location: 'Kebon Jeruk, Jakarta Barat', status: 'Online', battery: '92%', speed: '34 km/h' },
    { id: 'ARM-02', driver: 'Agus Pratama', location: 'Sudirman Central, Jakarta Selatan', status: 'Online', battery: '85%', speed: '22 km/h' },
    { id: 'ARM-03', driver: 'Dedi Kurniawan', location: 'Kelapa Gading, Jakarta Utara', status: 'Resting', battery: '64%', speed: '0 km/h' },
    { id: 'ARM-04', driver: 'Rian Hidayat', location: 'BSD City Sektor 1, Tangerang', status: 'Online', battery: '97%', speed: '41 km/h' },
  ]

  return (
    <VStack space="xl">
      {/* Top Action Bar */}
      <HStack className="justify-between items-center border-b border-zinc-800 pb-5">
        <VStack space="xs">
          <Heading size="xl" className="text-white font-bold tracking-tight">
            Dashboard Spasial DSS
          </Heading>
          <Text size="xs" className="text-zinc-400">
            Pemantauan real-time armada bergerak dan analisis klaster titik singgah.
          </Text>
        </VStack>

        <HStack space="sm">
          <Button
            className="bg-zinc-800 hover:bg-zinc-700 rounded-lg h-9 px-3 flex flex-row items-center gap-1.5"
            onPress={() => alert('Fitur Quick Dispatch')}
          >
            <Send className="h-3.5 w-3.5 text-zinc-300" />
            <ButtonText className="text-zinc-200 text-xs font-medium">Quick Dispatch</ButtonText>
          </Button>

          <Button
            className="bg-emerald-600 hover:bg-emerald-500 rounded-lg h-9 px-3 flex flex-row items-center gap-1.5"
            onPress={() => alert('Sinkronisasi Data Real-Time')}
          >
            <RefreshCw className="h-3.5 w-3.5 text-white" />
            <ButtonText className="text-white text-xs font-semibold">Sinkronisasi Data</ButtonText>
          </Button>
        </HStack>
      </HStack>

      {/* KPI Cards Grid */}
      <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
            <VStack space="sm">
              <HStack className="justify-between items-center">
                <Text size="xs" className="text-zinc-400 font-medium">{stat.label}</Text>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </HStack>

              <HStack className="justify-between items-baseline pt-1">
                <Text size="xl" className="text-white font-bold font-mono">{stat.value}</Text>
                <Box className="bg-emerald-950 border border-emerald-800 px-1.5 py-0.5 rounded">
                  <Text size="xs" className="text-emerald-400 font-mono text-[11px] font-semibold">{stat.change}</Text>
                </Box>
              </HStack>
            </VStack>
          </Card>
        ))}
      </Box>

      {/* Segmented Tabs */}
      <VStack space="md">
        <HStack space="xs" className="border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('fleets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'fleets'
                ? 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Armada Aktif
          </button>
          <button
            onClick={() => setActiveTab('spatial')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'spatial'
                ? 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Peta & Klaster Spasial
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'recommendations'
                ? 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Rekomendasi DSS
          </button>
        </HStack>

        {/* Tab 1: Fleets Table */}
        {activeTab === 'fleets' && (
          <Card className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <Box className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-3">ID Armada</th>
                    <th className="px-4 py-3">Pengemudi</th>
                    <th className="px-4 py-3">Lokasi Terakhir</th>
                    <th className="px-4 py-3">Kecepatan</th>
                    <th className="px-4 py-3">Baterai</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-200">
                  {activeFleets.map((fleet) => (
                    <tr key={fleet.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3 font-bold text-emerald-400">{fleet.id}</td>
                      <td className="px-4 py-3 font-sans font-medium text-white">{fleet.driver}</td>
                      <td className="px-4 py-3 font-sans text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          {fleet.location}
                        </span>
                      </td>
                      <td className="px-4 py-3">{fleet.speed}</td>
                      <td className="px-4 py-3 text-emerald-400">{fleet.battery}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                          fleet.status === 'Online'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {fleet.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Card>
        )}

        {/* Tab 2: Spatial Map */}
        {activeTab === 'spatial' && (
          <Card className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm">
            <Box className="h-80 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <Compass className="h-8 w-8 text-emerald-400 animate-spin" />
              <VStack space="xs">
                <Heading size="sm" className="text-white">Container Peta Spasial Leaflet (gluestack)</Heading>
                <Text size="xs" className="text-zinc-400 max-w-md">
                  Peta GIS terintegrasi dengan MapTiler layer, marker armada real-time, dan batas poligon zona operasional.
                </Text>
              </VStack>
            </Box>
          </Card>
        )}

        {/* Tab 3: Recommendations */}
        {activeTab === 'recommendations' && (
          <Card className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
            <Box className="p-4 rounded-xl border border-emerald-800/80 bg-emerald-950/20 flex flex-row items-start gap-3">
              <Zap className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <VStack space="xs">
                <Heading size="sm" className="text-emerald-300 font-semibold">Optimalisasi Hotspot: SCBD & Sudirman</Heading>
                <Text size="xs" className="text-zinc-300 leading-relaxed">
                  Prediksi lonjakan permintaan +35% antara pukul 11:30 - 13:30. Disarankan mengalihkan 3 unit armada dari Jakarta Barat untuk memenuhi estimasi pesanan.
                </Text>
              </VStack>
            </Box>
          </Card>
        )}
      </VStack>
    </VStack>
  )
}

export default DashboardPage

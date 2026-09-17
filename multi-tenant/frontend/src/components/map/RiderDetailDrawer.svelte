<script lang="ts">
  import Drawer from '../ui/Drawer.svelte';
  import Badge from '../ui/Badge.svelte';
  import Button from '../ui/Button.svelte';
  import { 
    Phone, 
    MessageSquare, 
    Navigation, 
    Gauge, 
    Clock, 
    Truck, 
    ShoppingBag,
    ShieldCheck,
    AlertTriangle
  } from 'lucide-svelte';
  import type { NearbyRider } from '../../services/mapService';

  interface Props {
    rider: NearbyRider | null;
    isOpen: boolean;
    onClose: () => void;
  }

  let { rider, isOpen, onClose }: Props = $props();
</script>

<Drawer
  {isOpen}
  title={rider?.name || 'Detail Telemetri Rider'}
  description="Data telemetri real-time GPS, armada, dan catatan penjualan"
  {onClose}
>
  {#if rider}
    <div class="space-y-4">
      <!-- Status Badge Header -->
      <div class="p-3.5 rounded-xl bg-[#F4F4F6] border border-[#D2D2D4] flex items-center justify-between">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] block">Status Operasional</span>
          <span class="text-sm font-extrabold text-[#18181B]">{rider.zoneName || 'Zona Sudirman Central'}</span>
        </div>
        <div>
          {#if rider.status === 'BREACH'}
            <Badge variant="danger" pulse>
              <AlertTriangle class="w-3 h-3" />
              <span>Breach Alert</span>
            </Badge>
          {:else}
            <Badge variant="success" pulse>
              <ShieldCheck class="w-3 h-3" />
              <span>Checked-In</span>
            </Badge>
          {/if}
        </div>
      </div>

      <!-- Telemetry Grid -->
      <div class="space-y-2">
        <span class="text-xs font-bold uppercase tracking-wider text-[#8E8E93]">Telemetri GPS & Sensor</span>
        <div class="grid grid-cols-2 gap-2.5">
          <div class="p-3 rounded-xl bg-white border border-[#D2D2D4] shadow-xs">
            <div class="flex items-center gap-1.5 text-[#52525B] text-xs">
              <Gauge class="w-3.5 h-3.5 text-[#FF634A]" />
              <span>Kecepatan</span>
            </div>
            <div class="text-base font-extrabold text-[#18181B] mt-1">
              {rider.speed || 18.2} km/h
            </div>
          </div>

          <div class="p-3 rounded-xl bg-white border border-[#D2D2D4] shadow-xs">
            <div class="flex items-center gap-1.5 text-[#52525B] text-xs">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-600" />
              <span>Status Tugas</span>
            </div>
            <div class="text-base font-extrabold text-[#18181B] mt-1">
              {rider.status || 'CHECKED_IN'}
            </div>
          </div>

          <div class="p-3 rounded-xl bg-white border border-[#D2D2D4] shadow-xs">
            <div class="flex items-center gap-1.5 text-[#52525B] text-xs">
              <Navigation class="w-3.5 h-3.5 text-blue-600" />
              <span>Arah Hadap</span>
            </div>
            <div class="text-base font-extrabold text-[#18181B] mt-1">
              {rider.heading || 142}° (SE)
            </div>
          </div>

          <div class="p-3 rounded-xl bg-white border border-[#D2D2D4] shadow-xs">
            <div class="flex items-center gap-1.5 text-[#52525B] text-xs">
              <Clock class="w-3.5 h-3.5 text-purple-600" />
              <span>Akurasi GPS</span>
            </div>
            <div class="text-base font-extrabold text-[#18181B] mt-1">
              ±3 meter
            </div>
          </div>
        </div>
      </div>

      <!-- Armada & Sales Breakdown -->
      <div class="space-y-2">
        <span class="text-xs font-bold uppercase tracking-wider text-[#8E8E93]">Armada & Performa Hari Ini</span>
        <div class="p-3.5 rounded-xl bg-white border border-[#D2D2D4] shadow-xs space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-[#52525B] flex items-center gap-1.5">
              <Truck class="w-3.5 h-3.5 text-[#8E8E93]" />
              <span>Plat Kendaraan:</span>
            </span>
            <strong class="text-[#18181B]">{rider.plateNumber || 'B 1234 COZ'}</strong>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[#52525B] flex items-center gap-1.5">
              <ShoppingBag class="w-3.5 h-3.5 text-[#8E8E93]" />
              <span>Total Penjualan:</span>
            </span>
            <strong class="text-emerald-700">34 Cup (Rp 510.000)</strong>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[#52525B]">Koordinat Terkini:</span>
            <span class="font-mono text-[11px] text-[#52525B]">
              {rider.latitude.toFixed(4)}, {rider.longitude.toFixed(4)}
            </span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-2">
      <Button variant="secondary" size="sm" onclick={onClose}>
        <Phone class="w-3.5 h-3.5 mr-1" />
        <span>Hubungi</span>
      </Button>
      <Button variant="primary" size="sm" onclick={onClose}>
        <MessageSquare class="w-3.5 h-3.5 mr-1" />
        <span>Kirim Pesan</span>
      </Button>
    </div>
  {/snippet}
</Drawer>

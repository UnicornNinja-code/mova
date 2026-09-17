<script lang="ts">
  import { authStore } from '../../lib/stores/auth.svelte';
  import type { Snippet } from 'svelte';
  import { notificationService, type NotificationItem } from '../../services/notificationService';
  import { setupStore } from '../../lib/stores/setupStore.svelte';
  import { onMount } from 'svelte';

  interface Props {
    currentRoute: string;
    onNavigate: (route: string) => void;
    children?: Snippet;
    compactSidebar?: boolean;
  }

  let {
    currentRoute,
    onNavigate,
    children,
    compactSidebar = false
  }: Props = $props();

  let mobileMenuOpen = $state(false);
  let isCollapsed = $state(false);
  let userDropdownOpen = $state(false);
  let notificationOpen = $state(false);

  // Dynamic notifications from PostgreSQL
  let notifications = $state<NotificationItem[]>([]);
  let unreadAlertCount = $state(0);
  let notifLoading = $state(false);

  const loadNotifications = async () => {
    try {
      const res = await notificationService.getNotifications(20);
      notifications = res.notifications || [];
      unreadAlertCount = res.unread_count || 0;
    } catch (err) {
      console.warn('Gagal memuat notifikasi:', err);
    }
  };

  const markAllAlertsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      notifications = notifications.map(n => ({ ...n, is_read: true }));
      unreadAlertCount = 0;
    } catch (err) {
      console.error('Gagal mark all as read:', err);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      notifications = notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
      unreadAlertCount = notifications.filter(n => !n.is_read).length;
    } catch (err) {
      console.error('Gagal mark as read:', err);
    }
  };

  onMount(() => {
    loadNotifications();
  });

  $effect(() => {
    isCollapsed = compactSidebar;
  });

  const navItems = [
    { label: 'Dashboard', route: '/dashboard', iconClass: 'ri-dashboard-3-line', activeIconClass: 'ri-dashboard-3-fill' },
    { label: 'Map Ops', route: '/map', iconClass: 'ri-map-2-line', activeIconClass: 'ri-map-2-fill' },
    { label: 'User Admin', route: '/users', iconClass: 'ri-team-line', activeIconClass: 'ri-team-fill' },
    { label: 'Zona Wilayah', route: '/zones', iconClass: 'ri-road-map-line', activeIconClass: 'ri-road-map-fill' },
    { label: 'DSS TOPSIS', route: '/dss', iconClass: 'ri-calculator-line', activeIconClass: 'ri-calculator-fill' },
    { label: 'Armada Gerobak', route: '/fleet', iconClass: 'ri-e-bike-2-line', activeIconClass: 'ri-e-bike-2-fill' },
    { label: 'Katalog Menu', route: '/catalog', iconClass: 'ri-cup-line', activeIconClass: 'ri-cup-fill' },
    { label: 'Plotting Rute', route: '/distribution', iconClass: 'ri-layout-grid-line', activeIconClass: 'ri-layout-grid-fill' },
    { label: 'Laporan & Audit', route: '/reports', iconClass: 'ri-file-chart-line', activeIconClass: 'ri-file-chart-fill' },
    { label: 'Pengaturan', route: '/settings', iconClass: 'ri-settings-4-line', activeIconClass: 'ri-settings-4-fill' },
  ];

  const handleNavClick = (route: string) => {
    // Route guard: Jika inisialisasi sistem belum selesai, arahkan ke /setup
    if (setupStore.isSetupRequired && authStore.user?.role === 'SUPERADMIN') {
      if (route !== '/dashboard' && route !== '/setup') {
        onNavigate('/setup');
        mobileMenuOpen = false;
        userDropdownOpen = false;
        notificationOpen = false;
        return;
      }
    }

    onNavigate(route);
    mobileMenuOpen = false;
    userDropdownOpen = false;
    notificationOpen = false;
  };

  const handleLogout = async () => {
    userDropdownOpen = false;
    await authStore.logout();
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/login');
    }
    onNavigate('/login');
  };

  const closeDropdowns = () => {
    userDropdownOpen = false;
    notificationOpen = false;
  };
</script>

<!-- Global Close Overlay when Dropdowns Open -->
{#if userDropdownOpen || notificationOpen}
  <button 
    type="button" 
    aria-label="Tutup menu popup"
    class="fixed inset-0 z-40 bg-transparent cursor-default border-0 p-0 m-0" 
    onclick={closeDropdowns}
  ></button>
{/if}

<div class="h-screen w-screen overflow-hidden bg-[#09090B] text-white flex flex-col font-outfit-400 select-none">
  <!-- STICKY TOP NAVBAR (Fixed at Top, Never Scrolls) -->
  <header class="bg-[#131316] border-b border-[#24242A] shrink-0 h-16 sm:h-18 px-4 sm:px-6 flex items-center justify-between z-50 shadow-md">
    <!-- Left: Brand Logo & Mobile Toggle -->
    <div class="flex items-center gap-3">
      <button 
        onclick={() => mobileMenuOpen = !mobileMenuOpen}
        class="lg:hidden p-2 rounded-xl text-[#A1A1AA] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
        aria-label="Menu Navigasi Mobile"
      >
        <i class="{mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'} text-2xl"></i>
      </button>

      <button 
        type="button"
        class="flex items-center gap-3 cursor-pointer text-left bg-transparent border-0 p-0" 
        onclick={() => handleNavClick('/dashboard')}
      >
        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] flex items-center justify-center text-[#09090B] shadow-lg">
          <i class="ri-cup-fill text-2xl font-bold"></i>
        </div>
        <div>
          <span class="text-[10px] font-outfit-600 uppercase tracking-widest text-[#FF8573] leading-none block">Move Where Demand Is.</span>
          <h1 class="text-sm sm:text-base font-outfit-600 text-white leading-none mt-0.5">MOVA</h1>
        </div>
      </button>
    </div>

    <!-- Center: Global Quick Search Bar -->
    <div class="hidden md:flex items-center flex-1 max-w-sm mx-6">
      <div class="relative w-full">
        <i class="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A] text-base"></i>
        <input 
          type="text" 
          placeholder="Cari zona, menu, rider, audit log... (Ctrl+K)" 
          class="w-full pl-9 pr-4 py-2 text-xs bg-[#1A1A1F] border border-[#24242A] rounded-full focus:outline-none focus:border-[#FF634A] focus:bg-[#1F1F26] transition-all text-white placeholder-[#71717A] font-outfit-400"
        />
      </div>
    </div>

    <!-- Right Controls: Notification Center & Enlarged User Info Dropdown -->
    <div class="flex items-center gap-2 sm:gap-3.5">
      <!-- Role Badge Pill -->
      <span class="hidden xl:inline-flex px-3.5 py-1 rounded-full text-xs font-outfit-600 bg-[#1A1A20] text-[#FF634A] border border-[#2E2E38]">
        {authStore.user?.role || 'SUPERADMIN'}
      </span>

      <!-- NOTIFICATION / ALERT BELL BUTTON -->
      <div class="relative">
        <button 
          type="button"
          onclick={() => { notificationOpen = !notificationOpen; userDropdownOpen = false; }}
          class="relative w-10 h-10 rounded-2xl bg-[#1A1A20] hover:bg-[#23232A] border border-[#272730] flex items-center justify-center text-[#A1A1AA] hover:text-white transition-all cursor-pointer shadow-xs"
          aria-label="Pusat Peringatan & Notifikasi"
          title="Notifikasi & Peringatan Operasional"
        >
          <i class="ri-notification-3-line text-xl"></i>
          {#if unreadAlertCount > 0}
            <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#FF634A] text-white text-[10px] font-outfit-600 flex items-center justify-center shadow-md animate-pulse">
              {unreadAlertCount}
            </span>
          {/if}
        </button>

        <!-- Notification Drawer Popover -->
        {#if notificationOpen}
          <div class="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#16161A] rounded-3xl border border-[#2E2E38] shadow-2xl p-4 z-50 space-y-3 font-outfit-400">
            <div class="flex items-center justify-between pb-2.5 border-b border-[#24242A]">
              <div class="flex items-center gap-2">
                <i class="ri-notification-3-fill text-[#FF634A] text-lg"></i>
                <h4 class="text-sm font-outfit-600 text-white">Peringatan Operasional</h4>
                {#if unreadAlertCount > 0}
                  <span class="px-2 py-0.5 rounded-full bg-[#FF634A]/20 text-[#FF634A] text-[10px] font-outfit-600 border border-[#FF634A]/30">
                    {unreadAlertCount} Baru
                  </span>
                {/if}
              </div>
              <button 
                onclick={markAllAlertsRead}
                class="text-[11px] font-outfit-600 text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                Tandai Dibaca
              </button>
            </div>

            <!-- Notifications List -->
            <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
              {#if notifications.length === 0}
                <div class="py-8 text-center text-xs text-[#71717A] space-y-1.5">
                  <i class="ri-notification-off-line text-2xl text-zinc-600"></i>
                  <p>Tidak ada notifikasi baru.</p>
                </div>
              {:else}
                {#each notifications as notif}
                  <button
                    type="button"
                    onclick={() => markSingleRead(notif.id)}
                    class="w-full text-left p-2.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer
                    {!notif.is_read 
                      ? 'bg-[#1D1D23] border-[#383846] hover:border-[#FF634A]/50' 
                      : 'bg-[#16161A] border-[#222228] opacity-70 hover:opacity-100'}"
                  >
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 {!notif.is_read ? 'bg-[#FF634A]/20 text-[#FF634A] border border-[#FF634A]/30' : 'bg-zinc-800 text-zinc-400'}">
                      <i class="ri-information-line text-base"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-1">
                        <span class="text-xs font-outfit-600 text-white truncate">{notif.title}</span>
                        <span class="text-[10px] text-[#71717A] shrink-0 font-mono">
                          {notif.created_at ? new Date(notif.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru'}
                        </span>
                      </div>
                      <p class="text-[11px] text-[#A1A1AA] mt-0.5 leading-snug">{notif.message}</p>
                    </div>
                  </button>
                {/each}
              {/if}
            </div>

            <div class="pt-2 border-t border-[#24242A] text-center">
              <button
                onclick={() => handleNavClick('/map')}
                class="text-xs font-outfit-600 text-[#FF634A] hover:underline cursor-pointer flex items-center justify-center gap-1 w-full"
              >
                <span>Buka Pusat Komando Spasial</span>
                <i class="ri-arrow-right-line"></i>
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- ENLARGED USER INFO PILL & INTERACTIVE PROFILE DROPDOWN -->
      <div class="relative">
        <button
          type="button"
          onclick={() => { userDropdownOpen = !userDropdownOpen; notificationOpen = false; }}
          class="flex items-center gap-3 p-1.5 pr-3 rounded-full bg-[#1A1A20] hover:bg-[#23232A] border border-[#272730] transition-all cursor-pointer shadow-xs"
          aria-label="Menu Pengguna"
        >
          <!-- Enlarged Avatar -->
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] flex items-center justify-center font-outfit-600 text-sm font-extrabold shadow-md shrink-0">
            {authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'A'}
          </div>

          <!-- Enlarged Text Info -->
          <div class="hidden sm:block text-left">
            <div class="text-xs sm:text-sm font-outfit-600 text-white leading-tight truncate max-w-[140px]">
              {authStore.user?.name || 'Super Admin System'}
            </div>
            <div class="text-[11px] text-[#A1A1AA] leading-none mt-0.5 truncate max-w-[140px]">
              {authStore.user?.email || 'superadmin@kopikeliling.com'}
            </div>
          </div>

          <i class="ri-arrow-down-s-line text-[#71717A] text-lg ml-0.5"></i>
        </button>

        <!-- User Profile Dropdown Popover -->
        {#if userDropdownOpen}
          <div class="absolute right-0 top-full mt-2 w-72 bg-[#16161A] rounded-3xl border border-[#2E2E38] shadow-2xl p-3 z-50 space-y-2 font-outfit-400">
            <!-- Profile Card Header -->
            <div class="p-3 rounded-2xl bg-[#1D1D23] border border-[#272730] flex items-center gap-3">
              <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] flex items-center justify-center font-outfit-600 text-base font-extrabold shadow-md shrink-0">
                {authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div class="min-w-0">
                <div class="text-sm font-outfit-600 text-white truncate">{authStore.user?.name || 'Super Admin'}</div>
                <div class="text-xs text-[#71717A] truncate">{authStore.user?.email || 'admin@cozis.id'}</div>
                <span class="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-outfit-600 bg-[#FF634A]/20 text-[#FF634A] border border-[#FF634A]/30">
                  {authStore.user?.role || 'SUPERADMIN'}
                </span>
              </div>
            </div>

            <!-- Navigasi Menu Profil -->
            <div class="space-y-1 pt-1">
              <button
                onclick={() => handleNavClick('/users')}
                class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-outfit-600 text-[#A1A1AA] hover:text-white hover:bg-[#202027] rounded-xl transition-all cursor-pointer text-left"
              >
                <i class="ri-user-settings-line text-base text-blue-400"></i>
                <span>Kelola Profil & Pengguna</span>
              </button>

              <button
                onclick={() => handleNavClick('/settings')}
                class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-outfit-600 text-[#A1A1AA] hover:text-white hover:bg-[#202027] rounded-xl transition-all cursor-pointer text-left"
              >
                <i class="ri-settings-4-line text-base text-amber-400"></i>
                <span>Pengaturan Sistem</span>
              </button>
            </div>

            <!-- Logout Action -->
            <div class="pt-2 border-t border-[#24242A]">
              <button
                onclick={handleLogout}
                class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-outfit-600 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/40 rounded-xl transition-all cursor-pointer text-left"
              >
                <i class="ri-logout-box-r-line text-base"></i>
                <span>Keluar Akun (Logout)</span>
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </header>

  <!-- BODY LAYOUT: FIXED STICKY SIDEBAR + SCROLLABLE MAIN CONTENT -->
  <div class="flex-1 flex overflow-hidden">
    <!-- STICKY DESKTOP SIDEBAR (Never scrolls with main content, sits fixed on left) -->
    <aside 
      class="hidden lg:flex flex-col bg-[#131316] border-r border-[#24242A] transition-all duration-200 shrink-0 z-30 h-full overflow-hidden
      {isCollapsed ? 'w-18' : 'w-60'}"
    >
      <!-- "PERKECIL MENU" TOGGLE PLACED RIGHT AT THE TOP ABOVE DASHBOARD -->
      <div class="p-3 border-b border-[#24242A]">
        <button
          onclick={() => isCollapsed = !isCollapsed}
          class="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-outfit-600 text-[#A1A1AA] hover:text-white bg-[#1A1A20] hover:bg-[#23232A] border border-[#272730] rounded-2xl transition-all cursor-pointer shadow-xs"
          title={isCollapsed ? 'Perlebar Sidebar' : 'Perkecil Sidebar'}
        >
          <i class="{isCollapsed ? 'ri-expand-right-line' : 'ri-collapse-left-line'} text-base text-[#FF634A]"></i>
          {#if !isCollapsed}
            <span class="truncate">Perkecil Menu</span>
          {/if}
        </button>
      </div>

      <!-- Setup Incomplete Indicator Callout -->
      {#if setupStore.isSetupRequired && authStore.user?.role === 'SUPERADMIN' && !isCollapsed}
        <div class="mx-3 my-2 p-3 rounded-2xl bg-[#FF634A]/10 border border-[#FF634A]/30 text-xs space-y-2">
          <div class="flex items-center gap-1.5 text-[#FF8573] font-outfit-600">
            <span class="w-2 h-2 rounded-full bg-[#FF634A] animate-pulse"></span>
            <span>Setup Diperlukan</span>
          </div>
          <p class="text-[10px] text-[#A1A1AA] leading-relaxed">
            Selesaikan konfigurasi awal sistem untuk mengaktifkan seluruh modul.
          </p>
          <button
            type="button"
            onclick={() => handleNavClick('/setup')}
            class="w-full py-1.5 px-2 rounded-xl text-[10px] font-outfit-600 text-white bg-[#FF634A] hover:bg-[#E54E36] transition-colors flex items-center justify-center gap-1 shadow-md shadow-[#FF634A]/20 cursor-pointer"
          >
            <span>Buka Setup Wizard →</span>
          </button>
        </div>
      {/if}

      <!-- Navigation List -->
      <nav class="flex-1 py-3 px-3 space-y-1.5 overflow-y-auto">
        {#each navItems as item}
          {@const isActive = currentRoute === item.route || currentRoute.startsWith(`${item.route}/`)}
          <button
            onclick={() => handleNavClick(item.route)}
            class="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-outfit-600 transition-all cursor-pointer text-left
            {isActive 
              ? 'bg-white text-[#09090B] shadow-lg font-extrabold' 
              : 'text-[#A1A1AA] hover:text-white hover:bg-[#1A1A20]'}"
            title={isCollapsed ? item.label : undefined}
          >
            <i class="{isActive ? item.activeIconClass : item.iconClass} text-xl shrink-0 {isActive ? 'text-[#FF634A]' : ''}"></i>
            {#if !isCollapsed}
              <span class="truncate">{item.label}</span>
            {/if}
          </button>
        {/each}
      </nav>
    </aside>

    <!-- MOBILE DRAWER SIDEBAR (Overlay) -->
    {#if mobileMenuOpen}
      <div class="lg:hidden fixed inset-0 z-50 flex">
        <!-- Backdrop -->
        <button 
          type="button" 
          aria-label="Tutup menu sidebar"
          class="fixed inset-0 bg-black/70 backdrop-blur-sm border-0 p-0 m-0 cursor-pointer" 
          onclick={() => mobileMenuOpen = false}
        ></button>

        <!-- Drawer Content -->
        <div class="relative w-64 bg-[#131316] border-r border-[#24242A] h-full flex flex-col p-4 shadow-2xl z-10 font-outfit-400">
          <div class="flex items-center justify-between pb-3 border-b border-[#24242A] mb-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-[#FF634A] flex items-center justify-center text-[#09090B]">
                <i class="ri-cup-fill text-lg font-bold"></i>
              </div>
              <span class="text-sm font-outfit-600 text-white">Menu MOVA</span>
            </div>
            <button 
              onclick={() => mobileMenuOpen = false}
              class="p-1 rounded-lg text-[#A1A1AA] hover:bg-[#1F1F24] cursor-pointer"
              aria-label="Tutup Menu"
            >
              <i class="ri-close-line text-2xl"></i>
            </button>
          </div>

          <nav class="flex-1 space-y-1.5 overflow-y-auto">
            {#each navItems as item}
              {@const isActive = currentRoute === item.route || currentRoute.startsWith(`${item.route}/`)}
              <button
                onclick={() => handleNavClick(item.route)}
                class="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-outfit-600 transition-all cursor-pointer text-left
                {isActive 
                  ? 'bg-white text-[#09090B] font-extrabold shadow-lg' 
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#1A1A20]'}"
              >
                <i class="{isActive ? item.activeIconClass : item.iconClass} text-xl shrink-0 {isActive ? 'text-[#FF634A]' : ''}"></i>
                <span>{item.label}</span>
              </button>
            {/each}
          </nav>

          <div class="pt-3 border-t border-[#24242A] mt-auto">
            <button
              onclick={handleLogout}
              class="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-outfit-600 text-rose-400 hover:bg-rose-950/40 rounded-2xl transition-colors cursor-pointer"
            >
              <i class="ri-logout-box-r-line text-lg"></i>
              <span>Keluar (Logout)</span>
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- MAIN SCROLLABLE WORKSPACE (Only this area scrolls!) -->
    <main class="flex-1 h-full overflow-y-auto relative pattern-dots-dark {currentRoute === '/map' ? 'p-0 overflow-hidden' : 'p-4 sm:p-6 lg:p-8'} bg-[#09090B] overflow-x-hidden">
      {#if currentRoute !== '/map'}
        <!-- Ambient Lighting Effects matching Auth Pages -->
        <div class="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF634A]/8 rounded-full blur-[140px] pointer-events-none z-0"></div>
        <div class="fixed bottom-10 right-10 w-80 h-80 bg-purple-950/20 rounded-full blur-[110px] pointer-events-none z-0"></div>
      {/if}

      <div class="relative z-10 {currentRoute === '/map' ? 'w-full h-full' : 'max-w-7xl mx-auto'}">
        {#if children}
          {@render children()}
        {/if}
      </div>
    </main>
  </div>
</div>

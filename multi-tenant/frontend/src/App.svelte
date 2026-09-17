<script lang="ts">
  import { onMount } from 'svelte';
  import Toast from './components/ui/Toast.svelte';
  import { router } from './lib/stores/router.svelte';
  import { authStore, getRoleLandingPath } from './lib/stores/auth.svelte';
  import { setupStore } from './lib/stores/setupStore.svelte';

  // Public & Auth Pages
  import LoginPage from './pages/auth/LoginPage.svelte';
  import RegisterPage from './pages/auth/RegisterPage.svelte';
  import FirstLoginPage from './pages/auth/FirstLoginPage.svelte';
  import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.svelte';
  import ResetPasswordPage from './pages/auth/ResetPasswordPage.svelte';
  import FirstSetupPage from './pages/setup/FirstSetupPage.svelte';
  import SetupPage from './pages/setup/SetupPage.svelte';
  import NotFoundPage from './pages/NotFoundPage.svelte';

  // Desktop Management Suite
  import AppShell from './components/layout/AppShell.svelte';
  import SuperAdminDashboardPage from './pages/superadmin/SuperAdminDashboardPage.svelte';
  import OperationalPresencePage from './pages/presence/OperationalPresencePage.svelte';
  import HistoricalAnalyticsPage from './pages/analytics/HistoricalAnalyticsPage.svelte';
  import SuperAdminMapPage from './pages/superadmin/SuperAdminMapPage.svelte';
  import SuperAdminZonesPage from './pages/superadmin/SuperAdminZonesPage.svelte';
  import SuperAdminPoisPage from './pages/superadmin/SuperAdminPoisPage.svelte';
  import SuperAdminDssPage from './pages/superadmin/SuperAdminDssPage.svelte';
  import SuperAdminDistributionPage from './pages/superadmin/SuperAdminDistributionPage.svelte';
  import SuperAdminFleetPage from './pages/superadmin/SuperAdminFleetPage.svelte';
  import SuperAdminUsersPage from './pages/superadmin/SuperAdminUsersPage.svelte';
  import SuperAdminReportsPage from './pages/superadmin/SuperAdminReportsPage.svelte';
  import SuperAdminAuditPage from './pages/superadmin/SuperAdminAuditPage.svelte';
  import SuperAdminSettingsPage from './pages/superadmin/SuperAdminSettingsPage.svelte';
  import SuperAdminCatalogPage from './pages/superadmin/SuperAdminCatalogPage.svelte';
  import SupervisorCatalogPage from './pages/supervisor/SupervisorCatalogPage.svelte';

  // Mobile Rider PWA Step Pages
  import RiderDashboardPage from './pages/rider/RiderDashboardPage.svelte';
  import RiderDutyPage from './pages/rider/RiderDutyPage.svelte';
  import RiderArmadaPage from './pages/rider/RiderArmadaPage.svelte';
  import RiderCheckInPage from './pages/rider/RiderCheckInPage.svelte';
  import RiderPosPage from './pages/rider/RiderPosPage.svelte';
  import RiderSettlementPage from './pages/rider/RiderSettlementPage.svelte';
  import RiderHistoryPage from './pages/rider/RiderHistoryPage.svelte';

  const navigate = (path: string) => {
    router.navigate(path);
  };

  onMount(async () => {
    await authStore.validateSession();
    if (authStore.user?.role === 'SUPERADMIN') {
      const status = await setupStore.checkStatus();
      if (status && (status.status === 'REQUIRED' || status.status === 'IN_PROGRESS')) {
        if (router.currentPath === '/' || router.currentPath === '/login' || router.currentPath === '/dashboard') {
          router.replace('/first-setup');
        }
      }
    }
    if (router.currentPath === '/showcase') {
      router.replace('/login');
    }
  });
</script>

<Toast />

{#if router.currentPath === '/' || router.currentPath === '/login' || router.currentPath === '/showcase'}
  {#if authStore.token && authStore.user}
    {#if authStore.user.first_login}
      <FirstLoginPage onNavigate={navigate} />
    {:else if authStore.user.role === 'RIDER'}
      <RiderDashboardPage onNavigate={navigate} />
    {:else if authStore.user.role === 'SUPERADMIN' && setupStore.isSetupRequired}
      <FirstSetupPage onNavigate={navigate} />
    {:else}
      <AppShell currentRoute="/dashboard" onNavigate={navigate}>
        <SuperAdminDashboardPage onNavigate={navigate} />
      </AppShell>
    {/if}
  {:else}
    <LoginPage onNavigate={navigate} />
  {/if}

{:else if router.currentPath === '/register'}
  <RegisterPage onNavigate={navigate} />

{:else if router.currentPath === '/first-login'}
  {#if !authStore.token || !authStore.user}
    <LoginPage onNavigate={navigate} />
  {:else if !authStore.user.first_login}
    {#if authStore.user.role === 'RIDER'}
      <RiderDashboardPage onNavigate={navigate} />
    {:else}
      <AppShell currentRoute="/dashboard" onNavigate={navigate}>
        <SuperAdminDashboardPage onNavigate={navigate} />
      </AppShell>
    {/if}
  {:else}
    <FirstLoginPage onNavigate={navigate} />
  {/if}

{:else if router.currentPath === '/forgot-password'}
  <ForgotPasswordPage onNavigate={navigate} />

{:else if router.currentPath === '/reset-password'}
  <ResetPasswordPage onNavigate={navigate} />

{:else if router.currentPath === '/first-setup'}
  <FirstSetupPage onNavigate={navigate} />

{:else if router.currentPath === '/setup'}
  <SetupPage onNavigate={navigate} />

<!-- Rider Mobile PWA Step Pages (Standalone Mobile Viewports) -->
{:else if router.currentPath === '/rider'}
  <RiderDashboardPage onNavigate={navigate} />

{:else if router.currentPath === '/rider/duty'}
  <RiderDutyPage onNavigate={navigate} />

{:else if router.currentPath === '/rider/armada'}
  <RiderArmadaPage onNavigate={navigate} />

{:else if router.currentPath === '/rider/checkin'}
  <RiderCheckInPage onNavigate={navigate} />

{:else if router.currentPath === '/rider/pos'}
  <RiderPosPage onNavigate={navigate} />

{:else if router.currentPath === '/rider/settlement'}
  <RiderSettlementPage onNavigate={navigate} />

{:else if router.currentPath === '/rider/history'}
  <RiderHistoryPage onNavigate={navigate} />

<!-- Desktop Management Suite (Wrapped in AppShell Desktop Layout) -->
{:else if router.currentPath === '/dashboard'}
  {#if authStore.user?.role === 'SUPERADMIN' && setupStore.isSetupRequired}
    <FirstSetupPage onNavigate={navigate} />
  {:else}
    <AppShell currentRoute="/dashboard" onNavigate={navigate}>
      <SuperAdminDashboardPage onNavigate={navigate} />
    </AppShell>
  {/if}

{:else if router.currentPath === '/presence'}
  <AppShell currentRoute="/presence" onNavigate={navigate}>
    <OperationalPresencePage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/analytics/historical'}
  <AppShell currentRoute="/analytics/historical" onNavigate={navigate}>
    <HistoricalAnalyticsPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/map'}
  <AppShell currentRoute="/map" onNavigate={navigate}>
    <SuperAdminMapPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/zones'}
  <AppShell currentRoute="/zones" onNavigate={navigate}>
    <SuperAdminZonesPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/pois'}
  <AppShell currentRoute="/pois" onNavigate={navigate}>
    <SuperAdminPoisPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/dss'}
  <AppShell currentRoute="/dss" onNavigate={navigate}>
    <SuperAdminDssPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/distribution'}
  <AppShell currentRoute="/distribution" onNavigate={navigate}>
    <SuperAdminDistributionPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/fleet'}
  <AppShell currentRoute="/fleet" onNavigate={navigate}>
    <SuperAdminFleetPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/users'}
  <AppShell currentRoute="/users" onNavigate={navigate}>
    <SuperAdminUsersPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/reports'}
  <AppShell currentRoute="/reports" onNavigate={navigate}>
    <SuperAdminReportsPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/audit'}
  <AppShell currentRoute="/audit" onNavigate={navigate}>
    <SuperAdminAuditPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/settings'}
  <AppShell currentRoute="/settings" onNavigate={navigate}>
    <SuperAdminSettingsPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/catalog'}
  <AppShell currentRoute="/catalog" onNavigate={navigate}>
    <SuperAdminCatalogPage onNavigate={navigate} />
  </AppShell>

{:else if router.currentPath === '/supervisor'}
  <AppShell currentRoute="/supervisor" onNavigate={navigate}>
    <SupervisorCatalogPage onNavigate={navigate} />
  </AppShell>

{:else}
  <NotFoundPage onHome={() => navigate('/dashboard')} />
{/if}

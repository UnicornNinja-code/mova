<script lang="ts">
  import { onMount } from 'svelte';
  import { userService, type UserAccountItem } from '../../services/userService';
  import { authStore } from '../../lib/stores/auth.svelte';
  import UserFormModal from '../../components/users/UserFormModal.svelte';
  import UserResetPasswordModal from '../../components/users/UserResetPasswordModal.svelte';
  import UserInvitationModal from '../../components/users/UserInvitationModal.svelte';
  import { confirmModal } from '../../lib/stores/confirmModal.svelte';
  import { 
    Users, 
    UserPlus, 
    Shield, 
    Key, 
    Trash2, 
    Edit2, 
    Search, 
    Filter, 
    CheckCircle2, 
    Lock, 
    Unlock, 
    MoreVertical, 
    Mail, 
    Clock, 
    ShieldCheck, 
    RotateCcw,
    Send,
    Copy,
    Check,
    X
  } from 'lucide-svelte';
  import Alert from '../../components/ui/Alert.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let loading = $state(true);
  let users = $state<UserAccountItem[]>([]);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  // Filters
  let searchQuery = $state('');
  let selectedRole = $state('ALL');
  let selectedStatus = $state('ALL');

  // Modals state
  let formModalOpen = $state(false);
  let resetModalOpen = $state(false);
  let selectedUser = $state<UserAccountItem | null>(null);

  // Resend invitation modal state
  let invitationModalOpen = $state(false);
  let resentInvitationData = $state<{ name: string; email: string; link: string } | null>(null);
  let invitationCopied = $state(false);
  let resendingId = $state<number | string | null>(null);

  const canManageUser = (targetUser: UserAccountItem): boolean => {
    const currentRole = authStore.user?.role;
    if (currentRole === 'SUPERADMIN') return true;
    if (currentRole === 'MANAGEMENT') {
      return targetUser.role === 'SUPERVISOR' || targetUser.role === 'RIDER';
    }
    return false;
  };

  const loadUsers = async () => {
    loading = true;
    errorMsg = null;
    try {
      const data = await userService.getAllUsers();
      users = data;
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat data pengguna.';
    } finally {
      loading = false;
    }
  };

  const handleResendInvitation = async (u: UserAccountItem) => {
    resendingId = u.id;
    errorMsg = null;
    try {
      const res = await userService.resendInvitation(u.id);
      resentInvitationData = {
        name: u.name,
        email: u.email,
        link: res.invitation_link,
      };
      invitationModalOpen = true;
      invitationCopied = false;
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || 'Gagal mengirim ulang undangan aktivasi.';
    } finally {
      resendingId = null;
    }
  };

  const copyResentLink = async () => {
    if (!resentInvitationData?.link) return;
    try {
      await navigator.clipboard.writeText(resentInvitationData.link);
      invitationCopied = true;
      setTimeout(() => (invitationCopied = false), 2500);
    } catch {
      // fallback
    }
  };

  const handleToggleStatus = async (u: UserAccountItem) => {
    if (String(u.id) === String(authStore.user?.id)) {
      errorMsg = 'Anda tidak dapat menonaktifkan akun Anda sendiri.';
      setTimeout(() => (errorMsg = null), 3000);
      return;
    }

    if (!canManageUser(u)) {
      errorMsg = 'Akses ditolak: Anda tidak memiliki wewenang mengubah status akun ini.';
      return;
    }

    const nextStatus = !u.is_active;

    await confirmModal.verify({
      context: 'USER_TOGGLE_STATUS',
      title: nextStatus ? 'Aktifkan Akses Pengguna' : 'Nonaktifkan Akses Pengguna',
      subtitle: nextStatus
        ? `Aktifkan kembali akun "${u.name}" (@${u.username}) ke lingkungan operasional COZIS.`
        : `Nonaktifkan akun "${u.name}" (@${u.username}). Pengguna tidak akan dapat login sampai diaktifkan kembali.`,
      targetName: `${u.name} (${u.role})`,
      severity: nextStatus ? 'info' : 'warning',
      confirmLabel: nextStatus ? 'Aktifkan Akun' : 'Nonaktifkan Akun',
      verificationLabel: nextStatus 
        ? `Saya mengonfirmasi pemberian akses kembali bagi akun ${u.name}.`
        : `Saya memahami bahwa ${u.name} tidak akan dapat login atau menerima penugasan baru.`,
      onConfirm: async () => {
        await userService.toggleUserStatus(u.id, nextStatus);
        users = users.map((item) => (item.id === u.id ? { ...item, is_active: nextStatus } : item));
        successMsg = `Status akun ${u.name} berhasil ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}.`;
        setTimeout(() => (successMsg = null), 3000);
      },
    });
  };

  const handleDeleteUser = async (u: UserAccountItem) => {
    if (String(u.id) === String(authStore.user?.id)) {
      errorMsg = 'Anda tidak dapat menghapus akun Anda sendiri.';
      setTimeout(() => (errorMsg = null), 3000);
      return;
    }

    if (!canManageUser(u)) {
      errorMsg = 'Akses ditolak: Anda tidak memiliki wewenang menghapus akun ini.';
      return;
    }

    await confirmModal.verify({
      context: 'DELETE_USER',
      targetName: `${u.name} (@${u.username})`,
      subtitle: `Apakah Anda yakin ingin menghapus akun "${u.name}" (${u.role}) secara permanen? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        await userService.deleteUser(u.id);
        users = users.filter((item) => item.id !== u.id);
        successMsg = `Akun ${u.name} berhasil dihapus.`;
        setTimeout(() => (successMsg = null), 3000);
      },
    });
  };

  const openCreateModal = () => {
    selectedUser = null;
    formModalOpen = true;
  };

  const openEditModal = (u: UserAccountItem) => {
    selectedUser = u;
    formModalOpen = true;
  };

  const openResetModal = (u: UserAccountItem) => {
    selectedUser = u;
    resetModalOpen = true;
  };

  const filteredUsers = $derived(
    users.filter((u) => {
      const matchSearch =
        (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = selectedRole === 'ALL' || u.role === selectedRole;
      const matchStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'AKTIF' && u.is_active) ||
        (selectedStatus === 'MENUNGGU' && !u.is_active);
      return matchSearch && matchRole && matchStatus;
    })
  );

  onMount(() => {
    loadUsers();
  });
</script>

<div class="space-y-6 pb-12 font-outfit-400">
  <!-- TOP TOOLBAR: Breadcrumbs & Page Title -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#24242A]">
    <div>
      <div class="text-[11px] font-outfit-600 text-[#71717A] uppercase tracking-wider flex items-center gap-1.5">
        <span>Master Data</span>
        <span>•</span>
        <span class="text-[#FF634A]">Administrasi Pengguna</span>
      </div>
      <h2 class="text-xl sm:text-2xl lg:text-3xl font-outfit-600 text-white tracking-tight leading-tight mt-0.5">
        Manajemen Akun Pengguna & Peran
      </h2>
    </div>

    <!-- Quick Navigation & Add Button -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        onclick={openCreateModal}
        class="pill-btn-orange text-xs font-outfit-600 cursor-pointer"
      >
        <span class="px-4 py-2 flex items-center gap-1.5 text-white font-bold">
          <UserPlus class="w-4 h-4" />
          <span>Tambah Akun User</span>
        </span>
      </button>

      <button
        onclick={() => onNavigate('/dashboard')}
        class="pill-btn-white text-xs font-outfit-600"
      >
        <span class="px-3.5 py-1.5 flex items-center gap-1.5 text-[#09090B]">
          <i class="ri-dashboard-line text-sm text-[#FF634A]"></i>
          <span>Kembali ke Dashboard</span>
        </span>
      </button>
    </div>
  </div>

  <!-- QUICK STATS CARDS: Role Distribution Breakdown -->
  <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
    <div class="p-3.5 sm:p-4 rounded-2xl bg-[#131316] border border-[#24242A] space-y-1">
      <span class="text-[10px] text-[#71717A] uppercase font-outfit-600 block">Total Pengguna</span>
      <div class="text-xl sm:text-2xl font-outfit-600 text-white font-mono">{users.length}</div>
      <span class="text-[10px] text-[#A1A1AA]">Seluruh Akun</span>
    </div>

    <div class="p-3.5 sm:p-4 rounded-2xl bg-[#131316] border border-[#24242A] space-y-1">
      <span class="text-[10px] text-[#71717A] uppercase font-outfit-600 block">Super Admin</span>
      <div class="text-xl sm:text-2xl font-outfit-600 text-rose-400 font-mono">
        {users.filter((u) => u.role === 'SUPERADMIN').length}
      </div>
      <span class="text-[10px] text-rose-400/80">Akses Penuh</span>
    </div>

    <div class="p-3.5 sm:p-4 rounded-2xl bg-[#131316] border border-[#24242A] space-y-1">
      <span class="text-[10px] text-[#71717A] uppercase font-outfit-600 block">Management</span>
      <div class="text-xl sm:text-2xl font-outfit-600 text-blue-400 font-mono">
        {users.filter((u) => u.role === 'MANAGEMENT').length}
      </div>
      <span class="text-[10px] text-blue-400/80">Manajer Bisnis</span>
    </div>

    <div class="p-3.5 sm:p-4 rounded-2xl bg-[#131316] border border-[#24242A] space-y-1">
      <span class="text-[10px] text-[#71717A] uppercase font-outfit-600 block">Supervisor</span>
      <div class="text-xl sm:text-2xl font-outfit-600 text-amber-400 font-mono">
        {users.filter((u) => u.role === 'SUPERVISOR').length}
      </div>
      <span class="text-[10px] text-amber-400/80">Komando Ops</span>
    </div>

    <div class="p-3.5 sm:p-4 rounded-2xl bg-[#131316] border border-[#24242A] space-y-1">
      <span class="text-[10px] text-[#71717A] uppercase font-outfit-600 block">Rider Lapangan</span>
      <div class="text-xl sm:text-2xl font-outfit-600 text-emerald-400 font-mono">
        {users.filter((u) => u.role === 'RIDER').length}
      </div>
      <span class="text-[10px] text-emerald-400/80">Pelaksana Jual</span>
    </div>
  </div>

  <!-- Feedback Alerts -->
  {#if errorMsg}
    <Alert variant="danger" title="Kendala">{errorMsg}</Alert>
  {/if}

  {#if successMsg}
    <Alert variant="success" title="Berhasil">{successMsg}</Alert>
  {/if}

  <!-- MAIN USERS TABLE CONTAINER -->
  <div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
    <!-- Filter Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <!-- Search Input -->
      <div class="relative flex-1 max-w-sm">
        <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
        <input
          type="text"
          placeholder="Cari nama, @username, email..."
          bind:value={searchQuery}
          class="w-full pl-9 pr-4 py-2 text-xs bg-[#1A1A1F] border border-[#2E2E38] rounded-xl text-white placeholder-[#71717A] focus:border-[#FF634A] focus:outline-none"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Role Filter -->
        <select
          bind:value={selectedRole}
          class="px-3 py-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
        >
          <option value="ALL">Semua Peran (Role)</option>
          <option value="SUPERADMIN">SUPERADMIN</option>
          <option value="MANAGEMENT">MANAGEMENT</option>
          <option value="SUPERVISOR">SUPERVISOR</option>
          <option value="RIDER">RIDER</option>
        </select>

        <!-- Status Filter -->
        <select
          bind:value={selectedStatus}
          class="px-3 py-2 rounded-xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none cursor-pointer"
        >
          <option value="ALL">Semua Status</option>
          <option value="AKTIF">Aktif</option>
          <option value="NONAKTIF">Nonaktif</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A]">
      <table class="w-full text-xs text-left">
        <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[10px] font-outfit-600 border-b border-[#24242A]">
          <tr>
            <th class="py-3 px-4">Pengguna & Username</th>
            <th class="py-3 px-4">Email</th>
            <th class="py-3 px-3 text-center">Peran (Role)</th>
            <th class="py-3 px-3 text-center">Status</th>
            <th class="py-3 px-4">Waktu Terdaftar</th>
            <th class="py-3 px-4 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#24242A]">
          {#if loading}
            <tr>
              <td colspan="6" class="py-8 text-center text-xs text-[#A1A1AA]">
                <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin mb-2"></div>
                <div>Memuat data akun pengguna...</div>
              </td>
            </tr>
          {:else if filteredUsers.length === 0}
            <tr>
              <td colspan="6" class="py-8 text-center text-xs text-[#71717A]">
                Tidak ada data pengguna yang sesuai dengan filter pencarian.
              </td>
            </tr>
          {:else}
            {#each filteredUsers as u}
              <tr class="hover:bg-[#1D1D24] transition-colors {u.is_active ? '' : 'opacity-60'}">
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF634A]/20 to-[#FF8573]/20 border border-[#FF634A]/30 text-[#FF634A] flex items-center justify-center font-bold text-xs">
                      {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div class="font-outfit-600 text-white flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {#if String(u.id) === String(authStore.user?.id)}
                          <span class="px-1.5 py-0.2 rounded-md bg-purple-950/40 text-purple-300 text-[9px] font-mono border border-purple-800/40">Saya</span>
                        {/if}
                      </div>
                      <div class="text-[11px] text-[#71717A] font-mono">@{u.username}</div>
                    </div>
                  </div>
                </td>

                <td class="py-3 px-4 font-mono text-zinc-300">
                  {u.email}
                </td>

                <td class="py-3 px-3 text-center">
                  {#if u.role === 'SUPERADMIN'}
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-rose-950/40 text-rose-400 border border-rose-800/40">
                      SUPERADMIN
                    </span>
                  {:else if u.role === 'MANAGEMENT'}
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-blue-950/40 text-blue-400 border border-blue-800/40">
                      MANAGEMENT
                    </span>
                  {:else if u.role === 'SUPERVISOR'}
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-amber-950/40 text-amber-400 border border-amber-800/40">
                      SUPERVISOR
                    </span>
                  {:else}
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                      RIDER
                    </span>
                  {/if}
                </td>

                <td class="py-3 px-3 text-center">
                  {#if u.is_active}
                    <button
                      type="button"
                      disabled={!canManageUser(u)}
                      onclick={() => handleToggleStatus(u)}
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 transition-all cursor-pointer border bg-emerald-950/40 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={canManageUser(u) ? "Klik untuk menonaktifkan akun" : "Hak akses tidak mencukupi"}
                    >
                      Aktif
                    </button>
                  {:else}
                    <button
                      type="button"
                      disabled={!canManageUser(u)}
                      onclick={() => handleToggleStatus(u)}
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 transition-all cursor-pointer border bg-amber-950/40 text-amber-300 border-amber-800/40 hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={canManageUser(u) ? "Menunggu Aktivasi / Nonaktif. Klik untuk mengaktifkan." : "Hak akses tidak mencukupi"}
                    >
                      Menunggu Aktivasi
                    </button>
                  {/if}
                </td>

                <td class="py-3 px-4 font-mono text-[11px] text-[#71717A]">
                  {new Date(u.created_at || '').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>

                <!-- Contextual Actions -->
                <td class="py-3 px-4 text-center">
                  <div class="flex items-center justify-center gap-1.5">
                    <!-- Resend Invitation Link -->
                    {#if canManageUser(u)}
                      <button
                        type="button"
                        disabled={resendingId === u.id}
                        onclick={() => handleResendInvitation(u)}
                        class="p-1.5 rounded-lg text-blue-400 hover:bg-blue-950/40 transition-colors cursor-pointer disabled:opacity-50"
                        title="Kirim Ulang / Dapatkan Tautan Aktivasi"
                      >
                        <Send class="w-3.5 h-3.5 {resendingId === u.id ? 'animate-pulse' : ''}" />
                      </button>
                    {/if}

                    {#if canManageUser(u)}
                      <button
                        type="button"
                        onclick={() => openEditModal(u)}
                        class="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-[#24242C] transition-colors cursor-pointer"
                        title="Edit Data User"
                      >
                        <Edit2 class="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onclick={() => openResetModal(u)}
                        class="p-1.5 rounded-lg text-amber-400 hover:bg-amber-950/40 transition-colors cursor-pointer"
                        title="Reset Password Akun"
                      >
                        <Key class="w-3.5 h-3.5" />
                      </button>

                      {#if String(u.id) !== String(authStore.user?.id)}
                        <button
                          type="button"
                          onclick={() => handleDeleteUser(u)}
                          class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Hapus Akun"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      {/if}
                    {:else}
                      <span class="text-[10px] text-zinc-600 font-mono italic">Akses Terkunci</span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- MODAL UNDANGAN AKTIVASI -->
<UserInvitationModal
  open={invitationModalOpen}
  invitationData={resentInvitationData}
  onClose={() => (invitationModalOpen = false)}
/>

<!-- MODALS -->
<UserFormModal
  open={formModalOpen}
  onClose={() => (formModalOpen = false)}
  userToEdit={selectedUser}
  onSuccess={loadUsers}
/>

<UserResetPasswordModal
  open={resetModalOpen}
  onClose={() => (resetModalOpen = false)}
  user={selectedUser}
  onSuccess={loadUsers}
/>

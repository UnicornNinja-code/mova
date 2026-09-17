<script lang="ts">
  import { Eye, EyeOff } from 'lucide-svelte';

  interface Props {
    label?: string;
    type?: string;
    value?: string | number;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helperText?: string;
    leftIcon?: any;
    class?: string;
    name?: string;
    id?: string;
    autocomplete?: string;
  }

  let {
    label = '',
    type = 'text',
    value = $bindable(''),
    placeholder = '',
    required = false,
    disabled = false,
    error = null,
    helperText = '',
    leftIcon: LeftIcon,
    class: className = '',
    name = '',
    id = '',
    autocomplete = 'off',
  }: Props = $props();

  const inputId = $derived(id || (name ? `input-${name}` : (label ? `input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined)));
  let showPassword = $state(false);
  let isPassword = $derived(type === 'password');
  let currentType = $derived(isPassword ? (showPassword ? 'text' : 'password') : type);
</script>

<div class="space-y-1.5 w-full font-outfit-400 {className}">
  {#if label}
    <label for={inputId} class="block text-xs font-outfit-600 text-[#D4D4D8] tracking-wide">
      {label}
      {#if required}
        <span class="text-[#FF634A] font-bold">*</span>
      {/if}
    </label>
  {/if}

  <div class="relative flex items-center">
    {#if LeftIcon}
      <div class="absolute left-3.5 text-[#71717A] pointer-events-none flex items-center justify-center">
        <LeftIcon class="w-4 h-4" />
      </div>
    {/if}

    <input
      id={inputId}
      type={currentType}
      bind:value={value}
      {placeholder}
      {disabled}
      {required}
      {name}
      autocomplete={autocomplete as any}
      class="w-full bg-[#1A1A1F] text-white text-xs sm:text-sm rounded-2xl border transition-all duration-200 py-3 
      {LeftIcon ? 'pl-10' : 'pl-4'} 
      {isPassword ? 'pr-11' : 'pr-4'}
      {error 
        ? 'border-rose-500/80 focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 bg-rose-950/10 text-rose-200' 
        : 'border-[#24242A] hover:border-[#383842] focus:border-[#FF634A] focus:ring-2 focus:ring-[#FF634A]/20 focus:bg-[#1E1E24]'}
      focus:outline-none placeholder:text-[#52525B] disabled:bg-[#131316] disabled:text-[#52525B] disabled:border-[#1E1E24]"
    />

    {#if isPassword}
      <button
        type="button"
        onclick={() => showPassword = !showPassword}
        class="absolute right-3.5 text-[#71717A] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#272730] cursor-pointer"
        tabindex="-1"
        aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      >
        {#if showPassword}
          <EyeOff class="w-4 h-4" />
        {:else}
          <Eye class="w-4 h-4" />
        {/if}
      </button>
    {/if}
  </div>

  {#if error}
    <p class="text-[11px] font-outfit-600 text-rose-400 flex items-center gap-1 mt-1">
      <span class="inline-block w-1 h-1 rounded-full bg-rose-400"></span>
      {error}
    </p>
  {:else if helperText}
    <p class="text-[11px] text-[#71717A] mt-1">{helperText}</p>
  {/if}
</div>

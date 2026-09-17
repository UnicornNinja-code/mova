<script lang="ts">
  import { cn } from "$lib/utils";

  interface CheckboxProps {
    checked?: boolean;
    disabled?: boolean;
    id?: string;
    class?: string;
    onchange?: (checked: boolean) => void;
  }

  let {
    checked = $bindable(false),
    disabled = false,
    id,
    class: className = "",
    onchange,
  }: CheckboxProps = $props();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={checked}
  {id}
  {disabled}
  onclick={toggle}
  class={cn(
    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-white/20 bg-[#18181b] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF634A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer select-none",
    checked ? "border-[#FF634A] bg-[#FF634A] text-white shadow-sm shadow-[#FF634A]/30" : "hover:border-white/40",
    className
  )}
>
  {#if checked}
    <i class="bx bx-check text-sm leading-none font-bold text-white"></i>
  {/if}
</button>

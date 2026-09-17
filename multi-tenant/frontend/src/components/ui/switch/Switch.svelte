<script lang="ts">
  import { cn } from "$lib/utils";

  interface SwitchProps {
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
  }: SwitchProps = $props();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label="Toggle switch"
  {id}
  {disabled}
  onclick={toggle}
  class={cn(
    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF634A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b] disabled:cursor-not-allowed disabled:opacity-50 select-none",
    checked ? "bg-[#FF634A]" : "bg-[#27272a]",
    className
  )}
>
  <span
    class={cn(
      "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
      checked ? "translate-x-4" : "translate-x-0"
    )}
  ></span>
</button>

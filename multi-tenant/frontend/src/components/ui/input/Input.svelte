<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLInputAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  interface InputProps extends HTMLInputAttributes {
    class?: string;
    value?: string | number;
    icon?: string; // Boxicon name, e.g. "bx-search", "bx-envelope", "bx-lock"
    hotkey?: string; // e.g. "Ctrl K" or "⌘K"
    error?: string;
    suffix?: Snippet;
  }

  let {
    class: className = "",
    value = $bindable(),
    type = "text",
    icon,
    hotkey,
    error,
    suffix,
    disabled = false,
    ...restProps
  }: InputProps = $props();
</script>

<div class="relative w-full">
  {#if icon}
    <div class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
      <i class={cn("bx text-lg leading-none", icon)}></i>
    </div>
  {/if}

  <input
    {type}
    {disabled}
    bind:value
    class={cn(
      "flex h-10 w-full rounded-lg border border-white/10 bg-[#121215] px-3.5 py-2 text-sm text-[#fafafa] placeholder:text-zinc-500 shadow-inner transition-all duration-150 ease-in-out focus:border-[#FF634A] focus:outline-none focus:ring-1 focus:ring-[#FF634A] disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]",
      icon && "pl-10",
      hotkey && "pr-16",
      error && "border-red-500/80 focus:border-red-500 focus:ring-red-500",
      className
    )}
    {...restProps}
  />

  {#if hotkey}
    <div class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center rounded border border-white/10 bg-[#1e1e22] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
      {hotkey}
    </div>
  {/if}

  {#if suffix}
    <div class="absolute right-3 top-1/2 -translate-y-1/2">
      {@render suffix()}
    </div>
  {/if}

  {#if error}
    <p class="mt-1 text-xs text-red-400">{error}</p>
  {/if}
</div>

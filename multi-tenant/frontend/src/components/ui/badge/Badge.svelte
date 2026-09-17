<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  export type BadgeVariant =
    | "default"
    | "pending"
    | "progress"
    | "expire"
    | "submitted"
    | "failed"
    | "success"
    | "in-review"
    | "active"
    | "waiting"
    | "hold"
    | "maintenance"
    | "plotted"
    | "secondary"
    | "destructive"
    | "outline";

  interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
    variant?: BadgeVariant;
    icon?: string; // Boxicon name, e.g. "bx-error", "bx-check-circle", "bx-time-five"
    class?: string;
    children?: Snippet;
  }

  let {
    variant = "default",
    icon,
    class: className = "",
    children,
    ...restProps
  }: BadgeProps = $props();

  const variantClasses: Record<BadgeVariant, { container: string; defaultIcon: string }> = {
    // 1. Pending (Amber Outline Pill with Warning Triangle)
    pending: {
      container: "bg-amber-500/10 text-amber-500 border border-amber-500/40 hover:bg-amber-500/15",
      defaultIcon: "bx-error",
    },
    // 2. Progress (Sky Blue Outline Pill with Loader Circle)
    progress: {
      container: "bg-sky-500/10 text-sky-400 border border-sky-500/40 hover:bg-sky-500/15",
      defaultIcon: "bx-loader-circle",
    },
    // 3. Expire (Slate / Neutral Outline Pill with Clock)
    expire: {
      container: "bg-zinc-500/10 text-zinc-300 border border-zinc-500/40 hover:bg-zinc-500/15",
      defaultIcon: "bx-time-five",
    },
    // 4. Submitted (Purple Outline Pill with Send / Paper Plane)
    submitted: {
      container: "bg-purple-500/10 text-purple-400 border border-purple-500/40 hover:bg-purple-500/15",
      defaultIcon: "bx-paper-plane",
    },
    // 5. Failed (Red / Rose Outline Pill with Cross Circle)
    failed: {
      container: "bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:bg-rose-500/15",
      defaultIcon: "bx-x-circle",
    },
    // 6. Success (Emerald Green Outline Pill with Check Circle)
    success: {
      container: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/15",
      defaultIcon: "bx-check-circle",
    },
    // 7. In Review (Orange Outline Pill with Search / Focus)
    "in-review": {
      container: "bg-orange-500/10 text-orange-400 border border-orange-500/40 hover:bg-orange-500/15",
      defaultIcon: "bx-search-alt",
    },

    // Aliases & MOVA DSS Canonical Statuses
    active: {
      container: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/15",
      defaultIcon: "bx-check-circle",
    },
    waiting: {
      container: "bg-amber-500/10 text-amber-400 border border-amber-500/40 hover:bg-amber-500/15",
      defaultIcon: "bx-error",
    },
    hold: {
      container: "bg-orange-500/15 text-orange-400 border border-orange-500/40 hover:bg-orange-500/20",
      defaultIcon: "bx-time",
    },
    maintenance: {
      container: "bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:bg-rose-500/15",
      defaultIcon: "bx-wrench",
    },
    plotted: {
      container: "bg-sky-500/10 text-sky-400 border border-sky-500/40 hover:bg-sky-500/15",
      defaultIcon: "bx-navigation",
    },
    default: {
      container: "bg-[#FF634A]/10 text-[#FF634A] border border-[#FF634A]/30 hover:bg-[#FF634A]/15",
      defaultIcon: "bx-hot",
    },
    secondary: {
      container: "bg-zinc-800/60 text-zinc-300 border border-white/10 hover:bg-zinc-800",
      defaultIcon: "bx-circle",
    },
    destructive: {
      container: "bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:bg-rose-500/15",
      defaultIcon: "bx-x-circle",
    },
    outline: {
      container: "bg-transparent text-zinc-300 border border-white/15 hover:border-white/30",
      defaultIcon: "bx-radio-circle",
    },
  };

  const currentCfg = $derived(variantClasses[variant] || variantClasses.default);
  const effectiveIcon = $derived(icon || currentCfg.defaultIcon);
</script>

<div
  class={cn(
    "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs sm:text-[13px] font-heading font-medium tracking-normal select-none transition-all duration-150 backdrop-blur-sm",
    currentCfg.container,
    className
  )}
  {...restProps}
>
  {#if effectiveIcon}
    <i class={cn("bx text-sm leading-none shrink-0", effectiveIcon)}></i>
  {/if}
  <span>{@render children?.()}</span>
</div>

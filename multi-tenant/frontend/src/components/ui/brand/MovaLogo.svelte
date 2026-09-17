<script lang="ts">
  import { cn } from "$lib/utils";

  export type LogoSize = "sm" | "md" | "lg" | "xl" | "2xl";
  export type LogoVariant = "full" | "mark-only" | "compact";

  interface MovaLogoProps {
    size?: LogoSize;
    variant?: LogoVariant;
    class?: string;
  }

  let {
    size = "md",
    variant = "full",
    class: className = "",
  }: MovaLogoProps = $props();

  const sizeClasses: Record<LogoSize, { text: string; dot: string }> = {
    sm: { text: "text-xl", dot: "text-[#FF634A]" },
    md: { text: "text-3xl", dot: "text-[#FF634A]" },
    lg: { text: "text-4xl", dot: "text-[#FF634A]" },
    xl: { text: "text-5xl", dot: "text-[#FF634A]" },
    "2xl": { text: "text-7xl", dot: "text-[#FF634A]" },
  };

  const cfg = $derived(sizeClasses[size] || sizeClasses.md);
</script>

<div class={cn("inline-flex items-baseline select-none font-heading font-black tracking-[-0.035em]", className)}>
  <span class={cn("text-white leading-none font-black", cfg.text)}>
    Mova<span class={cn(cfg.dot, "inline-block ml-[0.5px]")}>.</span>
  </span>
</div>

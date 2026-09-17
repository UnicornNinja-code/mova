<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "pill-primary" | "pill-outline";
  type ButtonSize = "default" | "sm" | "lg" | "icon";

  interface ButtonProps extends HTMLButtonAttributes {
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
    children?: Snippet;
  }

  let {
    variant = "default",
    size = "default",
    class: className = "",
    type = "button",
    disabled = false,
    children,
    ...restProps
  }: ButtonProps = $props();

  const variantClasses: Record<ButtonVariant, string> = {
    // Signature MOVA Orange Gradient with Boxicons-grade shine reflection
    default: "relative overflow-hidden bg-gradient-to-b from-[#FF755E] via-[#FF634A] to-[#D9442C] text-white font-semibold border border-white/20 shadow-lg shadow-[#FF634A]/30 hover:brightness-110 active:brightness-95 active:scale-[0.98] before:content-[''] before:absolute before:top-[-10px] before:left-[-100px] before:w-[80px] before:h-[70px] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:opacity-0 hover:before:opacity-100 hover:before:[animation:shine_0.85s_ease-in-out]",
    
    // Pill-shaped Primary (Boxicons Get Started Style)
    "pill-primary": "relative overflow-hidden rounded-full bg-gradient-to-b from-[#FF755E] via-[#FF634A] to-[#D9442C] text-white font-semibold border border-white/25 shadow-lg shadow-[#FF634A]/35 hover:brightness-110 active:scale-[0.98] before:content-[''] before:absolute before:top-[-10px] before:left-[-100px] before:w-[80px] before:h-[70px] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:opacity-0 hover:before:opacity-100 hover:before:[animation:shine_0.85s_ease-in-out]",
    
    // Pill-shaped Outline Glass
    "pill-outline": "rounded-full border border-white/15 bg-white/[0.04] text-[#fafafa] hover:bg-white/[0.08] hover:border-white/30 active:scale-[0.98]",

    // Destructive
    destructive: "bg-gradient-to-b from-[#991b1b] to-[#7f1d1d] border border-red-500/30 text-[#fef2f2] hover:brightness-110 active:scale-[0.98] shadow-sm",

    // Secondary / Outline Glass
    outline: "border border-white/15 bg-white/[0.04] text-[#fafafa] hover:bg-white/[0.08] hover:border-white/25 active:bg-white/[0.02] active:scale-[0.98]",
    secondary: "border border-white/10 bg-[#18181b] text-[#fafafa] hover:border-white/20 hover:bg-[#202024] active:scale-[0.98]",

    // Ghost
    ghost: "bg-transparent text-zinc-300 hover:bg-white/[0.06] hover:text-white active:scale-[0.98]",
    link: "text-[#FF634A] underline-offset-4 hover:underline p-0 h-auto font-normal",
  };

  const sizeClasses: Record<ButtonSize, string> = {
    default: "h-10 px-4 py-2 text-sm rounded-xl",
    sm: "h-8 px-3 text-xs rounded-lg",
    lg: "h-12 px-7 text-base rounded-2xl",
    icon: "h-9 w-9 p-0 rounded-xl flex items-center justify-center",
  };
</script>

<button
  {type}
  {disabled}
  class={cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF634A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b] disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
    variantClasses[variant],
    sizeClasses[size],
    className
  )}
  {...restProps}
>
  {@render children?.()}
</button>

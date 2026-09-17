<script lang="ts">
  import { cn } from "$lib/utils";

  interface SpinnerProps {
    size?: "sm" | "md" | "lg";
    class?: string;
  }

  let { size = "md", class: className = "" }: SpinnerProps = $props();

  const sizeClasses: Record<string, string> = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-3",
  };
</script>

<div
  class={cn(
    "inline-block animate-spin rounded-full border-[#FF634A] border-t-transparent",
    sizeClasses[size],
    className
  )}
  role="status"
  aria-label="loading"
>
  <span class="sr-only">Loading...</span>
</div>

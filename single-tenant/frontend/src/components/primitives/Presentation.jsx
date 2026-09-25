import React from "react";
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

// --- Aspect Ratio ---
export const AspectRatio = AspectRatioPrimitive.Root;

// --- Hover Card ---
export const HoverCard = HoverCardPrimitive.Root;
export const HoverCardTrigger = HoverCardPrimitive.Trigger;

export function HoverCardContent({ className, align = "center", sideOffset = 4, ...props }) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-64 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#111318] p-3 text-slate-800 dark:text-slate-200 shadow-xl outline-none text-xs animate-in fade-in-80",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

// --- Scroll Area ---
export function ScrollArea({ className, children, ...props }) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollBar({ className, orientation = "vertical", ...props }) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-colors",
        orientation === "vertical" && "h-full w-2 border-l border-l-transparent p-[1px]",
        orientation === "horizontal" && "h-2 flex-col border-t border-t-transparent p-[1px]",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-[var(--border-strong)]" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

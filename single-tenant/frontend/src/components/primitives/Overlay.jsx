import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export function TooltipProvider({ children, delayDuration = 200 }) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ content, children, side = "top", align = "center", className }) {
  if (!content) return children;

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={5}
          className={cn(
            "z-50 overflow-hidden rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-900 text-white dark:bg-[#181B22] dark:text-slate-100 px-2.5 py-1 text-xs shadow-md animate-in fade-in-50",
            className
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-slate-900 dark:fill-[#181B22]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({ children, align = "end", sideOffset = 4, className, ...props }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[10rem] overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#111318] p-1.5 text-slate-800 dark:text-slate-200 shadow-xl animate-in fade-in-80",
          className
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ children, icon: Icon, destructive = false, disabled = false, className, onSelect, ...props }) {
  return (
    <DropdownMenuPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-[#181B22] focus:bg-slate-100 dark:focus:bg-[#181B22] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        destructive && "text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] focus:bg-[var(--status-danger-bg)]",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />}
      <span className="flex-1 truncate">{children}</span>
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuSeparator({ className }) {
  return <DropdownMenuPrimitive.Separator className={cn("-mx-1 my-1 h-[1px] bg-slate-200/80 dark:bg-white/5", className)} />;
}

export function DropdownMenuLabel({ children, className }) {
  return <div className={cn("px-2.5 py-1 text-[10px] font-heading font-medium tracking-wider uppercase text-slate-500 dark:text-slate-400", className)}>{children}</div>;
}

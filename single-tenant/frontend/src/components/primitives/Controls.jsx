import React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import * as ToolbarPrimitive from "@radix-ui/react-toolbar";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Radio Group ---
export function RadioGroup({ className, ...props }) {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} />;
}

export function RadioGroupItem({ className, ...props }) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-slate-300 dark:border-white/20 text-[var(--brand-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center bg-white dark:bg-[#111318]",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2 w-2 fill-[var(--brand-primary)] text-[var(--brand-primary)]" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

// --- Slider ---
export function Slider({ className, ...props }) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200 dark:bg-[#181B22]">
        <SliderPrimitive.Range className="absolute h-full bg-[var(--brand-primary)]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-[var(--brand-primary)] bg-white dark:bg-[#111318] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-sm" />
    </SliderPrimitive.Root>
  );
}

// --- Toggle ---
export function Toggle({ className, variant = "default", size = "default", ...props }) {
  const variantStyles = {
    default: "bg-transparent hover:bg-slate-100 dark:hover:bg-[#181B22] text-slate-500 dark:text-slate-400 data-[state=on]:bg-[var(--brand-primary)] data-[state=on]:text-white",
    outline: "border border-slate-200 dark:border-white/10 bg-transparent hover:bg-slate-100 dark:hover:bg-[#181B22] data-[state=on]:border-[var(--brand-primary)] data-[state=on]:bg-[var(--brand-subtle)] data-[state=on]:text-[var(--brand-primary)]",
  };

  const sizeStyles = {
    default: "h-8 px-3 text-xs",
    sm: "h-7 px-2 text-[11px]",
    lg: "h-9 px-4 text-sm",
  };

  return (
    <TogglePrimitive.Root
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        variantStyles[variant] || variantStyles.default,
        sizeStyles[size] || sizeStyles.default,
        className
      )}
      {...props}
    />
  );
}

// --- Toggle Group ---
export const ToggleGroupContext = React.createContext({ size: "default", variant: "default" });

export function ToggleGroup({ className, variant = "default", size = "default", children, ...props }) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn("inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100/80 dark:bg-[#14161D] p-1 border border-slate-200/80 dark:border-white/5", className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

export function ToggleGroupItem({ className, children, variant, size, ...props }) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-white dark:data-[state=on]:bg-[#181B22] data-[state=on]:text-slate-900 dark:data-[state=on]:text-white data-[state=on]:shadow-xs",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

// --- Toolbar ---
export function Toolbar({ className, ...props }) {
  return (
    <ToolbarPrimitive.Root
      className={cn(
        "flex items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#111318] p-1 shadow-xs",
        className
      )}
      {...props}
    />
  );
}

export const ToolbarButton = ToolbarPrimitive.Button;
export const ToolbarSeparator = ({ className, ...props }) => (
  <ToolbarPrimitive.Separator className={cn("mx-1 h-4 w-[1px] bg-[var(--border-subtle)]", className)} {...props} />
);
export const ToolbarToggleGroup = ToolbarPrimitive.ToggleGroup;
export const ToolbarToggleItem = ToolbarPrimitive.ToggleItem;
export const ToolbarLink = ToolbarPrimitive.Link;

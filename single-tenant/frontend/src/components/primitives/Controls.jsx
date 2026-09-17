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
        "aspect-square h-4 w-4 rounded-full border border-[var(--border-strong)] text-[var(--accent-primary)] ring-offset-[var(--background)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center bg-[var(--surface)]",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2 w-2 fill-[var(--accent-primary)] text-[var(--accent-primary)]" />
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
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
        <SliderPrimitive.Range className="absolute h-full bg-[var(--accent-primary)]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-[var(--accent-primary)] bg-[var(--surface)] ring-offset-[var(--background)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-sm hover:scale-110" />
    </SliderPrimitive.Root>
  );
}

// --- Toggle ---
export function Toggle({ className, variant = "default", size = "default", ...props }) {
  const variantStyles = {
    default: "bg-transparent hover:bg-[var(--surface-raised)] text-[var(--text-secondary)] data-[state=on]:bg-[var(--accent-primary)] data-[state=on]:text-white",
    outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--surface-raised)] data-[state=on]:border-[var(--accent-primary)] data-[state=on]:bg-[var(--accent-primary)]/10 data-[state=on]:text-[var(--accent-primary)]",
  };

  const sizeStyles = {
    default: "h-8 px-3 text-xs",
    sm: "h-7 px-2 text-[11px]",
    lg: "h-9 px-4 text-sm",
  };

  return (
    <TogglePrimitive.Root
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
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
      className={cn("inline-flex items-center justify-center gap-1 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] p-1 border border-[var(--border-subtle)]", className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

export function ToggleGroupItem({ className, children, variant, size, ...props }) {
  const context = React.useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-[var(--surface)] data-[state=on]:text-[var(--text-primary)] data-[state=on]:shadow-xs",
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
        "flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xs",
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

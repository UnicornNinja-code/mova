import React from "react";
import { cn } from "@/lib/utils";

const gapMap = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
};

export function Stack({ children, gap = "md", align = "stretch", justify = "start", className, as: Component = "div", ...props }) {
  return (
    <Component
      className={cn(
        "flex flex-col",
        gapMap[gap] || "gap-4",
        align === "start" && "items-start",
        align === "center" && "items-center",
        align === "end" && "items-end",
        align === "stretch" && "items-stretch",
        justify === "start" && "justify-start",
        justify === "center" && "justify-center",
        justify === "end" && "justify-end",
        justify === "between" && "justify-between",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Inline({ children, gap = "md", align = "center", justify = "start", wrap = false, className, as: Component = "div", ...props }) {
  return (
    <Component
      className={cn(
        "flex flex-row",
        wrap && "flex-wrap",
        gapMap[gap] || "gap-4",
        align === "start" && "items-start",
        align === "center" && "items-center",
        align === "end" && "items-end",
        align === "baseline" && "items-baseline",
        justify === "start" && "justify-start",
        justify === "center" && "justify-center",
        justify === "end" && "justify-end",
        justify === "between" && "justify-between",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Grid({ children, cols = 1, gap = "md", className, as: Component = "div", ...props }) {
  const colsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
    12: "grid-cols-12",
  }[cols] || "grid-cols-1";

  return (
    <Component className={cn("grid", colsClass, gapMap[gap] || "gap-4", className)} {...props}>
      {children}
    </Component>
  );
}

export function Divider({ orientation = "horizontal", className, ...props }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "bg-[var(--border-subtle)]",
        orientation === "horizontal" ? "h-[1px] w-full my-2" : "w-[1px] h-full mx-2 self-stretch",
        className
      )}
      {...props}
    />
  );
}

import React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Accordion ---
export function Accordion({ className, ...props }) {
  return <AccordionPrimitive.Root className={cn("w-full divide-y divide-[var(--border-subtle)]", className)} {...props} />;
}

export function AccordionItem({ className, ...props }) {
  return (
    <AccordionPrimitive.Item
      className={cn("border-b border-[var(--border-subtle)] last:border-b-0", className)}
      {...props}
    />
  );
}

export function AccordionTrigger({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "flex flex-1 items-center justify-between py-3 px-1 text-sm font-medium text-[var(--text-primary)] transition-all hover:text-[var(--accent-primary)] [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 text-[var(--text-muted)]" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        "overflow-hidden text-sm text-[var(--text-secondary)] transition-all data-[data-state=closed]:animate-accordion-up data-[data-state=open]:animate-accordion-down",
        className
      )}
      {...props}
    >
      <div className="pb-3 pt-0">{children}</div>
    </AccordionPrimitive.Content>
  );
}

// --- Collapsible ---
export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;
export const CollapsibleContent = CollapsiblePrimitive.Content;

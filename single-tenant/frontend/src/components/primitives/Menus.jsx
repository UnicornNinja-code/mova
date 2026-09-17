import React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import * as MenubarPrimitive from "@radix-ui/react-menubar";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { ChevronRight, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Context Menu ---
export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuGroup = ContextMenuPrimitive.Group;
export const ContextMenuPortal = ContextMenuPrimitive.Portal;
export const ContextMenuSub = ContextMenuPrimitive.Sub;
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

export function ContextMenuContent({ className, ...props }) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          "z-50 min-w-[160px] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--text-primary)] shadow-md animate-in fade-in-80 text-xs",
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

export function ContextMenuItem({ className, inset, ...props }) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-xs px-2 py-1.5 text-xs outline-none transition-colors hover:bg-[var(--surface-raised)] focus:bg-[var(--surface-raised)] focus:text-[var(--text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

export function ContextMenuSeparator({ className, ...props }) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-[1px] bg-[var(--border-subtle)]", className)}
      {...props}
    />
  );
}

// --- Menubar ---
export function Menubar({ className, ...props }) {
  return (
    <MenubarPrimitive.Root
      className={cn(
        "flex h-9 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xs text-xs",
        className
      )}
      {...props}
    />
  );
}

export const MenubarMenu = MenubarPrimitive.Menu;
export const MenubarGroup = MenubarPrimitive.Group;
export const MenubarPortal = MenubarPrimitive.Portal;
export const MenubarSub = MenubarPrimitive.Sub;
export const MenubarRadioGroup = MenubarPrimitive.RadioGroup;

export function MenubarTrigger({ className, ...props }) {
  return (
    <MenubarPrimitive.Trigger
      className={cn(
        "flex cursor-pointer select-none items-center rounded-xs px-2.5 py-1 text-xs font-medium outline-none hover:bg-[var(--surface-raised)] focus:bg-[var(--surface-raised)] focus:text-[var(--text-primary)] data-[state=open]:bg-[var(--surface-raised)] data-[state=open]:text-[var(--text-primary)] text-[var(--text-secondary)]",
        className
      )}
      {...props}
    />
  );
}

export function MenubarContent({ className, align = "start", alignOffset = -4, sideOffset = 8, ...props }) {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[160px] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--text-primary)] shadow-md animate-in fade-in-80 text-xs",
          className
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  );
}

export function MenubarItem({ className, inset, ...props }) {
  return (
    <MenubarPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-xs px-2 py-1.5 text-xs outline-none hover:bg-[var(--surface-raised)] focus:bg-[var(--surface-raised)] focus:text-[var(--text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

export function MenubarSeparator({ className, ...props }) {
  return (
    <MenubarPrimitive.Separator
      className={cn("-mx-1 my-1 h-[1px] bg-[var(--border-subtle)]", className)}
      {...props}
    />
  );
}

// --- Navigation Menu ---
export function NavigationMenu({ className, children, ...props }) {
  return (
    <NavigationMenuPrimitive.Root
      className={cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className)}
      {...props}
    >
      {children}
      <NavigationMenuViewport />
    </NavigationMenuPrimitive.Root>
  );
}

export function NavigationMenuList({ className, ...props }) {
  return (
    <NavigationMenuPrimitive.List
      className={cn("group flex flex-1 list-none items-center justify-center gap-1", className)}
      {...props}
    />
  );
}

export const NavigationMenuItem = NavigationMenuPrimitive.Item;

export function NavigationMenuTrigger({ className, children, ...props }) {
  return (
    <NavigationMenuPrimitive.Trigger
      className={cn(
        "group inline-flex h-9 w-max items-center justify-center rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus:bg-[var(--surface-raised)] focus:text-[var(--text-primary)] focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-[var(--surface-raised)] data-[state=open]:bg-[var(--surface-raised)]",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight
        className="relative top-[1px] ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-90"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  );
}

export function NavigationMenuContent({ className, ...props }) {
  return (
    <NavigationMenuPrimitive.Content
      className={cn(
        "left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto",
        className
      )}
      {...props}
    />
  );
}

export const NavigationMenuLink = NavigationMenuPrimitive.Link;

export function NavigationMenuViewport({ className, ...props }) {
  return (
    <div className={cn("absolute left-0 top-full flex justify-center")}>
      <NavigationMenuPrimitive.Viewport
        className={cn(
          "origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-lg md:w-[var(--radix-navigation-menu-viewport-width)]",
          className
        )}
        {...props}
      />
    </div>
  );
}

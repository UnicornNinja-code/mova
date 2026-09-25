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
          "z-50 min-w-[160px] overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#111318] p-1.5 text-slate-800 dark:text-slate-200 shadow-xl animate-in fade-in-80 text-xs",
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
        "relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors hover:bg-slate-100 dark:hover:bg-[#181B22] focus:bg-slate-100 dark:focus:bg-[#181B22] focus:text-[var(--brand-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
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
      className={cn("-mx-1 my-1 h-[1px] bg-slate-200/80 dark:bg-white/5", className)}
      {...props}
    />
  );
}

// --- Menubar ---
export function Menubar({ className, ...props }) {
  return (
    <MenubarPrimitive.Root
      className={cn(
        "flex h-9 items-center gap-1 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#111318] p-1 shadow-xs text-xs",
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
        "flex cursor-pointer select-none items-center rounded-lg px-2.5 py-1 text-xs font-medium outline-none hover:bg-slate-100 dark:hover:bg-[#181B22] focus:bg-slate-100 dark:focus:bg-[#181B22] focus:text-[var(--brand-primary)] data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-[#181B22] data-[state=open]:text-[var(--brand-primary)] text-slate-600 dark:text-slate-400 transition-colors",
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
          "z-50 min-w-[160px] overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#111318] p-1.5 text-slate-800 dark:text-slate-200 shadow-xl animate-in fade-in-80 text-xs",
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
        "relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-xs outline-none hover:bg-slate-100 dark:hover:bg-[#181B22] focus:bg-slate-100 dark:focus:bg-[#181B22] focus:text-[var(--brand-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors",
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
      className={cn("-mx-1 my-1 h-[1px] bg-slate-200/80 dark:bg-white/5", className)}
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
        "group inline-flex h-9 w-max items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-[#181B22] hover:text-slate-900 dark:hover:text-slate-100 focus:bg-slate-100 dark:focus:bg-[#181B22] focus:text-[var(--brand-primary)] focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-slate-100 dark:data-[active]:bg-[#181B22] data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-[#181B22]",
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
          "origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#111318] text-slate-800 dark:text-slate-200 shadow-xl md:w-[var(--radix-navigation-menu-viewport-width)]",
          className
        )}
        {...props}
      />
    </div>
  );
}

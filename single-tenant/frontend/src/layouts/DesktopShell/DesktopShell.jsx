import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Sheet, SheetContent } from "@/components/primitives";
import { cn } from "@/lib/utils";

export function DesktopShell({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)]">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block h-full">
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" title="MOVA Control Room" width="sm" className="p-0">
          <Sidebar className="border-r-0 w-full h-full" />
        </SheetContent>
      </Sheet>

      {/* Main Workspace Layout */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        <Header onMobileMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[var(--background)]">
          {children}
        </main>
      </div>
    </div>
  );
}

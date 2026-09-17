import React, { useState, useEffect } from "react";
import { Search, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Button, IconButton } from "@/components/primitives";

export function SearchInput({
  value = "",
  onChange,
  onSearch,
  placeholder = "Cari data...",
  debounceMs = 300,
  className,
}) {
  const [internalVal, setInternalVal] = useState(value);

  useEffect(() => {
    setInternalVal(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (onChange && internalVal !== value) {
        onChange(internalVal);
      }
    }, debounceMs);
    return () => clearTimeout(handler);
  }, [internalVal, debounceMs, onChange, value]);

  const handleClear = () => {
    setInternalVal("");
    if (onChange) onChange("");
  };

  return (
    <div className={cn("relative flex items-center min-w-[200px] w-full max-w-sm", className)}>
      <Search className="absolute left-3 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
      <Input
        value={internalVal}
        onChange={(e) => setInternalVal(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8"
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSearch) {
            onSearch(internalVal);
          }
        }}
      />
      {internalVal && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 p-0.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Bersihkan pencarian"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function FilterBar({ children, onReset, className }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-[var(--radius-sm)] mb-4", className)}>
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">{children}</div>
      {onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} leadingIcon={RotateCcw} className="text-xs">
          Reset Filter
        </Button>
      )}
    </div>
  );
}

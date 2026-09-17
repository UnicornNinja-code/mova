/*
 * setup.ts
 * Svelte 5 Runes Polyfill for Test Environment
 */

// Shim Svelte 5 Runes for non-compiler Node/Bun CLI runtime
if (typeof (globalThis as any).$state === "undefined") {
  const stateFn: any = (initialValue: any) => initialValue;
  stateFn.raw = (v: any) => v;
  stateFn.snapshot = (v: any) => v;
  (globalThis as any).$state = stateFn;
}

if (typeof (globalThis as any).$derived === "undefined") {
  const derivedFn: any = (expr: any) => expr;
  derivedFn.by = (fn: () => any) => {
    return fn();
  };
  (globalThis as any).$derived = derivedFn;
}

if (typeof (globalThis as any).$effect === "undefined") {
  const effectFn: any = (fn: () => any) => {};
  effectFn.pre = (fn: () => any) => {};
  effectFn.root = (fn: () => any) => fn();
  (globalThis as any).$effect = effectFn;
}

if (typeof (globalThis as any).$props === "undefined") {
  (globalThis as any).$props = () => ({});
}

if (typeof (globalThis as any).$bindable === "undefined") {
  (globalThis as any).$bindable = (init?: any) => init;
}

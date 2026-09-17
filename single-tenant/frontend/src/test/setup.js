import "@testing-library/jest-dom";

// Polyfill ResizeObserver for Radix UI (Slider, ScrollArea) in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

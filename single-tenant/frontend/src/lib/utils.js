import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines Tailwind classes with clsx conditionals and resolves class conflicts via twMerge
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

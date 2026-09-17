import Button from "./Button.svelte";

export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  | "pill-primary"
  | "pill-outline";

export type ButtonSize = "default" | "sm" | "lg" | "icon";

export { Button };
export default Button;

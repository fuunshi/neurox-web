import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditional classes with conflicting Tailwind utilities resolved by last-one-
 * wins, so a component's `className` prop can always override its defaults
 * without `!important` or specificity games.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

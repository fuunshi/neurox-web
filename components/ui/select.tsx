"use client";

import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { controlStyles, fieldControlProps, useFieldContext } from "./field";

/**
 * A native `<select>`.
 *
 * Not a listbox reimplementation: the platform control already handles keyboard
 * navigation, type-ahead, mobile pickers and screen-reader semantics, and a
 * custom one gets those wrong far more often than it improves the look.
 */
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const field = useFieldContext();

  return (
    <select
      {...fieldControlProps(field)}
      {...props}
      className={cn(controlStyles({ invalid: field?.invalid }), "h-10 pr-8", className)}
    >
      {children}
    </select>
  );
}

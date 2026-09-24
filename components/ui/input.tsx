"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { controlStyles, fieldControlProps, useFieldContext } from "./field";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Marks the control invalid when used outside a `Field`. Inside one, the
   *  Field's `error` prop decides. */
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <input
      {...fieldControlProps(field)}
      {...props}
      aria-invalid={isInvalid || undefined}
      className={cn(controlStyles({ invalid: isInvalid }), "h-10", className)}
    />
  );
}

"use client";

import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { controlStyles, fieldControlProps, useFieldContext } from "./field";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, rows = 6, ...props }: TextareaProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <textarea
      {...fieldControlProps(field)}
      {...props}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      className={cn(
        controlStyles({ invalid: isInvalid }),
        // Long-form inputs read better with a little leading; `resize-y` keeps
        // the author in control of height without allowing width breakage.
        "resize-y py-2 leading-relaxed",
        className,
      )}
    />
  );
}

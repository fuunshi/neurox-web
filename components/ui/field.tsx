"use client";

import { createContext, use, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface FieldContextValue {
  id: string;
  /** Space-separated ids for `aria-describedby`, or undefined when there is
   *  nothing to describe. */
  describedBy: string | undefined;
  invalid: boolean;
  disabled: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Lets a control wire itself to its label and error message without the caller
 * threading ids around. Returns null outside a `Field`, so `Input` and
 * `Textarea` also work standalone in a toolbar or a filter bar.
 */
export function useFieldContext(): FieldContextValue | null {
  return use(FieldContext);
}

export interface FieldProps {
  label: string;
  /** Rendered under the control in muted text, before any error. */
  hint?: ReactNode;
  /**
   * `string[]` is the shape class-validator produces when several rules fail on
   * one property, so it is accepted here rather than flattened at every call
   * site.
   */
  error?: string | string[] | null;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const errors = normalizeErrors(error);
  const describedBy =
    [hint ? hintId : null, errors.length > 0 ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <FieldContext
      value={{ id, describedBy, invalid: errors.length > 0, disabled }}
    >
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {/* Visual marker only — `required` on the control is what announces
              it. Annotating the optional fields too would be so much noise on
              a form like registration that neither marker would register. */}
          {required ? (
            <span className="ml-1 text-due-fg" aria-hidden>
              *
            </span>
          ) : null}
        </label>

        {children}

        {hint ? (
          <p id={hintId} className="text-sm text-ink-subtle">
            {hint}
          </p>
        ) : null}

        {errors.length > 0 ? (
          <div id={errorId} className="text-sm text-danger-fg">
            {errors.length === 1 ? (
              <p>{errors[0]}</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </FieldContext>
  );
}

/** Trims, drops empties, and de-duplicates so the same complaint is not shown
 *  twice when the client and server agree. */
export function normalizeErrors(
  error: string | string[] | null | undefined,
): string[] {
  if (!error) return [];
  const list = Array.isArray(error) ? error : [error];
  return [...new Set(list.map((item) => item.trim()).filter(Boolean))];
}

/** Shared control styling, so `Input`, `Textarea` and `Select` stay in step. */
export function controlStyles({
  invalid,
  className,
}: {
  invalid?: boolean;
  className?: string;
} = {}): string {
  return cn(
    "w-full rounded-md border bg-surface px-3 text-ink",
    "placeholder:text-ink-subtle",
    "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-muted",
    invalid
      ? "border-danger focus-visible:outline-danger"
      : "border-line-strong",
    className,
  );
}

/**
 * Props a control needs from the enclosing `Field`, if there is one. Spread
 * onto the input: `<input {...fieldControlProps(field)} />`.
 */
export function fieldControlProps(
  field: FieldContextValue | null,
  explicit?: { id?: string },
) {
  if (!field) return { id: explicit?.id };
  return {
    id: explicit?.id ?? field.id,
    "aria-describedby": field.describedBy,
    "aria-invalid": field.invalid || undefined,
    disabled: field.disabled,
  };
}

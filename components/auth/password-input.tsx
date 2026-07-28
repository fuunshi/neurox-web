"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";

/**
 * A password field with a reveal toggle.
 *
 * The toggle is a real button with an `aria-pressed` state and a label that
 * changes, not an icon with a tooltip: it is the difference between typing a
 * long password blind and not, and on a phone the reveal is often the only way
 * to check what was typed.
 */
export function PasswordInput({
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className="pr-[4.5rem]"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 my-auto mr-1 h-8 cursor-pointer rounded-sm px-2.5 text-sm text-ink-muted hover:text-ink"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

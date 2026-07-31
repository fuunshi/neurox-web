"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";

/**
 * A modal built on the native `<dialog>` element.
 *
 * Deliberately not a hand-rolled portal: `showModal()` already provides focus
 * trapping, `Esc` to close, inertness of the page behind, and a `::backdrop`.
 * Reimplementing those is how dialogs end up dropping keyboard support.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  pending = false,
  destructive = false,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  destructive?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    // `close()` also fires `cancel` on Esc; both paths land here.
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Esc fires `cancel` then `close`; treating both as a cancel keeps the
      // parent's state in step with the element.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClose={onCancel}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/45"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 className="text-lg">{title}</h2>
        <div className="text-ink-muted">{description}</div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

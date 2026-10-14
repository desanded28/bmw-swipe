import { useEffect, useRef } from "react";

/**
 * The dashboard's overlays as native modal <dialog>s (WP2): the appointment and new-appointment
 * drawers, the "Move appointment?" confirmation, and the care overlays (WP8's medical-history
 * sheet and rebooking drawer) that open on top of them. showModal() puts the dialog in the
 * browser's top layer, above any dialog already open, makes everything else inert, keeps focus
 * inside and turns Escape into a "cancel" event.
 *
 * Kept in its own module (not in AppointmentDrawer.tsx) so the care components the drawer renders
 * can use it without an import cycle. The helpers take the few dialog members they use, so they
 * can be tested without a DOM.
 */

/** What the helpers use of an HTMLDialogElement. */
export type ModalDialog = Pick<HTMLDialogElement, "open" | "showModal" | "show" | "close" | "matches" | "querySelector">;

type CancelEvent = { preventDefault(): void; stopPropagation(): void };
type ClickEvent = { target: unknown; currentTarget: unknown };

/** Class names of a drawer docked to the right edge (a native <dialog>). */
export const DRAWER_DIALOG =
  "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[460px] overflow-hidden bg-white p-0 text-ink shadow-pop backdrop:bg-slate-900/30 open:animate-slide-in";

/** Open as a modal (unless already open) and focus the element marked data-autofocus. */
export function openModal(dialog: ModalDialog): void {
  if (!dialog.open) dialog.showModal();
  dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
}

/**
 * Escape: the browser fires "cancel" on the topmost modal only, but React passes the event on to
 * the dialogs around it in the component tree (a sheet's Escape would close the drawer under it
 * too). Stop it here, and let the owner unmount us instead of the dialog closing itself.
 */
export function handleCancel(e: CancelEvent, close: () => void): void {
  e.preventDefault();
  e.stopPropagation();
  close();
}

/**
 * A click on the backdrop targets the <dialog> itself (its content fills the box): close. A dialog
 * around this one in the component tree sees the click with another target, and stays.
 */
export function handleBackdropClick(e: ClickEvent, close: () => void): void {
  if (e.target === e.currentTarget) close();
}

function isModal(dialog: ModalDialog): boolean {
  try {
    return dialog.matches(":modal");
  } catch {
    return dialog.open; // a browser without :modal
  }
}

/**
 * Printing: a modal dialog stays in the top layer, where browsers print only what fits the first
 * page. Re-open it as a plain dialog for the print, so it flows over as many pages as it needs;
 * the returned function puts the modal back afterwards. Null when there was nothing to do.
 */
export function modalForPrint(dialog: ModalDialog): (() => void) | null {
  if (!dialog.open || !isModal(dialog)) return null;
  dialog.close();
  dialog.show();
  return () => {
    if (dialog.open) dialog.close();
    dialog.showModal();
  };
}

export type ModalDialogOptions = {
  /** When the element that opened the dialog was re-rendered away meanwhile, this finds its replacement. */
  fallbackSelector?: string;
  /** Print the dialog's whole content (see modalForPrint). */
  printable?: boolean;
};

/**
 * Open a native <dialog> as a modal while the component is mounted, and give focus back to
 * whatever opened it when it goes away. Spread `props` on the <dialog>.
 */
export function useModalDialog(onClose: () => void, opts: ModalDialogOptions = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  const { fallbackSelector } = opts;
  const printable = Boolean(opts.printable);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && !dialog.contains(active) ? active : null;
    openModal(dialog);
    let restore: (() => void) | null = null;
    const before = () => {
      restore = modalForPrint(dialog);
    };
    const after = () => {
      restore?.();
      restore = null;
    };
    if (printable) {
      window.addEventListener("beforeprint", before);
      window.addEventListener("afterprint", after);
    }
    return () => {
      if (printable) {
        window.removeEventListener("beforeprint", before);
        window.removeEventListener("afterprint", after);
      }
      if (dialog.open) dialog.close();
      requestAnimationFrame(() => {
        const target = opener?.isConnected ? opener : fallbackSelector ? document.querySelector<HTMLElement>(fallbackSelector) : null;
        target?.focus();
      });
    };
  }, [fallbackSelector, printable]);
  return {
    ref,
    props: {
      onCancel: (e: React.SyntheticEvent<HTMLDialogElement>) => handleCancel(e, close.current),
      onClick: (e: React.MouseEvent<HTMLDialogElement>) => handleBackdropClick(e, close.current),
    },
  };
}

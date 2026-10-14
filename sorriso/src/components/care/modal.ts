import { useEffect, useRef } from "react";

/**
 * The care overlays (the medical-history sheet, the "Rebook N patients" drawer) as native modal
 * <dialog>s, like WP2's useModalDialog: showModal() puts the dialog in the browser's top layer,
 * above any dialog already open (the appointment drawer is one), makes everything else inert,
 * keeps focus inside and turns Escape into a "cancel" event. A <div role="dialog"> rendered
 * elsewhere would sit behind an open modal dialog, inert and unreachable.
 *
 * The helpers below take the few dialog members they use, so they can be tested without a DOM.
 */

/** What the helpers use of an HTMLDialogElement. */
export type ModalDialog = Pick<HTMLDialogElement, "open" | "showModal" | "show" | "close" | "matches" | "querySelector">;

type CancelEvent = { preventDefault(): void; stopPropagation(): void };
type ClickEvent = { target: unknown; currentTarget: unknown };

/** Open as a modal (unless already open) and focus the element marked data-autofocus. */
export function openModal(dialog: ModalDialog): void {
  if (!dialog.open) dialog.showModal();
  dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
}

/**
 * Escape: the browser fires "cancel" on the topmost modal only, but React passes the event on to
 * the dialogs around it in the component tree (the appointment drawer would close too). Stop it
 * here and let the owner unmount us instead of the dialog closing itself.
 */
export function handleCancel(e: CancelEvent, close: () => void): void {
  e.preventDefault();
  e.stopPropagation();
  close();
}

/**
 * A click on the backdrop targets the <dialog> itself (its content fills the box): close. (A
 * dialog around this one in the component tree sees the click with another target: it stays.)
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

/**
 * Open a native <dialog> as a modal while the component is mounted, and give focus back to
 * whatever opened it when it goes away. Spread `props` on the <dialog>.
 */
export function useNativeModal(onClose: () => void, opts: { printable?: boolean } = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
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
        if (opener?.isConnected) opener.focus();
      });
    };
  }, [printable]);
  return {
    ref,
    props: {
      onCancel: (e: React.SyntheticEvent<HTMLDialogElement>) => handleCancel(e, close.current),
      onClick: (e: React.MouseEvent<HTMLDialogElement>) => handleBackdropClick(e, close.current),
    },
  };
}

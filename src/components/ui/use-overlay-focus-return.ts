import { useRef } from "react";

/** Controlled overlays may open without a Radix Trigger. Remember the real
 * initiating control so closing them doesn't strand keyboard focus on the body. */
export function useOverlayFocusReturn(
  onOpen?: (event: Event) => void,
  onClose?: (event: Event) => void,
) {
  const origin = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus(event: Event) {
      origin.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpen?.(event);
    },
    onCloseAutoFocus(event: Event) {
      onClose?.(event);
      const target = origin.current;
      // Respect explicit caller handling and never focus stale/hidden account or route UI.
      if (
        event.defaultPrevented ||
        !target?.isConnected ||
        target === document.body ||
        !target.getClientRects().length ||
        target.matches(":disabled") ||
        target.closest('[inert], [aria-hidden="true"]')
      )
        return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    },
  };
}

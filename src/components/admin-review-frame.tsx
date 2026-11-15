import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AdminEditorDrawer } from "./admin-editor-drawer";
import { Button } from "./ui/button";

const desktopQuery = "(min-width: 1280px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const desktopSnapshot = () => window.matchMedia(desktopQuery).matches;

/** One review controller owns both presentations. Desktop is a non-modal pane so
 * staff can consult the queue; smaller screens keep the existing focus-trapped sheet.
 * Resizing may remount fields, but their values and retry identity live above this frame. */
export function AdminReviewFrame({
  open,
  close,
  locked,
  title,
  description,
  children,
  claimId,
}: {
  open: boolean;
  close: () => void;
  locked: boolean;
  title: string;
  description: string;
  children: ReactNode;
  claimId: string;
}) {
  const docked = useSyncExternalStore(subscribe, desktopSnapshot, () => false);
  const { locale } = useI18n();
  const titleId = useId(),
    descriptionId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const pane = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    const frame = requestAnimationFrame(() => {
      if (open && docked) {
        // An inline panel begins below the queue filters. Bring it into the
        // viewport on open/resize; a fixed sheet did not need document scrolling.
        pane.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
        heading.current?.focus({ preventScroll: true });
      }
      // Return to the visible mobile/card or desktop/table action. This also works
      // after crossing a breakpoint; hidden or stale account controls are ignored.
      if (closed && docked && !document.querySelector("[data-docked-review]")) {
        const controls = document.querySelectorAll<HTMLButtonElement>(
          `[data-claim-opener="${CSS.escape(claimId)}"]`,
        );
        [...controls]
          .find((control) => !control.disabled && control.getClientRects().length)
          ?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, docked, claimId, locale]);

  if (!docked)
    return (
      <AdminEditorDrawer
        open={open}
        close={close}
        locked={locked}
        title={title}
        description={description}
      >
        {children}
      </AdminEditorDrawer>
    );
  if (!open) return null;
  return (
    <section
      ref={pane}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-docked-review
      className="flex min-w-0 max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-20"
      onKeyDown={(event) => {
        // Confirmation dialogs render in portals: their Escape must not close this pane.
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          !event.currentTarget.contains(event.target as Node)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (!locked) close();
      }}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-background/40 p-4">
        <div className="min-w-0">
          <h2
            id={titleId}
            ref={heading}
            tabIndex={-1}
            className="break-words font-heading text-base font-semibold focus:outline-none"
          >
            {title}
          </h2>
          <p id={descriptionId} className="mt-1 break-words text-xs text-muted-foreground">
            {description}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={locked}
          onClick={close}
          aria-label={locale === "ar" ? "إغلاق" : "Close"}
        >
          <X aria-hidden className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 space-y-4 overflow-y-auto p-4">{children}</div>
    </section>
  );
}

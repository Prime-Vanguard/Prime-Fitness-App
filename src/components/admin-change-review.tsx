import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export type AdminReview = {
  title: string;
  description: string;
  details: ReactNode;
  save: () => Promise<void>;
};
export function AdminChangeReview({
  review,
  close,
}: {
  review: AdminReview | null;
  close: () => void;
}) {
  const { locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  async function confirm() {
    if (!review || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await review.save();
      close();
    } catch (failure) {
      setError(
        (failure as Error).message ||
          l("Save failed. Your changes are retained.", "تعذر الحفظ. تم الاحتفاظ بتغييراتك."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet
      open={!!review}
      onOpenChange={(open) => {
        if (!open && !lock.current) {
          setError("");
          close();
        }
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto rounded-t-2xl"
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="mx-auto max-w-xl space-y-5" aria-busy={busy}>
          <SheetHeader>
            <SheetTitle>{review?.title}</SheetTitle>
            <SheetDescription className="break-words">{review?.description}</SheetDescription>
          </SheetHeader>
          {review?.details}
          {error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError("");
                close();
              }}
            >
              {l("Keep editing", "متابعة التعديل")}
            </Button>
            <Button disabled={busy} onClick={() => void confirm()}>
              {busy ? "…" : l("Confirm changes", "تأكيد التغييرات")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

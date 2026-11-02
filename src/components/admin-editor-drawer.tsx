import { useEffect, useRef, type ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function AdminEditorDrawer({
  open,
  close,
  locked,
  title,
  description,
  children,
}: {
  open: boolean;
  close: () => void;
  locked: boolean;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { locale } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null),
    content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (content.current) content.current.scrollTop = 0;
      heading.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, locale]);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !locked) close();
      }}
    >
      <SheetContent
        ref={content}
        side={locale === "ar" ? "left" : "right"}
        className="w-full overflow-y-auto sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (content.current) content.current.scrollTop = 0;
          heading.current?.focus({ preventScroll: true });
        }}
        onInteractOutside={(event) => {
          if (locked) event.preventDefault();
        }}
      >
        <SheetHeader>
          <SheetTitle ref={heading} tabIndex={-1} className="break-words">
            {title}
          </SheetTitle>
          <SheetDescription className="break-words">{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
export function AdminDraftWarning({ dirty }: { dirty: boolean }) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => dirty && current.pathname !== next.pathname,
    withResolver: true,
    enableBeforeUnload: () => dirty,
  });
  return (
    <AlertDialog
      open={blocker.status === "blocked"}
      onOpenChange={(next) => {
        if (!next && blocker.status === "blocked") blocker.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {l("Unsaved admin drafts", "مسودات إدارية غير محفوظة")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {l(
              "Leaving discards this page’s unsaved drafts. An uncertain request may already be saved; retry the same request before leaving.",
              "المغادرة تزيل مسودات هذه الصفحة غير المحفوظة. قد يكون الطلب ذو الاستجابة غير المؤكدة قد حُفظ بالفعل؛ أعد محاولة الطلب نفسه قبل المغادرة.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{l("Keep editing", "متابعة التعديل")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (blocker.status === "blocked") blocker.proceed();
            }}
          >
            {l("Discard and continue", "إزالة المسودات والمتابعة")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

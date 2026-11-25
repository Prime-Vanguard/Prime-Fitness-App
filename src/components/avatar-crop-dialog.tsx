import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { normalizePhoto } from "@/lib/photo-files";

// Preview and frame a normalized photo locally; upload only after confirmation.
export function AvatarCropDialog({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void>;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [image, setImage] = useState<{ bitmap: ImageBitmap; url: string } | null>(null);
  const [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    x: number;
    y: number;
    zoom: number;
    left: number;
    top: number;
    side: number;
    distance: number;
  } | null>(null);
  useEffect(() => {
    let alive = true,
      url = "";
    let bitmap: ImageBitmap | undefined;
    void (async () => {
      try {
        const normalized = await normalizePhoto(file);
        if (!alive) return;
        bitmap = await createImageBitmap(normalized);
        if (!alive) {
          bitmap.close();
          return;
        }
        url = URL.createObjectURL(normalized);
        setImage({ bitmap, url });
      } catch (cause) {
        if (alive)
          setError(
            l(
              (cause as Error).message,
              "تعذر تجهيز الصورة. اختر صورة مدعومة بحجم أقل من 10 ميجابايت.",
            ),
          );
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      bitmap?.close();
    };
    // The dialog is keyed by file. Locale changes do not discard framing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);
  // Convert the position sliders and zoom into a square in source-image coordinates.
  const side = image ? Math.min(image.bitmap.width, image.bitmap.height) / zoom : 1;
  const left = image ? ((image.bitmap.width - side) * x) / 100 : 0;
  const top = image ? ((image.bitmap.height - side) * y) / 100 : 0;
  function baseline() {
    const points = [...pointers.current.values()];
    gesture.current = points[0]
      ? {
          x: points[0].x,
          y: points[0].y,
          zoom,
          left,
          top,
          side,
          distance: points[1]
            ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
            : 0,
        }
      : null;
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (pending || !image || !pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()],
      start = gesture.current;
    if (points.length === 2 && start.distance > 0) {
      setZoom(
        Math.max(
          1,
          Math.min(
            3,
            (start.zoom * Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y)) /
              start.distance,
          ),
        ),
      );
    } else if (points.length === 1) {
      const scale = start.side / event.currentTarget.getBoundingClientRect().width;
      const clamp = (n: number) => Math.max(0, Math.min(100, n));
      if (image.bitmap.width > start.side)
        setX(
          clamp(
            ((start.left - (event.clientX - start.x) * scale) / (image.bitmap.width - start.side)) *
              100,
          ),
        );
      if (image.bitmap.height > start.side)
        setY(
          clamp(
            ((start.top - (event.clientY - start.y) * scale) / (image.bitmap.height - start.side)) *
              100,
          ),
        );
    }
  }
  async function confirm() {
    if (!image || pending) return;
    setPending(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error(l("Photo editing is unavailable.", "تعديل الصور غير متاح."));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, 512, 512);
      context.drawImage(image.bitmap, left, top, side, side, 0, 0, 512, 512);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error(l("Could not crop this photo.", "تعذر قص الصورة."))),
          "image/jpeg",
          0.88,
        ),
      );
      await onConfirm(new File([blob], "profile-cropped.jpg", { type: "image/jpeg" }));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent
        className="flex max-h-[92dvh] flex-col overflow-y-auto sm:max-w-md [&>*]:shrink-0"
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle>{l("Crop profile photo", "قص صورة الملف الشخصي")}</DialogTitle>
          <DialogDescription>
            {l(
              "Adjust the square crop. Your photo stays on this device until you confirm upload.",
              "عدّل القص المربع. تبقى الصورة على جهازك حتى تؤكد رفعها.",
            )}
          </DialogDescription>
        </DialogHeader>
        {image ? (
          <>
            <div
              className="relative mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-xl bg-background"
              data-avatar-crop-preview
              style={{ touchAction: "none" }}
              onPointerDown={(event) => {
                if (pending || !image) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                baseline();
              }}
              onPointerMove={move}
              onPointerUp={(event) => {
                pointers.current.delete(event.pointerId);
                baseline();
              }}
              onPointerCancel={(event) => {
                pointers.current.delete(event.pointerId);
                baseline();
              }}
            >
              <img
                src={image.url}
                alt={l("Profile crop preview", "معاينة قص صورة الملف")}
                className="absolute max-w-none"
                draggable={false}
                style={{
                  width: `${(image.bitmap.width / side) * 100}%`,
                  height: `${(image.bitmap.height / side) * 100}%`,
                  left: `${(-left / side) * 100}%`,
                  top: `${(-top / side) * 100}%`,
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-gold/70"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {l(
                "Drag to position or pinch to zoom. You can also use the controls below.",
                "اسحب لتحريك الصورة أو استخدم إصبعين للتكبير. يمكنك أيضاً استخدام أدوات التحكم أدناه.",
              )}
            </p>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setZoom(1);
                setX(50);
                setY(50);
                pointers.current.clear();
                gesture.current = null;
              }}
            >
              {l("Reset crop", "إعادة ضبط القص")}
            </Button>
            <fieldset disabled={pending} className="min-w-0 space-y-3">
              {(
                [
                  [l("Zoom", "التكبير"), zoom, 1, 3, 0.05, setZoom],
                  [l("Horizontal framing", "الإطار الأفقي"), x, 0, 100, 1, setX],
                  [l("Vertical framing", "الإطار الرأسي"), y, 0, 100, 1, setY],
                ] as const
              ).map(([label, value, min, max, step, set]) => (
                <label key={label} className="block text-sm">
                  {label}
                  <input
                    type="range"
                    dir="ltr"
                    className="mt-1 block min-h-11 w-full accent-gold"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(event) => set(Number(event.target.value))}
                  />
                </label>
              ))}
            </fieldset>
          </>
        ) : (
          !error && <p role="status">{l("Preparing photo…", "جارٍ تجهيز الصورة…")}</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button disabled={!image || pending} onClick={() => void confirm()}>
          {pending
            ? l("Uploading…", "جارٍ الرفع…")
            : l("Use photo & upload", "استخدام الصورة ورفعها")}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onCancel}>
          {l("Cancel", "إلغاء")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

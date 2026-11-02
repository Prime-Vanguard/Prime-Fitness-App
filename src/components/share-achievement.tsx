import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { rankEmblem } from "@/lib/rank-emblems";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/logo.png";

async function loadImage(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}
function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image export unavailable"))),
      "image/png",
    ),
  );
}
export function ShareAchievement({
  name,
  title,
  detail,
  rank = "Recruit",
}: {
  name: string;
  title: string;
  detail: string;
  rank?: string;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; file: File }>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    let objectUrl: string | undefined;
    setPreview(undefined);
    setError(false);
    void (async () => {
      // A web font can stay pending after going offline. Export with the system
      // fallback rather than leaving the card indefinitely in its loading state.
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 1500);
        void document.fonts.ready.then(
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
        );
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, 0, 1080, 1920);
      const gradient = ctx.createRadialGradient(540, 700, 20, 540, 700, 850);
      gradient.addColorStop(0, "#26354A");
      gradient.addColorStop(1, "#0F172A");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);
      ctx.strokeStyle = "#D4AF37";
      ctx.lineWidth = 3;
      ctx.strokeRect(58, 58, 964, 1804);
      const [brand, crestImage] = await Promise.all([
        loadImage(logo),
        loadImage(rankEmblem(rank).large),
      ]);
      const scale = 200 / Math.max(brand.width, brand.height);
      ctx.drawImage(
        brand,
        540 - (brand.width * scale) / 2,
        200,
        brand.width * scale,
        brand.height * scale,
      );
      ctx.drawImage(crestImage, 340, 500, 400, 400);
      ctx.textAlign = "center";
      ctx.fillStyle = "#D4AF37";
      ctx.font = "600 30px Manrope, sans-serif";
      ctx.fillText("PRIME VANGUARD", 540, 440);
      const text = (value: string, y: number, maxSize: number, color: string) => {
        let size = maxSize;
        ctx.font = `700 ${size}px Manrope, Tajawal, sans-serif`;
        const safe = value.slice(0, 120);
        while (ctx.measureText(safe).width > 850 && size > 20) {
          size -= 2;
          ctx.font = `700 ${size}px Manrope, Tajawal, sans-serif`;
        }
        ctx.fillStyle = color;
        ctx.fillText(safe, 540, y, 850);
      };
      text(name, 990, 48, "#F1F5F9");
      text(title, 1120, 66, "#D4AF37");
      text(detail, 1230, 40, "#F1F5F9");
      text("TRAIN · FUEL · RISE", 1580, 26, "#94A3B8");
      text("PRIME FITNESS", 1690, 36, "#D4AF37");
      const blob = await canvasBlob(canvas);
      objectUrl = URL.createObjectURL(blob);
      if (alive)
        setPreview({
          url: objectUrl,
          file: new File([blob], "prime-vanguard-achievement.png", { type: "image/png" }),
        });
      else URL.revokeObjectURL(objectUrl);
    })().catch(() => {
      if (alive) setError(true);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, name, title, detail, rank]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 size={14} />
          {l("Share achievement", "مشاركة الإنجاز")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[95dvh] max-w-sm overflow-y-auto">
        <DialogTitle>{l("Your achievement card", "بطاقة إنجازك")}</DialogTitle>
        <DialogDescription>
          {l(
            "Preview a 1080 × 1920 story. Only the name and achievement shown here are exported. Nothing is posted automatically.",
            "عاين قصة ١٠٨٠ × ١٩٢٠. يُصدَّر الاسم والإنجاز المعروضان فقط. لا يُنشر شيء تلقائياً.",
          )}
        </DialogDescription>
        {preview ? (
          <>
            <img
              src={preview.url}
              alt={`${name}: ${title}, ${detail}`}
              className="mx-auto max-h-[52dvh] rounded-lg"
            />
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={preview.url} download="prime-vanguard-achievement.png">
                  <Download size={14} />
                  {l("Download PNG", "تنزيل PNG")}
                </a>
              </Button>
              {navigator.canShare?.({ files: [preview.file] }) && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void navigator.share({ files: [preview.file] }).catch((e: Error) => {
                      if (e.name !== "AbortError")
                        toast.error(
                          l(
                            "Sharing unavailable. Download the card instead.",
                            "المشاركة غير متاحة. نزّل البطاقة.",
                          ),
                        );
                    })
                  }
                >
                  <Share2 size={14} />
                  {l("Share", "مشاركة")}
                </Button>
              )}
            </div>
          </>
        ) : (
          <p role="status">
            {error
              ? l("Could not create the card. Please retry.", "تعذر إنشاء البطاقة. حاول مجدداً.")
              : l("Preparing your card…", "جارٍ تجهيز بطاقتك…")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

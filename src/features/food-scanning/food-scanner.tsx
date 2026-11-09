import { NativeSelect } from "@/components/ui/native-select";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { appPath } from "@/lib/app-path";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import {
  emptyScannedFood,
  parseNutritionLabel,
  productNutrition,
  reviewedNutrition,
  validBarcode,
  type ScannedFood,
} from "./nutrition-label";
import type { FoodPick } from "@/features/nutrition/contracts";

export function FoodScanner({
  userId,
  onReviewed,
}: {
  userId: string;
  onReviewed: (food: FoodPick) => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const {
    data: features,
    isPending: featuresPending,
    isError: featuresError,
    isFetching: featuresFetching,
    refetch: retryFeatures,
    offlineCacheUnavailable,
  } = useTrainingFeatures(userId);
  const [open, setOpen] = useState(false),
    [barcode, setBarcode] = useState(""),
    [mode, setMode] = useState<"label" | "barcode">("label"),
    [value, setValue] = useState(emptyScannedFood),
    [raw, setRaw] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [source, setSource] = useState(false),
    [progress, setProgress] = useState(0);
  const video = useRef<HTMLVideoElement>(null),
    generation = useRef(0),
    controls = useRef<{ stop: () => void } | null>(null),
    worker = useRef<{ terminate: () => Promise<unknown> } | null>(null);
  const stop = useCallback(() => {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    const stream = video.current?.srcObject;
    if (typeof MediaStream !== "undefined" && stream instanceof MediaStream)
      stream.getTracks().forEach((track) => track.stop());
    void worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  }, []);
  useEffect(() => {
    if (featuresError || features?.food_scanning !== true) stop();
  }, [featuresError, features?.food_scanning, stop]);
  useEffect(
    () => () => {
      generation.current++;
      controls.current?.stop();
      void worker.current?.terminate();
    },
    [],
  );
  function change(patch: Partial<ScannedFood>) {
    setValue((current) => ({ ...current, ...patch }));
    setReviewed(false);
  }
  async function lookup(code = barcode) {
    const epoch = ++generation.current;
    setError("");
    setBusy(true);
    setReviewed(false);
    try {
      if (!navigator.onLine)
        throw new Error(
          l(
            "Barcode lookup needs a connection. You can enter the label below offline.",
            "البحث بالباركود يحتاج اتصالاً. يمكنك إدخال القيم يدوياً دون اتصال.",
          ),
        );
      const normalized = validBarcode(code);
      const response = await supabase.functions.invoke("food-barcode", {
        body: { barcode: normalized },
      });
      if (response.error)
        throw new Error(
          l(
            "Lookup unavailable or rate limited. Check the connection or enter the label manually.",
            "البحث غير متاح أو تجاوز الحد. تحقق من الاتصال أو أدخل القيم يدوياً.",
          ),
        );
      const food = productNutrition(response.data);
      if (epoch !== generation.current) return;
      setValue(food);
      setSource(true);
      setBarcode(normalized);
    } catch (e) {
      if (epoch === generation.current) setError((e as Error).message);
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function fileSelected(file: File) {
    const epoch = ++generation.current;
    setBusy(true);
    setError("");
    setReviewed(false);
    setProgress(0);
    let objectUrl = "";
    let ownWorker: { terminate: () => Promise<unknown> } | null = null;
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024)
        throw new Error(
          l(
            "Choose a JPEG, PNG or WebP photo up to 10 MiB.",
            "اختر صورة JPEG أو PNG أو WebP بحجم لا يتجاوز 10 ميبيبايت.",
          ),
        );
      if (mode === "barcode") {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        objectUrl = URL.createObjectURL(file);
        const result = await new BrowserMultiFormatReader().decodeFromImageUrl(objectUrl);
        if (epoch === generation.current) await lookup(result.getText());
      } else {
        const { createWorker } = await import("tesseract.js");
        const engine = await createWorker(["eng", "ara"], undefined, {
          workerPath: appPath("scanner-runtime/worker.min.js"),
          corePath: appPath("scanner-runtime/core"),
          langPath: appPath("scanner-runtime/lang"),
          workerBlobURL: false,
          logger: (message) => {
            if (epoch === generation.current) setProgress(Math.round(message.progress * 100));
          },
        });
        ownWorker = engine;
        if (epoch !== generation.current) {
          return;
        }
        worker.current = engine;
        const bitmap = await createImageBitmap(file);
        const factor = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * factor);
        canvas.height = Math.round(bitmap.height * factor);
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const result = await engine.recognize(canvas);
        if (epoch !== generation.current) return;
        setRaw(result.data.text);
        setValue(parseNutritionLabel(result.data.text));
        setSource(false);
      }
    } catch {
      if (epoch === generation.current)
        setError(
          l(
            "Could not read this image. Use a clearer cropped label, paste its text, or enter the values manually. First-time OCR downloads need a connection.",
            "تعذرت قراءة الصورة. استخدم ملصقاً أوضح أو الصق النص أو أدخل القيم يدوياً. يحتاج تنزيل OCR الأول إلى اتصال.",
          ),
        );
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      await ownWorker?.terminate().catch(() => {});
      if (worker.current === ownWorker) worker.current = null;
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function camera() {
    stop();
    const epoch = generation.current;
    setError("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (epoch !== generation.current || !video.current) return;
      const cameraControls = await new BrowserMultiFormatReader().decodeFromConstraints(
        { video: { facingMode: "environment" }, audio: false },
        video.current,
        (result, _error, active) => {
          if (result && epoch === generation.current) {
            active.stop();
            void lookup(result.getText());
          }
        },
      );
      if (epoch !== generation.current) cameraControls.stop();
      else controls.current = cameraControls;
    } catch {
      setError(
        l(
          "Camera access unavailable. Allow camera access, upload a barcode photo, or type the number.",
          "الكاميرا غير متاحة. اسمح بالوصول أو ارفع صورة الباركود أو أدخل الرقم.",
        ),
      );
    }
  }
  if (featuresError || featuresPending || features?.food_scanning !== true)
    return (
      <section
        className="my-4 rounded-xl border border-border p-3"
        aria-label={l("Food scanning availability", "إتاحة مسح الطعام")}
      >
        <p role={featuresError ? "alert" : "status"} className="text-sm">
          {featuresError
            ? l(
                "Could not check food scanning availability. Your food draft is kept. Retry, or use search and Quick macros.",
                "تعذر التحقق من إتاحة مسح الطعام. احتُفظ بمسودة الطعام. أعد المحاولة أو استخدم البحث والإضافة السريعة.",
              )
            : featuresPending
              ? l("Checking food scanning availability…", "جارٍ التحقق من إتاحة مسح الطعام…")
              : features?.food_scanning === false
                ? l(
                    "Food scanning is not enabled for this account. You can use search or Quick macros.",
                    "مسح الطعام غير مفعّل لهذا الحساب. يمكنك استخدام البحث أو الإضافة السريعة.",
                  )
                : l(
                    "Connect to check food scanning availability on this device.",
                    "اتصل بالإنترنت للتحقق من إتاحة مسح الطعام على هذا الجهاز.",
                  )}
        </p>
        {!featuresPending && (featuresError || features?.food_scanning === undefined) && (
          <Button
            variant="outline"
            className="mt-2"
            disabled={featuresFetching}
            onClick={() => void retryFeatures()}
          >
            {l("Retry scanner availability", "إعادة التحقق من إتاحة المسح")}
          </Button>
        )}
      </section>
    );
  return (
    <section className="my-4 rounded-xl border border-gold/30 p-3">
      {offlineCacheUnavailable && (
        <p role="status" className="mb-2 text-sm">
          {l(
            "Scanning is available online, but its availability could not be saved on this device. Offline access may be unavailable.",
            "المسح متاح عند الاتصال، لكن تعذر حفظ إتاحته على الجهاز. قد لا يتاح دون اتصال.",
          )}
        </p>
      )}
      <Button
        variant="outline"
        onClick={() => {
          if (open) stop();
          setOpen(!open);
        }}
      >
        {l("Scan barcode or nutrition label", "مسح باركود أو ملصق غذائي")}
      </Button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs">
            {l(
              "Images stay on this device. Barcode lookup shares only the barcode with Open Food Facts. Recognition can be wrong; confirm the serving and every macro. Meal-photo calorie guessing is not supported.",
              "تبقى الصور على جهازك. يشارك البحث الباركود فقط مع Open Food Facts. قد تخطئ القراءة؛ راجع الحصة وكل القيم. لا نخمّن سعرات صور الوجبات.",
            )}
          </p>
          <label className="block">
            {l("Barcode number", "رقم الباركود")}
            <Input
              dir="ltr"
              inputMode="numeric"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void lookup()}>
              {l("Look up product", "بحث عن المنتج")}
            </Button>
            <Button variant="outline" onClick={() => void camera()} disabled={busy}>
              {l("Scan with camera", "مسح بالكاميرا")}
            </Button>
            <Button variant="outline" onClick={stop}>
              {l("Stop / cancel scan", "إيقاف المسح")}
            </Button>
          </div>
          <video
            ref={video}
            muted
            playsInline
            className="max-h-40 w-full rounded"
            aria-label={l("Barcode camera preview", "معاينة كاميرا الباركود")}
          />
          <label className="min-w-0 max-w-full block">
            {l("Image type", "نوع الصورة")}
            <NativeSelect
              className="mt-2"
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="label">{l("Nutrition label", "الملصق الغذائي")}</option>
              <option value="barcode">{l("Barcode", "الباركود")}</option>
            </NativeSelect>
          </label>
          <label className="block">
            {l("Take or upload label/barcode photo", "التقط أو ارفع صورة الملصق أو الباركود")}
            <input
              className="block min-h-11 max-w-full"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void fileSelected(file);
              }}
            />
          </label>
          {busy && (
            <p role="status">
              {l("Reading…", "جارٍ القراءة…")} {progress}%
            </p>
          )}
          <label className="block">
            {l("Label text (optional manual paste)", "نص الملصق (لصق يدوي اختياري)")}
            <textarea
              disabled={busy}
              className="w-full rounded border bg-background p-2"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
          </label>
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => {
              setValue(parseNutritionLabel(raw));
              setReviewed(false);
              setSource(false);
            }}
          >
            {l("Read pasted label", "قراءة النص الملصق")}
          </Button>
          {(
            [
              ["name", l("Food name", "اسم الطعام")],
              [
                "serving",
                l("Serving basis, e.g. 100 g or 1 bottle", "أساس الحصة مثل ١٠٠ غ أو زجاجة"),
              ],
              ["calories", l("Calories (kcal)", "السعرات")],
              ["protein_g", l("Protein (g)", "البروتين (غ)")],
              ["carbs_g", l("Carbs (g)", "الكربوهيدرات (غ)")],
              ["fat_g", l("Fat (g)", "الدهون (غ)")],
            ] as [keyof ScannedFood, string][]
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              {label}
              <Input
                disabled={busy}
                value={value[key]}
                inputMode={key === "name" || key === "serving" ? "text" : "decimal"}
                onChange={(e) => change({ [key]: e.target.value })}
              />
            </label>
          ))}
          {source && (
            <p className="text-xs">
              <a
                className="underline"
                href="https://world.openfoodfacts.org/"
                target="_blank"
                rel="noreferrer"
              >
                Open Food Facts
              </a>{" "}
              ·{" "}
              <a
                className="underline"
                href="https://opendatacommons.org/licenses/odbl/1-0/"
                target="_blank"
                rel="noreferrer"
              >
                ODbL / DbCL
              </a>{" "}
              ·{" "}
              {l(
                "Product values are per 100 g; change the basis only with matching values.",
                "قيم المنتج لكل ١٠٠ غ؛ غيّر الأساس مع تعديل القيم.",
              )}
            </p>
          )}
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              disabled={busy}
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {l(
              "I reviewed the serving and all nutrient values",
              "راجعت الحصة وجميع القيم الغذائية",
            )}
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={busy || !reviewed}
            onClick={() => {
              try {
                onReviewed(reviewedNutrition(value));
                stop();
                setOpen(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {l("Use reviewed values in food editor", "استخدام القيم المراجعة في محرر الطعام")}
          </Button>
        </div>
      )}
    </section>
  );
}

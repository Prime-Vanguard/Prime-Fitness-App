import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadPhotoPage, signHistoryPhotos, type HistoryPhoto } from "@/lib/photo-history";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { PhotoComparison } from "./photo-comparison";
export function PhotoHistoryComparison({
  userId,
  excluded = [],
}: {
  userId: string;
  excluded?: string[];
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [pose, setPose] = useState("front"),
    [page, setPage] = useState(0),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [before, setBefore] = useState<HistoryPhoto | null>(null),
    [after, setAfter] = useState<HistoryPhoto | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const valid = !from || !to || from <= to;
  const omitted = excluded.join(",");
  const history = useQuery({
    queryKey: ["photos", userId, "comparison-history", pose, from, to, page],
    enabled: valid,
    retry: false,
    queryFn: () => loadPhotoPage(userId, { page, pose, from, to }),
  });
  const rows = (history.data?.photos ?? []).filter((p) => !excluded.includes(p.id));
  useEffect(() => {
    const candidates = (history.data?.photos ?? []).filter(
      (p) => !omitted.split(",").includes(p.id),
    );
    setBefore((current) =>
      current && !omitted.split(",").includes(current.id) ? current : (candidates.at(-1) ?? null),
    );
    setAfter((current) =>
      current && !omitted.split(",").includes(current.id) ? current : (candidates[0] ?? null),
    );
  }, [history.data, omitted]);
  const choices = [
    ...new Map(
      [before, after, ...rows].filter((p): p is HistoryPhoto => !!p).map((p) => [p.id, p]),
    ).values(),
  ];
  const selected = [before, after].filter(
    (p): p is HistoryPhoto => p !== null && !excluded.includes(p.id),
  );
  const ids = [...new Set(selected.map((p) => p.id))];
  const signed = useQuery({
    queryKey: ["photos", userId, "comparison-urls", ids.join(",")],
    enabled: ids.length > 0,
    retry: false,
    staleTime: 30 * 60000,
    refetchInterval: 45 * 60000,
    queryFn: async () => {
      const result = await supabase
        .from("progress_photos")
        .select("*")
        .eq("member_id", userId)
        .in("id", ids)
        .retry(false)
        .abortSignal(AbortSignal.timeout(15000));
      if (result.error) throw result.error;
      return signHistoryPhotos(result.data.filter((p) => ids.includes(p.id)));
    },
  });
  const selectedKey = ids.join(",");
  useEffect(() => {
    if (!signed.isSuccess || !signed.data) return;
    const missing = (p: HistoryPhoto | null) =>
      p && selectedKey.split(",").includes(p.id) && !signed.data.some((r) => r.id === p.id);
    if (missing(before)) {
      setBefore(null);
      setUnavailable(true);
    }
    if (missing(after)) {
      setAfter(null);
      setUnavailable(true);
    }
  }, [signed.data, signed.isSuccess, selectedKey, before, after]);
  return (
    <div className="mt-5 space-y-3 rounded-xl border border-border p-3">
      <h3 className="font-semibold">{l("Comparison photo history", "سجل صور المقارنة")}</h3>
      <p className="text-xs text-muted-foreground">
        {l(
          "Selected photos stay pinned while you browse other pages or dates.",
          "تبقى الصور المحددة محفوظة أثناء تصفح صفحات أو تواريخ أخرى.",
        )}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          {l("Pose", "الوضعية")}
          <select
            aria-label={l("Comparison pose", "وضعية المقارنة")}
            value={pose}
            className="mt-1 h-11 w-full rounded border bg-background px-2"
            onChange={(e) => {
              setPose(e.target.value);
              setPage(0);
              setBefore(null);
              setAfter(null);
            }}
          >
            {["front", "side", "back"].map((p) => (
              <option key={p} value={p}>
                {p === "front"
                  ? l("Front", "أمام")
                  : p === "side"
                    ? l("Side", "جانب")
                    : l("Back", "خلف")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          {l("Photos from", "الصور من")}
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="text-xs">
          {l("Photos through", "الصور حتى")}
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      {!valid && (
        <p role="alert">
          {l(
            "The start date must be before the end date.",
            "يجب أن يسبق تاريخ البداية تاريخ النهاية.",
          )}
        </p>
      )}
      {history.isPending && valid && (
        <p role="status">{l("Loading photo history…", "جارٍ تحميل سجل الصور…")}</p>
      )}
      {history.error && (
        <div role="alert">
          {l("Photo history could not be loaded.", "تعذر تحميل سجل الصور.")}
          <Button variant="outline" onClick={() => void history.refetch()}>
            {l("Retry photo history", "إعادة تحميل سجل الصور")}
          </Button>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {(["before", "after"] as const).map((side) => (
          <label className="text-xs" key={side}>
            {side === "before" ? l("Before", "قبل") : l("After", "بعد")}
            <select
              aria-label={
                side === "before" ? l("Before photo", "صورة قبل") : l("After photo", "صورة بعد")
              }
              className="mt-1 h-11 w-full rounded border bg-background px-2"
              value={(side === "before" ? before : after)?.id ?? ""}
              onChange={(e) => {
                setUnavailable(false);
                const p = choices.find((p) => p.id === e.target.value) ?? null;
                if (side === "before") {
                  setBefore(p);
                  if (p && p.id === after?.id) setAfter(choices.find((c) => c.id !== p.id) ?? null);
                } else setAfter(p);
              }}
            >
              <option value="">{l("Choose photo", "اختر صورة")}</option>
              {choices
                .filter((p) => side === "before" || p.id !== before?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.taken_on}
                  </option>
                ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={page === 0 || history.isFetching}
          onClick={() => setPage((p) => p - 1)}
        >
          {l("Newer comparison photos", "صور مقارنة أحدث")}
        </Button>
        <span className="text-xs">
          {l("Page", "صفحة")} {page + 1}
        </span>
        <Button
          variant="outline"
          disabled={!history.data?.hasOlder || history.isFetching || !valid}
          onClick={() => setPage((p) => p + 1)}
        >
          {l("Older comparison photos", "صور مقارنة أقدم")}
        </Button>
      </div>
      {ids.length > 0 && signed.isPending && (
        <p role="status">{l("Loading selected photos…", "جارٍ تحميل الصور المحددة…")}</p>
      )}
      {unavailable && (
        <p role="alert">
          {l(
            "A selected photo was removed or is no longer accessible. Choose another photo.",
            "حُذفت إحدى الصور المحددة أو لم تعد متاحة. اختر صورة أخرى.",
          )}
        </p>
      )}
      {signed.error && (
        <div role="alert">
          {l("Selected photos could not be loaded.", "تعذر تحميل الصور المحددة.")}
          <Button variant="outline" onClick={() => void signed.refetch()}>
            {l("Retry selected photos", "إعادة تحميل الصور المحددة")}
          </Button>
        </div>
      )}
      {history.data && !history.error && !signed.error && !(ids.length > 0 && signed.isPending) && (
        <PhotoComparison
          photos={[]}
          pair={{
            before: signed.error ? undefined : signed.data?.find((p) => p.id === before?.id),
            after: signed.error
              ? undefined
              : signed.data?.find((p) => p.id === after?.id && p.id !== before?.id),
          }}
          hideControls
          onRenew={() => void signed.refetch({ cancelRefetch: false })}
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  exactExerciseMapping,
  type ImportOptions,
  type ImportWorkout,
} from "@/lib/training-import";
import { importReceipt } from "@/lib/import-receipt";
import { readMemberState, changeMemberState } from "@/lib/member-store";
import type { Json } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { useImportReview } from "./use-import-review";
import { prepareImportChunks } from "./prepare-import";
export function useImportWorkflow(userId: string, enabled: boolean) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const qc = useQueryClient();
  const worker = useRef<Worker | null>(null);
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function clearParseTimer() {
    if (parseTimer.current != null) clearTimeout(parseTimer.current);
    parseTimer.current = null;
  }
  const [options, setOptions] = useState<ImportOptions>({
    provider: "strong",
    units: "kg",
    timeZone: "Africa/Cairo",
    ambiguity: "reject",
  });
  const [workouts, setWorkouts] = useState<ImportWorkout[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [exclusions, setExclusions] = useState(false);
  const [progress, setProgress] = useState(0);
  const [chunkTotal, setChunkTotal] = useState(0);
  const [step, setStep] = useState(1),
    [furthest, setFurthest] = useState(1),
    [fileName, setFileName] = useState("");
  const [attempted, setAttempted] = useState(false),
    [receipt, setReceipt] = useState<ReturnType<typeof importReceipt> | null>(null);
  const dispatchLock = useRef(false),
    parseEpoch = useRef(0);
  const mappingTouched = useRef(false);
  const batch = useRef(crypto.randomUUID());
  const completed = useRef(new Set<number>());
  const review = useImportReview(userId, workouts, enabled);
  const { exercises, exercisesError, historyReview } = review;
  useEffect(
    () => () => {
      parseEpoch.current++;
      clearParseTimer();
      worker.current?.terminate();
      worker.current = null;
    },
    [],
  );
  const names = [...new Set(workouts.flatMap((w) => w.sets.map((s) => s.source_exercise)))];
  const unresolved = names.filter((name) => !mapping[name]).length;
  const excludedSets = workouts.reduce(
    (n, w) => n + w.sets.filter((s) => mapping[s.source_exercise] === "skip").length,
    0,
  );
  const excludedWorkouts = workouts.filter((w) =>
    w.sets.every((s) => mapping[s.source_exercise] === "skip"),
  ).length;
  const needsExclusionConsent = excludedSets > 0 || workouts.some((w) => w.warnings.length);
  const canImport =
    !!workouts.length &&
    excludedWorkouts < workouts.length &&
    !unresolved &&
    consent &&
    (!needsExclusionConsent || exclusions) &&
    !historyReview.isPending &&
    !historyReview.error &&
    !exercisesError;
  async function parse(file: File) {
    if (dispatchLock.current || attempted) return;
    const epoch = ++parseEpoch.current;
    mappingTouched.current = false;
    setFileName(file.name);
    setProgress(0);
    setStep(1);
    setFurthest(1);
    setReceipt(null);
    setAttempted(false);
    setError("");
    setReport("");
    setWorkouts([]);
    setConsent(false);
    setExclusions(false);
    setBusy(true);
    completed.current.clear();
    batch.current = crypto.randomUUID();
    worker.current?.terminate();
    clearParseTimer();
    const fail = (message: string) => {
      if (epoch !== parseEpoch.current) return;
      parseEpoch.current++;
      clearParseTimer();
      worker.current?.terminate();
      worker.current = null;
      setError(message);
      setBusy(false);
    };
    const armTimeout = () => {
      clearParseTimer();
      parseTimer.current = setTimeout(
        () =>
          fail(
            l(
              "Reading the CSV stopped responding. No workouts were imported. Choose the file again, or refresh and retry.",
              "توقفت قراءة CSV عن الاستجابة. لم تُستورد أي جلسات. اختر الملف مجدداً أو حدّث الصفحة وأعد المحاولة.",
            ),
          ),
        120000,
      );
    };
    armTimeout();
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("CSV exceeds 20 MiB.");
      const text = await file.text();
      if (epoch !== parseEpoch.current) return;
      const w = new Worker(new URL("../../lib/training-import.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      w.onmessage = (e) => {
        if (epoch !== parseEpoch.current || worker.current !== w) return;
        if (e.data.error) {
          fail(
            `${l("Could not read the selected CSV", "تعذرت قراءة ملف CSV المختار")}: ${String(e.data.error)}`,
          );
        } else if (e.data.workouts) {
          const rows = e.data.workouts as ImportWorkout[];
          if (!Array.isArray(rows) || !rows.length || !rows.some((row) => row.sets.length)) {
            fail(
              l(
                "No supported strength or timed sets were found. Check the Strong/Hevy/FitNotes CSV export; distance-only cardio cannot be imported here.",
                "لم تُوجد مجموعات قوة أو ثبات مدعومة. تحقق من ملف CSV المصدّر من Strong أو Hevy أو FitNotes؛ لا يدعم هذا الاستيراد سجلات الكارديو المعتمدة على المسافة فقط.",
              ),
            );
            return;
          }
          clearParseTimer();
          setWorkouts(rows);
          setStep(2);
          setFurthest(2);
          setMapping(
            exactExerciseMapping(
              [...new Set(rows.flatMap((w) => w.sets.map((s) => s.source_exercise)))],
              exercises ?? [],
            ),
          );
          void readMemberState(userId)
            .then((s) => {
              if (
                worker.current !== w ||
                epoch !== parseEpoch.current ||
                mappingTouched.current ||
                dispatchLock.current
              )
                return;
              const saved = s.references["importAliases"] as Record<string, string> | undefined;
              setMapping((current) => ({
                ...current,
                ...Object.fromEntries(
                  Object.entries(saved ?? {}).filter(
                    ([name, id]) =>
                      rows.some((w) => w.sets.some((s) => s.source_exercise === name)) &&
                      exercises?.some((e) => e.id === id),
                  ),
                ),
              }));
            })
            .catch(() => {});
          setBusy(false);
          w.terminate();
        } else {
          setProgress(e.data.progress);
          armTimeout();
        }
      };
      w.onerror = () => {
        if (worker.current !== w) return;
        fail(
          l(
            "CSV parser failed to start or read the file. No workouts were imported. Refresh the page and choose the file again.",
            "تعذر تشغيل قارئ CSV أو قراءة الملف. لم تُستورد أي جلسات. حدّث الصفحة واختر الملف مجدداً.",
          ),
        );
      };
      w.onmessageerror = () =>
        fail(
          l(
            "The CSV parser returned an unreadable result. No workouts were imported; choose the file again.",
            "أعاد قارئ CSV نتيجة غير قابلة للقراءة. لم تُستورد أي جلسات؛ اختر الملف مجدداً.",
          ),
        );
      w.postMessage({ text, options });
    } catch (e) {
      fail((e as Error).message);
    }
  }
  async function commit() {
    if (dispatchLock.current) return;
    dispatchLock.current = true;
    setStep(4);
    setCommitting(true);
    setBusy(true);
    setError("");

    try {
      const chunks = prepareImportChunks(workouts, mapping, exercises ?? []);
      setChunkTotal(chunks.length);
      for (let i = 0; i < chunks.length; i++) {
        if (completed.current.has(i)) continue;
        const auth = await supabase.auth.getSession();
        if (auth.data.session?.user.id !== userId)
          throw new Error("Sign in to the same account to continue the import.");
        setAttempted(true);
        const r = await supabase.rpc("commit_training_import", {
          _batch: batch.current,
          _provider: options.provider,
          _workouts: chunks[i] as unknown as Json,
        });
        if (r.error) throw r.error;
        const result = r.data as { accepted: number; skipped: number };
        if (
          !result ||
          !Number.isSafeInteger(result.accepted) ||
          !Number.isSafeInteger(result.skipped) ||
          result.accepted < 0 ||
          result.skipped < 0
        )
          throw new Error("Chunk acknowledgement is incomplete. Retry this batch.");
        completed.current.add(i);
        setProgress(i + 1);
      }
      const outcome = await supabase.rpc("get_import_batch_outcome", { _batch: batch.current });
      if (outcome.error) throw outcome.error;
      const durable = importReceipt(outcome.data);
      if (durable.chunks !== chunks.length)
        throw new Error("The durable chunk count is incomplete. Retry this batch.");
      const { accepted, skipped } = durable;
      setReceipt(durable);
      setStep(5);
      setFurthest(5);
      setReport(
        `${l("Import complete", "اكتمل الاستيراد")}: ${accepted} ${l("added", "مضاف")}, ${skipped} ${l("duplicates skipped", "مكرر مستبعد")}. ${l("No rewards or schedule completion were granted.", "لم تُمنح مكافآت أو إكمال للجدول.")}`,
      );
      await changeMemberState(userId, (s) => ({
        ...s,
        references: {
          ...s.references,
          importAliases: {
            ...(s.references["importAliases"] as Record<string, string> | undefined),
            ...Object.fromEntries(Object.entries(mapping).filter(([, id]) => id !== "skip")),
          },
        },
      })).catch(() =>
        setError("Import saved; exercise aliases could not be cached on this device."),
      );
      for (const key of [
        "import-batches",
        "import-outcome",
        "sessions",
        "progress",
        "muscle-volume",
      ])
        void qc.invalidateQueries({ queryKey: [key] });
    } catch (e) {
      setError(
        (e as Error).message +
          " · " +
          l(
            "Accepted chunks remain saved; retry resumes safely.",
            "الأجزاء المقبولة محفوظة؛ إعادة المحاولة آمنة.",
          ),
      );
    } finally {
      dispatchLock.current = false;
      setCommitting(false);
      setBusy(false);
    }
  }

  function goToStep(next: number) {
    setStep(next);
    if (next < 3) setConsent(false);
  }
  function reviewMapping() {
    mappingTouched.current = true;
    setStep(3);
    setFurthest(Math.max(3, furthest));
  }
  function continueImport() {
    setStep(4);
    setFurthest(Math.max(4, furthest));
  }
  function changeMapping(name: string, id: string) {
    mappingTouched.current = true;
    setMapping({ ...mapping, [name]: id });
    setConsent(false);
  }
  function configure(patch: Partial<ImportOptions>) {
    setOptions({ ...options, ...patch });
  }
  function cancelParsing() {
    parseEpoch.current++;
    clearParseTimer();
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setProgress(0);
    setStep(1);
  }
  function reset() {
    cancelParsing();
    setFileName("");
    setMapping({});
    setStep(1);
    setFurthest(1);
    setAttempted(false);
    setReceipt(null);
    setReport("");
    setError("");
    setWorkouts([]);
    completed.current.clear();
  }
  return {
    options,
    workouts,
    mapping,
    error,
    report,
    busy,
    committing,
    consent,
    exclusions,
    progress,
    chunkTotal,
    step,
    furthest,
    fileName,
    attempted,
    receipt,
    acknowledged: completed.current.size,
    ...review,
    names,
    unresolved,
    excludedSets,
    excludedWorkouts,
    canImport,
    parse,
    commit,
    goToStep,
    reviewMapping,
    continueImport,
    changeMapping,
    configure,
    cancelParsing,
    reset,
    acceptHistory: (value: boolean) => setConsent(value),
    acceptExclusions: (value: boolean) => setExclusions(value),
    reportOutcome: (message: string) => setReport(message),
  };
}

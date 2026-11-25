import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Dumbbell,
  ListPlus,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { MemberSections } from "@/components/member-sections";
import { SelectionIndicator } from "@/components/selection-indicator";
import { ExerciseThumbnail } from "@/components/exercise-thumbnail";
import { ExerciseDetail } from "@/components/exercise-detail";
import {
  discoverExercises,
  isCardioReference,
  exerciseEquipment,
  type ExerciseGuidance,
} from "@/lib/exercise-guidance";
import { exerciseClassification } from "@/lib/exercise-classification";
import { trainingLabel } from "@/lib/training-labels";
import { useI18n } from "@/lib/i18n";
import { pickerResults, PICKER_PAGE_SIZE, type PickerView } from "./exercise-picker-model";
import { rememberPickerChoices } from "./exercise-picker-store";
import { useExercisePickerContext } from "./use-exercise-picker-context";
const EMPTY_IDS: string[] = [];

/** Discovery owns only browsing/staging. The caller still owns the durable,
 * atomic workout insert and its stable retry identities. */
export function ExerciseDiscovery({
  exercises,
  onChoose,
  onChooseMany,
  member,
  preferred = [],
  disabled = false,
  fill = false,
}: {
  exercises: ExerciseGuidance[];
  member: string;
  preferred?: string[];
  onChoose: (id: string) => void | Promise<void>;
  onChooseMany?: ((ids: string[]) => void | Promise<void>) | undefined;
  disabled?: boolean;
  fill?: boolean;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const context = useExercisePickerContext(member);
  const favorites = context.preferences.data?.favorites ?? EMPTY_IDS;
  const added = context.preferences.data?.added ?? EMPTY_IDS;
  const recent = useMemo(
    () => [...new Set([...(context.history.data?.ids ?? []), ...added])],
    [context.history.data?.ids, added],
  );
  const [view, setView] = useState<PickerView>("suggested");
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [mode, setMode] = useState("");
  const [musclesOpen, setMusclesOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PICKER_PAGE_SIZE);
  const [staged, setStaged] = useState<Set<string>>(() => new Set());
  const [detail, setDetail] = useState<{ exercise: ExerciseGuidance; play: boolean } | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState("");
  const selectionLock = useRef(false);
  const scroll = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const previewScroll = useRef(0);
  const browseKey = JSON.stringify([view, q, muscle, equipment, mode]);
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = positions.current.get(browseKey) ?? 0;
  }, [browseKey]);
  const names = useMemo(
    () => new Map(exercises.map((e) => [e.id, (locale === "ar" && e.name_ar) || e.name_en])),
    [exercises, locale],
  );
  const results = useMemo(
    () =>
      pickerResults(exercises, {
        view,
        query: q,
        muscle,
        equipment,
        mode,
        program: preferred,
        recent,
        favorites,
      }),
    [exercises, view, q, muscle, equipment, mode, preferred, recent, favorites],
  );
  const filters = useMemo(() => {
    const active = exercises.filter(
      (e) => e.active !== false && e.guidance?.catalogue_kind !== "cardio",
    );
    return {
      muscles: [...new Set(active.map((e) => e.muscle))],
      equipment: [...new Set(active.flatMap(exerciseEquipment))],
    };
  }, [exercises]);
  const resetPage = () => setVisibleCount(PICKER_PAGE_SIZE);
  const clearFilters = () => {
    setMuscle("");
    setEquipment("");
    setMode("");
    resetPage();
  };
  const openDetail = (exercise: ExerciseGuidance, play: boolean) => {
    previewScroll.current = scroll.current?.scrollTop ?? 0;
    setDetail({ exercise, play });
  };
  const closeDetail = () => {
    if (choosing) return;
    setDetail(null);
    requestAnimationFrame(() => {
      if (scroll.current) scroll.current.scrollTop = previewScroll.current;
    });
  };
  function stage(id: string, ensureSelected = false) {
    const exercise = exercises.find((entry) => entry.id === id);
    if (!exercise || exercise.active === false || exercise.guidance?.catalogue_kind === "cardio") {
      setError(
        l(
          "This exercise is unavailable for strength logging.",
          "هذا التمرين غير متاح لتسجيل القوة.",
        ),
      );
      return;
    }
    setError("");
    setStaged((current) => {
      const next = new Set(current);
      if (next.has(id) && !ensureSelected) next.delete(id);
      else if (next.size < 20) next.add(id);
      return next;
    });
  }
  async function commit(ids: string[], many: boolean) {
    if (disabled || selectionLock.current || !ids.length) return;
    selectionLock.current = true;
    setChoosing(true);
    setError("");
    try {
      if (many && onChooseMany) await onChooseMany(ids);
      else await onChoose(ids[0]!);
      setStaged(new Set());
      setDetail(null);
      // Optional recent-choice metadata must never turn an accepted workout insert
      // into a failed action or cause another batch to be inserted on retry.
      void rememberPickerChoices(member, ids).catch(() => {});
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      selectionLock.current = false;
      setChoosing(false);
    }
  }
  const filtered = !!(muscle || equipment || mode);
  const cardioOnly =
    !!q.trim() &&
    results.length === 0 &&
    discoverExercises(exercises, q, { muscle, equipment, mode }).some(isCardioReference);
  const programIds = new Set(preferred),
    historyIds = new Set(context.history.data?.ids ?? []),
    addedIds = new Set(added);
  return (
    <section
      className={fill ? "mt-4 flex min-h-0 flex-1 flex-col gap-3" : "mt-4 space-y-3"}
      data-stitch-exercise-picker
    >
      <h3 className="sr-only">{l("Exercise library", "مكتبة التمارين")}</h3>
      <div className="relative shrink-0">
        <Search aria-hidden className="absolute start-3 top-3 size-5 text-muted-foreground" />
        <Input
          type="search"
          aria-label={l("Search exercises", "ابحث عن تمرين")}
          placeholder={l("Search all exercises or aliases", "ابحث في كل التمارين والأسماء البديلة")}
          className="min-h-12 border-transparent bg-background ps-10 pe-12"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            resetPage();
          }}
        />
        {q && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute end-0 top-0 h-12"
            aria-label={l("Clear exercise search", "مسح البحث عن التمارين")}
            onClick={() => {
              setQ("");
              resetPage();
            }}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
      <div className="shrink-0 [&>nav]:mt-0">
        <MemberSections
          label={l("Exercise views", "طرق عرض التمارين")}
          value={view}
          appearance="segmented"
          equalWidth
          items={[
            ["suggested", l("Suggested", "المقترحة")],
            ["recent", l("Recent", "الأخيرة")],
            ["favorites", l("Favorites", "المفضلة")],
            ["all", l("All", "الكل")],
          ]}
          onSelect={(next) => {
            setView(next);
            resetPage();
          }}
        />
      </div>
      {/* Search, view shortcuts and selection action stay outside this one scroll area. */}
      <div
        ref={scroll}
        data-exercise-picker-scroll
        onScroll={() => positions.current.set(browseKey, scroll.current?.scrollTop ?? 0)}
        className={
          fill
            ? "min-h-0 flex-1 basis-32 space-y-3 overflow-y-auto overscroll-contain"
            : "max-h-[50dvh] space-y-3 overflow-y-auto"
        }
      >
        <div className="flex flex-wrap items-start gap-2">
          <Button
            type="button"
            variant="outline"
            aria-expanded={musclesOpen}
            onClick={() => setMusclesOpen(!musclesOpen)}
          >
            <Dumbbell aria-hidden />
            {muscle
              ? exerciseClassification(muscle, locale)
              : l("Browse by muscle", "تصفح حسب العضلة")}
            <ChevronDown aria-hidden className="size-3" />
          </Button>
          <details className="min-w-0 flex-1 rounded-lg bg-background px-3">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <SlidersHorizontal aria-hidden className="size-4" />
              {l("More filters", "فلاتر إضافية")}
              {mode ? " · 1" : ""}
            </summary>
            <label className="my-2 block text-xs">
              {l("Equipment", "الأدوات")}
              <NativeSelect
                className="mt-2"
                value={equipment}
                onChange={(event) => {
                  setEquipment(event.target.value);
                  resetPage();
                }}
              >
                <option value="">{l("All Equipment", "كل الأدوات")}</option>
                {filters.equipment.map((value) => (
                  <option key={value} value={value}>
                    {exerciseClassification(value, locale)}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="my-2 block text-xs">
              {l("Logging mode", "نوع التسجيل")}
              <NativeSelect
                className="mt-2"
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value);
                  resetPage();
                }}
              >
                <option value="">{l("All", "الكل")}</option>
                {["weighted_reps", "bodyweight_reps", "timed"].map((value) => (
                  <option key={value} value={value}>
                    {trainingLabel(value, locale)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </details>
        </div>
        {musclesOpen && (
          <div
            role="group"
            aria-label={l("Muscle", "العضلة")}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {["", ...filters.muscles].map((value) => (
              <Button
                key={value}
                type="button"
                variant="secondary"
                className="min-h-12 border border-transparent whitespace-normal text-start aria-pressed:border-gold/60 aria-pressed:bg-raised aria-pressed:text-gold"
                aria-pressed={muscle === value}
                onClick={() => {
                  setMuscle(value);
                  setMusclesOpen(false);
                  resetPage();
                }}
              >
                {value ? exerciseClassification(value, locale) : l("All Muscles", "كل العضلات")}
              </Button>
            ))}
          </div>
        )}
        <div
          role="group"
          aria-label={l("Equipment", "الأدوات")}
          className="sliding-selection flex gap-2 overflow-x-auto pb-1"
        >
          <SelectionIndicator />
          {["", ...filters.equipment.slice(0, 5)].map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0 border border-transparent aria-pressed:border-gold/60 aria-pressed:bg-raised aria-pressed:text-gold"
              aria-pressed={equipment === value}
              onClick={() => {
                setEquipment(value);
                resetPage();
              }}
            >
              {value ? exerciseClassification(value, locale) : l("All Equipment", "كل الأدوات")}
            </Button>
          ))}
        </div>
        {filtered && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 text-xs">
            <span>
              {[
                muscle && exerciseClassification(muscle, locale),
                equipment && exerciseClassification(equipment, locale),
                mode && trainingLabel(mode, locale),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              {l("Reset filters", "إعادة ضبط الفلاتر")}
            </Button>
          </div>
        )}
        <p role="status" className="text-xs text-muted-foreground">
          {q.trim()
            ? l("Searching all exercises", "البحث في كل التمارين")
            : view === "suggested"
              ? l(
                  "Your workout, recent choices and curated basics",
                  "تمرينك واختياراتك الأخيرة والأساسيات المختارة",
                )
              : view === "favorites"
                ? l("Favorites saved on this device", "المفضلة محفوظة على هذا الجهاز")
                : view === "recent"
                  ? l(
                      "Recent completed sets and choices on this device",
                      "المجموعات المكتملة الأخيرة واختيارات هذا الجهاز",
                    )
                  : l("Full strength catalogue", "كل تمارين القوة")}
          {" · "}
          {results.length}
          {filtered && q.trim() ? l(" · filters apply", " · الفلاتر مطبقة") : ""}
        </p>
        {context.preferences.error && (
          <p role="alert" className="text-xs text-destructive">
            {l(
              "Device favorites are unavailable. Retry without losing your selection.",
              "المفضلة على الجهاز غير متاحة. أعد المحاولة دون فقدان اختيارك.",
            )}
            <Button variant="ghost" size="sm" onClick={() => void context.preferences.refetch()}>
              {l("Retry favorites", "إعادة تحميل المفضلة")}
            </Button>
          </p>
        )}
        {view === "recent" && (
          <>
            {context.history.isPending && (
              <p role="status" className="text-xs">
                {l("Loading recent history…", "جارٍ تحميل السجل الأخير…")}
              </p>
            )}
            {(context.history.data?.unavailable || context.history.error) && (
              <p className="text-xs text-muted-foreground">
                {l(
                  "Completed history is unavailable. Device choices remain available.",
                  "سجل الجلسات المكتملة غير متاح. تبقى اختيارات الجهاز متاحة.",
                )}
                <Button variant="ghost" size="sm" onClick={() => void context.history.refetch()}>
                  {l("Retry history", "إعادة تحميل السجل")}
                </Button>
              </p>
            )}
            {context.history.data?.cached && !context.history.data.unavailable && (
              <p className="text-xs text-muted-foreground">
                {l("Completed history from device cache", "سجل الجلسات المكتملة من ذاكرة الجهاز")}
              </p>
            )}
          </>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <section
          aria-label={
            !q.trim() && muscle && view === "suggested"
              ? l("Muscle starting points", "تمارين مقترحة للعضلة")
              : l("Matching exercises", "التمارين المطابقة")
          }
        >
          <ul aria-label={l("Exercise results", "نتائج التمارين")} className="space-y-2">
            {results.slice(0, visibleCount).map((exercise) => (
              <li
                key={exercise.id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-background p-3 sm:gap-3"
              >
                <ExerciseThumbnail
                  exercise={exercise}
                  name={names.get(exercise.id)!}
                  onOpen={() => openDetail(exercise, true)}
                />
                <button
                  type="button"
                  className="min-h-11 min-w-0 flex-1 text-start"
                  aria-label={names.get(exercise.id)}
                  onClick={() => openDetail(exercise, false)}
                >
                  <span className="block font-heading text-sm font-bold leading-5">
                    {names.get(exercise.id)}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {exerciseClassification(exercise.muscle, locale)} ·{" "}
                    {exerciseEquipment(exercise)
                      .map((value) => exerciseClassification(value, locale))
                      .join(", ")}
                  </span>
                  {programIds.has(exercise.id) ||
                  historyIds.has(exercise.id) ||
                  addedIds.has(exercise.id) ||
                  view === "suggested" ? (
                    <span className="mt-1 block text-[10px] text-gold">
                      {programIds.has(exercise.id)
                        ? l("In this workout", "في هذا التمرين")
                        : historyIds.has(exercise.id)
                          ? l("Recently trained", "تدربت عليه مؤخراً")
                          : addedIds.has(exercise.id)
                            ? l("Recently added on this device", "أُضيف مؤخراً على هذا الجهاز")
                            : favorites.includes(exercise.id)
                              ? l("Favorite", "مفضّل")
                              : l("Curated basic", "تمرين أساسي مختار")}
                    </span>
                  ) : null}
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={
                      l(
                        favorites.includes(exercise.id) ? "Remove favorite: " : "Save favorite: ",
                        favorites.includes(exercise.id) ? "إزالة من المفضلة: " : "حفظ في المفضلة: ",
                      ) + names.get(exercise.id)
                    }
                    aria-pressed={favorites.includes(exercise.id)}
                    disabled={context.saving || !context.preferences.data || disabled}
                    onClick={() => {
                      setError("");
                      void context
                        .favorite(exercise.id, !favorites.includes(exercise.id))
                        .catch(() =>
                          setError(
                            l(
                              "Could not save favorite on this device. Try again.",
                              "تعذر حفظ المفضلة على هذا الجهاز. حاول مجدداً.",
                            ),
                          ),
                        );
                    }}
                  >
                    <Star
                      aria-hidden
                      className={
                        favorites.includes(exercise.id)
                          ? "fill-gold text-gold"
                          : "text-muted-foreground"
                      }
                    />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    aria-pressed={onChooseMany ? staged.has(exercise.id) : undefined}
                    className={
                      staged.has(exercise.id) ? "bg-success text-success-foreground" : "bg-raised"
                    }
                    disabled={
                      disabled ||
                      choosing ||
                      (!!onChooseMany && staged.size >= 20 && !staged.has(exercise.id))
                    }
                    onClick={() =>
                      onChooseMany ? stage(exercise.id) : void commit([exercise.id], false)
                    }
                  >
                    {onChooseMany ? (
                      <>
                        {staged.has(exercise.id) ? <Check aria-hidden /> : <Plus aria-hidden />}
                        {staged.has(exercise.id) ? l("Added", "مضاف") : l("Add", "أضف")}
                      </>
                    ) : (
                      l("Use", "استخدم")
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        {!results.length && (
          <p className="rounded-lg bg-background p-3 text-sm">
            {cardioOnly
              ? l(
                  "Cardio activities are logged separately in Train → Cardio & HIIT.",
                  "تُسجّل أنشطة الكارديو بشكل منفصل في التدريب ← الكارديو وHIIT.",
                )
              : q.trim() || filtered
                ? l("No exercises match these filters.", "لا توجد تمارين تطابق هذه الفلاتر.")
                : view === "favorites"
                  ? l(
                      "Star an exercise to find it here next time.",
                      "اضغط النجمة بجانب تمرين ليظهر هنا لاحقاً.",
                    )
                  : view === "recent"
                    ? l(
                        "Exercises appear here after completed training or adding them on this device.",
                        "تظهر التمارين هنا بعد التدريب المكتمل أو إضافتها على هذا الجهاز.",
                      )
                    : l(
                        "Choose a muscle or browse all exercises to get started.",
                        "اختر عضلة أو تصفح كل التمارين للبدء.",
                      )}
          </p>
        )}
        {(!results.length || view === "suggested") && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setView("all");
              resetPage();
            }}
          >
            {l("Browse all exercises", "تصفح كل التمارين")}
          </Button>
        )}
        {results.length > visibleCount && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setVisibleCount((count) => count + PICKER_PAGE_SIZE)}
          >
            {l("Show more exercises", "عرض المزيد من التمارين")} (
            {Math.min(visibleCount, results.length)} / {results.length})
          </Button>
        )}
      </div>
      {onChooseMany && (
        <div className="shrink-0 space-y-2 border-t border-border bg-card pt-2 pb-1">
          <div className="flex items-center gap-2 text-xs">
            <details className="min-w-0 flex-1">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-muted-foreground">
                <span role="status" className="rounded-full bg-background px-2 py-1 text-gold">
                  {staged.size}
                </span>
                <span className="truncate">
                  {staged.size
                    ? [...staged].map((id) => names.get(id)).join(", ")
                    : l("Select up to 20 exercises", "اختر حتى 20 تمريناً")}
                </span>
              </summary>
              <ul
                aria-label={l("Selected exercises", "التمارين المحددة")}
                className="max-h-24 overflow-y-auto rounded-lg bg-background p-2"
              >
                {[...staged].map((id) => (
                  <li key={id} className="flex items-center justify-between gap-2">
                    <span>{names.get(id)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={
                        l("Remove from selection: ", "إزالة من الاختيار: ") + names.get(id)
                      }
                      disabled={choosing}
                      onClick={() => stage(id)}
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
            <Button
              type="button"
              variant="ghost"
              disabled={choosing || !staged.size}
              onClick={() => {
                setStaged(new Set());
                setError("");
              }}
            >
              {l("Clear selection", "مسح الاختيار")}
            </Button>
          </div>
          <Button
            type="button"
            className="min-h-12 w-full"
            aria-label={l("Insert selected exercises", "إدراج التمارين المحددة")}
            disabled={choosing || disabled || !staged.size}
            onClick={() => void commit([...staged], true)}
          >
            <ListPlus aria-hidden />
            {choosing
              ? l("Saving on device…", "جارٍ الحفظ على الجهاز…")
              : l(`Add ${staged.size} exercises`, `إضافة ${staged.size} تمارين`)}
          </Button>
        </div>
      )}
      {detail && (
        <ExerciseDetail
          key={detail.exercise.id}
          exercise={detail.exercise}
          startMedia={detail.play}
          onClose={closeDetail}
          choosing={choosing || disabled}
          selectionError={error}
          onChoose={(id) => {
            if (onChooseMany) {
              stage(id, true);
              closeDetail();
            } else void commit([id], false);
          }}
        />
      )}
    </section>
  );
}

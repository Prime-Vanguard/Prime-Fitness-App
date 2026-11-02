import { Activity, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { coachMemberAccess } from "@/lib/coach-member-access";
import { fetchAll } from "@/lib/pagination";
import { historicalExerciseLabel } from "@/lib/exercise-guidance";
import { trainingLabel } from "@/lib/training-labels";
import { historyDateFilter } from "@/lib/training-search";
import { activityDay, addDays } from "@/lib/dates";
import { setMetrics, type PerformanceSet } from "@/lib/training-model";
import { displayWeight, displayLength, formatMeasure, weightUnit, lengthUnit } from "@/lib/units";
import { useUnits } from "@/hooks/use-units";
import { useActivityDay } from "@/hooks/use-activity-day";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "./page-header";
import { MemberSections } from "./member-sections";
import { CoachTrainingTools } from "./coach-training-tools";
import { WellnessCheckIn } from "./wellness-checkin";
import { ProgressPhotos } from "./progress-photos";
import { Button } from "./ui/button";
export type CoachSection = "overview" | "training" | "nutrition" | "checkins" | "photos";

export function CoachMemberWorkspace({
  actor,
  member,
  section,
  onSection,
}: {
  actor: string;
  member: string;
  section: CoachSection;
  onSection: (section: CoachSection) => void;
}) {
  const { t, locale } = useI18n(),
    ar = locale === "ar",
    l = (en: string, arabic: string) => (ar ? arabic : en),
    today = useActivityDay();
  const [visited, setVisited] = useState(() => new Set([section])),
    [page, setPage] = useState(0),
    [expanded, setExpanded] = useState("");
  useEffect(() => {
    setVisited((current) => (current.has(section) ? current : new Set([...current, section])));
  }, [section]);
  const access = useQuery({
    queryKey: ["coach-member-access", actor, member],
    queryFn: () => coachMemberAccess(actor, member),
    retry: false,
  });
  async function requireAccess() {
    if (!(await coachMemberAccess(actor, member)))
      throw new Error("Member access is no longer available.");
  }
  const overview = useQuery({
    queryKey: ["coach-member-summary", actor, member, today],
    enabled: !!access.data && section === "overview",
    retry: false,
    queryFn: async () => {
      await requireAccess();
      const result = await supabase
        .from("workout_sessions")
        .select("id", { count: "exact", head: true })
        .eq("member_id", member)
        .not("finished_at", "is", null)
        .or(historyDateFilter(addDays(today, -6), today)!);
      if (result.error) throw result.error;
      if (result.count == null) throw new Error("Summary is unavailable.");
      return result.count;
    },
  });
  const sessions = useQuery({
    queryKey: ["coach-member-sessions", actor, member, page],
    enabled: !!access.data && section === "training",
    retry: false,
    queryFn: async () => {
      await requireAccess();
      const result = await supabase
        .from("workout_sessions")
        .select("id,title,started_at,finished_at,activity_date,origin,notes")
        .eq("member_id", member)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false })
        .order("id")
        .range(page * 15, page * 15 + 15);
      if (result.error) throw result.error;
      return { rows: result.data.slice(0, 15), more: result.data.length > 15 };
    },
  });
  const nutrition = useQuery({
    queryKey: ["coach-member-nutrition", actor, member, today],
    enabled: !!access.data && section === "nutrition",
    retry: false,
    queryFn: async () => {
      await requireAccess();
      const [food, target] = await Promise.all([
        fetchAll(
          (from, to) =>
            supabase
              .from("food_logs")
              .select("id,log_date,calories,protein_g")
              .eq("member_id", member)
              .gte("log_date", addDays(today, -6))
              .lte("log_date", today)
              .order("id")
              .range(from, to),
          (row) => row.id,
        ),
        supabase
          .from("nutrition_targets")
          .select("calories,protein_g")
          .eq("member_id", member)
          .maybeSingle(),
      ]);
      if (target.error) throw target.error;
      const dates = new Map<string, { calories: number; protein: number }>();
      for (const row of food) {
        const day = dates.get(row.log_date) ?? { calories: 0, protein: 0 };
        day.calories += row.calories;
        day.protein += row.protein_g;
        dates.set(row.log_date, day);
      }
      const days = [...dates.entries()].sort(([a], [b]) => b.localeCompare(a));
      return {
        days,
        target: target.data,
        calories: days.length
          ? Math.round(days.reduce((sum, [, day]) => sum + day.calories, 0) / days.length)
          : null,
        protein: days.length
          ? Math.round(days.reduce((sum, [, day]) => sum + day.protein, 0) / days.length)
          : null,
      };
    },
  });
  if (access.isPending)
    return (
      <p role="status" className="mt-6">
        {l("Loading member workspace…", "جارٍ تحميل مساحة العضو…")}
      </p>
    );
  if (access.error)
    return (
      <p role="alert" className="mt-6">
        {l(
          "Could not check member access. Try again when connected.",
          "تعذر التحقق من صلاحية الوصول. حاول عند الاتصال.",
        )}
        <Button variant="outline" onClick={() => void access.refetch()}>
          {l("Retry access", "إعادة التحقق")}
        </Button>
      </p>
    );
  if (!access.data)
    return (
      <p role="status" className="mt-6">
        {l(
          "This workspace is available to the member's current assigned coach and active administrators.",
          "تتوفر هذه المساحة لمدرب العضو الحالي والمشرفين النشطين.",
        )}
      </p>
    );
  return (
    <>
      <Link className="mt-2 inline-block min-h-11 py-2 text-sm text-muted-foreground" to="/members">
        {t("myMembers")}
      </Link>
      <PageHeader title={access.data.display_name || access.data.email || t("memberDetail")} />
      <MemberSections
        label={l("Member workspace sections", "أقسام مساحة العضو")}
        value={section}
        items={[
          ["overview", l("Overview", "نظرة عامة")],
          ["training", l("Training", "التدريب")],
          ["nutrition", l("Nutrition", "التغذية")],
          ["checkins", l("Check-ins", "المتابعة")],
          ["photos", l("Photos", "الصور")],
        ]}
        onSelect={onSection}
      />
      {section === "overview" && (
        <section className="mt-6 rounded-xl border bg-card p-5">
          <h2 className="font-display text-lg font-bold">
            {l("Last seven days", "آخر سبعة أيام")}
          </h2>
          {overview.isPending ? (
            <p role="status">{l("Loading summary…", "جارٍ تحميل الملخص…")}</p>
          ) : overview.error ? (
            <QueryFailure onRetry={() => void overview.refetch()} />
          ) : (
            <p className="mt-3">
              {overview.data ?? "—"} {l("completed workouts", "جلسات مكتملة")}
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {l(
              "Cairo dates; imported completed workouts are included in history. Open Training for source sets, Nutrition for logged-day averages, or Check-ins for private wellness.",
              "وفق تواريخ القاهرة؛ يشمل السجل الجلسات المستوردة المكتملة. افتح التدريب لمراجعة المجموعات، والتغذية لمتوسطات أيام التسجيل، والمتابعة للبيانات الخاصة.",
            )}
          </p>
        </section>
      )}
      {(section === "training" || visited.has("training")) && (
        <Activity mode={section === "training" ? "visible" : "hidden"}>
          <CoachTrainingTools memberId={member} userId={actor} />
          <section className="mt-6 rounded-xl border bg-card p-5">
            <h2 className="font-display text-lg font-bold">{t("history")}</h2>
            {sessions.isPending ? (
              <p role="status">{l("Loading workouts…", "جارٍ تحميل الجلسات…")}</p>
            ) : sessions.error ? (
              <QueryFailure onRetry={() => void sessions.refetch()} />
            ) : (
              <>
                {!sessions.data?.rows.length && (
                  <p className="mt-3 text-sm text-muted-foreground">{t("noWorkouts")}</p>
                )}
                <ul className="mt-3 divide-y">
                  {sessions.data?.rows.map((row) => (
                    <li key={row.id} className="py-3">
                      <h3 className="font-medium">{row.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        <bdi>{row.activity_date ?? activityDay(row.started_at)}</bdi> ·{" "}
                        {row.origin === "import"
                          ? l("Imported · no rewards", "مستورد · دون مكافآت")
                          : l("Native workout", "جلسة داخل التطبيق")}
                      </p>
                      <Button
                        className="mt-2"
                        variant="outline"
                        aria-expanded={expanded === row.id}
                        onClick={() => setExpanded((current) => (current === row.id ? "" : row.id))}
                      >
                        {l("View sets", "عرض المجموعات")} · {row.title}
                      </Button>
                      {expanded === row.id && (
                        <CoachSessionSets actor={actor} member={member} session={row.id} />
                      )}
                      {row.notes && (
                        <p className="mt-2 text-sm text-muted-foreground">{row.notes}</p>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page === 0}
                    onClick={() => {
                      setExpanded("");
                      setPage((value) => value - 1);
                    }}
                  >
                    {l("Previous workouts", "الجلسات السابقة")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!sessions.data?.more}
                    onClick={() => {
                      setExpanded("");
                      setPage((value) => value + 1);
                    }}
                  >
                    {l("Older workouts", "جلسات أقدم")}
                  </Button>
                </div>
              </>
            )}
          </section>
        </Activity>
      )}
      {section === "nutrition" && (
        <section className="mt-6 rounded-xl border bg-card p-5">
          <h2 className="font-display text-lg font-bold">{t("nutritionWeek")}</h2>
          {nutrition.isPending ? (
            <p role="status">{l("Loading nutrition…", "جارٍ تحميل التغذية…")}</p>
          ) : nutrition.error ? (
            <QueryFailure onRetry={() => void nutrition.refetch()} />
          ) : (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  [t("daysLogged"), `${nutrition.data?.days.length ?? 0}/7`],
                  [t("avgCalories"), nutrition.data?.calories ?? "—"],
                  [
                    t("avgProtein"),
                    nutrition.data?.protein == null ? "—" : `${nutrition.data.protein} g`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-2 font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {l(
                  "Averages use logged days only. Missing days are not zero-intake days.",
                  "تُحسب المتوسطات من أيام التسجيل فقط. غياب التسجيل لا يعني انعدام الاستهلاك.",
                )}
              </p>
              <p className="mt-2 text-sm">
                {t("target")}: {nutrition.data?.target?.calories ?? "—"} kcal ·{" "}
                {nutrition.data?.target?.protein_g ?? "—"} g {t("protein")}
              </p>
              <ul className="mt-3 divide-y">
                {nutrition.data?.days.map(([day, values]) => (
                  <li className="py-2 text-sm" key={day}>
                    <bdi>
                      {day} · {values.calories} kcal · {formatMeasure(values.protein)} g
                    </bdi>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {section === "checkins" && (
        <>
          <CoachMeasurements actor={actor} member={member} />
          <WellnessCheckIn memberId={member} userId={actor} />
        </>
      )}
      {(section === "photos" || visited.has("photos")) && (
        <Activity mode={section === "photos" ? "visible" : "hidden"}>
          <ProgressPhotos userId={member} readOnly />
        </Activity>
      )}
    </>
  );
}
function QueryFailure({ onRetry }: { onRetry: () => void }) {
  const { locale } = useI18n();
  return (
    <p role="alert" className="mt-3 text-sm">
      {locale === "ar"
        ? "تعذر تحميل البيانات. تحقق من الاتصال وصلاحية الوصول."
        : "Could not load records. Check your connection and current member access."}
      <Button variant="outline" onClick={onRetry}>
        {locale === "ar" ? "إعادة المحاولة" : "Retry records"}
      </Button>
    </p>
  );
}
function CoachSessionSets({
  actor,
  member,
  session,
}: {
  actor: string;
  member: string;
  session: string;
}) {
  const { locale } = useI18n(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en),
    units = useUnits(actor);
  const query = useQuery({
    queryKey: ["coach-session-sets", actor, member, session],
    retry: false,
    queryFn: async () => {
      if (!(await coachMemberAccess(actor, member)))
        throw new Error("Member access is no longer available.");
      return fetchAll(
        (from, to) =>
          supabase
            .from("set_logs")
            .select("*,workout_exercises(snapshot),exercises(name_en,name_ar)")
            .eq("member_id", member)
            .eq("session_id", session)
            .order("created_at")
            .order("id")
            .range(from, to),
        (row) => row.id,
      );
    },
  });
  if (query.isPending) return <p role="status">{l("Loading sets…", "جارٍ تحميل المجموعات…")}</p>;
  if (query.error) return <QueryFailure onRetry={() => void query.refetch()} />;
  if (!query.data.length)
    return (
      <p className="mt-3 text-sm">
        {l("No set records available for this workout.", "لا توجد مجموعات متاحة لهذه الجلسة.")}
      </p>
    );
  const metrics = query.data.reduce(
    (total, row) => {
      const metric = setMetrics(row as PerformanceSet);
      return {
        sets: total.sets + metric.sets,
        kg: total.kg + metric.kg,
        seconds: total.seconds + metric.seconds,
      };
    },
    { sets: 0, kg: 0, seconds: 0 },
  );
  return (
    <div className="mt-3">
      <p className="text-sm text-muted-foreground">
        {metrics.sets} {l("working sets", "مجموعات عمل")} ·{" "}
        {formatMeasure(displayWeight(metrics.kg, units))} {weightUnit(units)}{" "}
        {l("external-load volume", "حجم الحمل الخارجي")} · {metrics.seconds} s
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="mb-2 text-start">
            {l("Complete workout set log", "السجل الكامل لمجموعات الجلسة")}
          </caption>
          <thead>
            <tr>
              {[
                l("Exercise", "التمرين"),
                l("Performance", "الأداء"),
                l("Type / side", "النوع / الجانب"),
                "RPE",
              ].map((label) => (
                <th className="p-2 text-start" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {query.data.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">
                  {historicalExerciseLabel(row.workout_exercises?.snapshot, row.exercises, locale)}
                </td>
                <td className="p-2">
                  <bdi>
                    {row.duration_seconds != null
                      ? `${row.duration_seconds} s`
                      : `${row.reps ?? "—"} ${l("reps", "تكرارات")}`}{" "}
                    ·{" "}
                    {row.weight_kg == null
                      ? "—"
                      : formatMeasure(displayWeight(row.weight_kg, units))}{" "}
                    {weightUnit(units)}
                  </bdi>
                  <span className="block text-xs text-muted-foreground">
                    {trainingLabel(row.load_convention ?? "external_total", locale)}
                  </span>
                </td>
                <td className="p-2">
                  {trainingLabel(row.set_role ?? "working", locale)} ·{" "}
                  {trainingLabel(row.side ?? "bilateral", locale)}
                  {row.set_role === "drop" ? ` · ${row.segment_index}` : ""}
                </td>
                <td className="p-2">{row.rpe ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoachMeasurements({ actor, member }: { actor: string; member: string }) {
  const { locale, t } = useI18n(),
    ar = locale === "ar",
    units = useUnits(actor),
    [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["coach-member-measurements", actor, member, page],
    retry: false,
    queryFn: async () => {
      if (!(await coachMemberAccess(actor, member)))
        throw new Error("Member access is no longer available.");
      const result = await supabase
        .from("body_measurements")
        .select("*")
        .eq("member_id", member)
        .order("measured_on", { ascending: false })
        .order("id")
        .range(page * 20, page * 20 + 20);
      if (result.error) throw result.error;
      return { rows: result.data.slice(0, 20), more: result.data.length > 20 };
    },
  });
  return (
    <section className="mt-6 rounded-xl border bg-card p-5">
      <h2 className="font-display text-lg font-bold">{t("body")}</h2>
      {query.isPending ? (
        <p role="status">{ar ? "جارٍ تحميل القياسات…" : "Loading measurements…"}</p>
      ) : query.error ? (
        <QueryFailure onRetry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data?.rows.length && (
            <p className="mt-3 text-sm">
              {ar ? "لا توجد قياسات متاحة." : "No measurements available."}
            </p>
          )}
          <ul className="mt-3 divide-y">
            {query.data?.rows.map((row) => (
              <li className="py-3 text-sm" key={row.id}>
                <bdi>{row.measured_on}</bdi>
                <p>
                  {t("weight")}:{" "}
                  <bdi>
                    {row.weight_kg == null
                      ? "—"
                      : formatMeasure(displayWeight(row.weight_kg, units))}{" "}
                    {weightUnit(units)}
                  </bdi>{" "}
                  · {t("waist")}:{" "}
                  <bdi>
                    {row.waist_cm == null ? "—" : formatMeasure(displayLength(row.waist_cm, units))}{" "}
                    {lengthUnit(units)}
                  </bdi>{" "}
                  · {t("bodyFat")}: <bdi>{row.body_fat_pct ?? "—"}%</bdi>
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!page}
              onClick={() => setPage((value) => value - 1)}
            >
              {ar ? "قياسات أحدث" : "Newer measurements"}
            </Button>
            <Button
              variant="outline"
              disabled={!query.data?.more}
              onClick={() => setPage((value) => value + 1)}
            >
              {ar ? "قياسات أقدم" : "Older measurements"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

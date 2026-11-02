import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { normalizeExercise } from "@/lib/exercise-guidance";
import {
  programInput,
  createProgram,
  loadPrograms,
  loadEditorExercises,
  programSearch,
  type Program,
} from "@/lib/admin-programs";
import { ProgramBuilder } from "@/components/program-builder";
import { AdminEditorDrawer, AdminDraftWarning } from "@/components/admin-editor-drawer";
import { AdminChangeReview, type AdminReview } from "@/components/admin-change-review";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/_shell/admin/programs")({
  validateSearch: programSearch,
  head: () => ({
    meta: [
      { title: "Training programs — Prime Fitness Admin" },
      {
        name: "description",
        content: "Build multi-week training programs and assign them to members.",
      },
      { property: "og:title", content: "Training programs — Prime Fitness Admin" },
      {
        property: "og:description",
        content: "Build multi-week training programs and assign them to members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Programs,
});

function Programs() {
  const { user } = Route.useRouteContext(),
    search = Route.useSearch(),
    navigate = Route.useNavigate(),
    { data: me } = useMe(user.id),
    { t, locale } = useI18n(),
    qc = useQueryClient(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const allowed = !!me?.isAdmin && !!me.profile?.access_active;
  const [open, setOpen] = useState(false),
    [review, setReview] = useState<AdminReview | null>(null),
    [draft, setDraft] = useState(() => ({
      id: crypto.randomUUID(),
      name: "",
      description: "",
      weeks: "4",
    })),
    [pending, setPending] = useState<{
      id: string;
      name: string;
      description: string | null;
      weeks: number;
    } | null>(null),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState<Record<string, boolean>>({}),
    [visited, setVisited] = useState<Program[]>([]),
    [page, setPage] = useState(1);
  const reportDirty = useCallback(
    (id: string, value: boolean) =>
      setDirty((old) => (old[id] === value ? old : { ...old, [id]: value })),
    [],
  );
  const programs = useQuery({
      queryKey: ["admin-programs", user.id],
      enabled: allowed,
      retry: false,
      queryFn: ({ signal }) => loadPrograms(signal),
    }),
    exercises = useQuery({
      queryKey: ["program-editor-exercises", user.id],
      enabled: allowed && !!search.program,
      retry: false,
      queryFn: ({ signal }) => loadEditorExercises(signal),
    });
  const current = programs.data?.find((p) => p.id === search.program);
  useEffect(() => {
    if (current)
      setVisited((old) => (old.some((p) => p.id === current.id) ? old : [...old, current]));
  }, [current]);
  const rows = (programs.data ?? []).filter((p) =>
      normalizeExercise(p.name).includes(normalizeExercise(search.q ?? "")),
    ),
    pages = Math.max(1, Math.ceil(rows.length / 20)),
    shown = Math.min(page, pages);
  function select(p: Program) {
    setVisited((old) => (old.some((x) => x.id === p.id) ? old : [...old, p]));
    void navigate({
      search: (old) => ({ ...old, program: p.id, week: undefined, day: undefined }),
    });
  }
  // Deep links also open a builder; normal selection retains every visited program draft.
  const builders =
    current && !visited.some((p) => p.id === current.id) ? [...visited, current] : visited;
  function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const request = pending ?? { id: draft.id, ...programInput(draft) };
      setReview({
        title: l("Review new program", "مراجعة برنامج جديد"),
        description: request.name,
        details: (
          <p>
            {request.weeks} {t("weeks")} · {request.description}
          </p>
        ),
        save: async () => {
          const row = await createProgram(user.id, request, () => setPending(request));
          qc.setQueryData<Program[]>(["admin-programs", user.id], (old) => [
            row,
            ...(old ?? []).filter((p) => p.id !== row.id),
          ]);
          void qc.invalidateQueries({ queryKey: ["admin-programs", user.id] });
          setPending(null);
          setDraft({ id: crypto.randomUUID(), name: "", description: "", weeks: "4" });
          setOpen(false);
          select(row);
        },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (me && !allowed) return <p className="mt-10">{t("notAllowed")}</p>;
  return (
    <>
      <PageHeader eyebrow={t("admin")} title={t("programs")} />
      <p className="mt-3 text-sm text-muted-foreground">
        {l(
          "Build the editable draft one session at a time. Publishing creates a frozen version; assignment is a separate reviewed step.",
          "ابنِ المسودة جلسةً واحدة في كل مرة. ينشئ النشر نسخة مجمدة؛ التعيين خطوة مراجعة منفصلة.",
        )}
      </p>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="w-full max-w-sm text-sm">
          {l("Search programs", "بحث البرامج")}
          <Input
            className="mt-1"
            value={search.q ?? ""}
            onChange={(e) => {
              setPage(1);
              void navigate({
                search: (old) => ({ ...old, q: e.target.value || undefined }),
                replace: true,
              });
            }}
          />
        </label>
        <Button
          disabled={!allowed || !!programs.error || programs.isPending}
          onClick={() => setOpen(true)}
        >
          {l("Create program", "إنشاء برنامج")}
        </Button>
      </div>
      {programs.isPending && (
        <p role="status" className="mt-4">
          {l("Loading programs…", "جارٍ تحميل البرامج…")}
        </p>
      )}
      {programs.error && (
        <div role="alert" className="mt-4">
          {l(
            "The complete program list could not be loaded. Drafts are retained and writes are paused.",
            "تعذر تحميل قائمة البرامج كاملة. تم الاحتفاظ بالمسودات وإيقاف التعديلات.",
          )}
          <Button variant="outline" onClick={() => void programs.refetch()}>
            {l("Retry programs", "إعادة تحميل البرامج")}
          </Button>
        </div>
      )}
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {rows.slice((shown - 1) * 20, shown * 20).map((p) => (
          <li key={p.id} className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-4">
            <p className="break-words font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">
              {p.weeks} {t("weeks")} · {l("Editable draft", "مسودة قابلة للتعديل")}
            </p>
            <Button
              variant={p.id === search.program ? "default" : "outline"}
              onClick={() => select(p)}
            >
              {l("Open builder", "فتح المحرر")}
            </Button>
          </li>
        ))}
      </ul>
      {!programs.isPending && !programs.error && !rows.length && (
        <p role="status" className="mt-4">
          {l("No programs match this search.", "لا توجد برامج تطابق البحث.")}
        </p>
      )}
      {pages > 1 && (
        <nav
          className="mt-4 flex items-center justify-between gap-3"
          aria-label={l("Program pages", "صفحات البرامج")}
        >
          <Button variant="outline" disabled={shown === 1} onClick={() => setPage(shown - 1)}>
            {l("Previous programs", "البرامج السابقة")}
          </Button>
          <span>
            <bdi>
              {shown} / {pages}
            </bdi>
          </span>
          <Button variant="outline" disabled={shown === pages} onClick={() => setPage(shown + 1)}>
            {l("Next programs", "البرامج التالية")}
          </Button>
        </nav>
      )}
      {search.program && !current && !programs.isPending && !programs.error && (
        <p role="alert" className="mt-5">
          {l("This program is unavailable.", "هذا البرنامج غير متاح.")}
        </p>
      )}
      {builders.map((p) => (
        <div key={p.id} hidden={p.id !== search.program}>
          <ProgramBuilder
            actor={user.id}
            program={programs.data?.find((x) => x.id === p.id) ?? p}
            visible={p.id === search.program}
            enabled={allowed && !programs.error && !!current}
            week={p.id === search.program ? Math.min(search.week ?? 1, p.weeks) : 1}
            day={p.id === search.program ? (search.day ?? 1) : 1}
            onSession={(week, day) =>
              void navigate({
                search: (old) => ({
                  ...old,
                  program: p.id,
                  week: week === 1 ? undefined : week,
                  day: day === 1 ? undefined : day,
                }),
              })
            }
            exercises={{
              data: exercises.data,
              error: exercises.error,
              isPending: exercises.isPending,
              refetch: exercises.refetch,
            }}
            onDirty={(id, value) => reportDirty(`${p.id}:${id}`, value)}
          />
        </div>
      ))}
      <AdminEditorDrawer
        open={open}
        close={() => setOpen(false)}
        locked={!!review}
        title={l("Create program", "إنشاء برنامج")}
        description={l(
          "Choose a name, notes and a length of 1–52 weeks.",
          "اختر اسماً وملاحظات ومدة من أسبوع إلى ٥٢ أسبوعاً.",
        )}
      >
        <form onSubmit={create} className="space-y-4">
          {(
            [
              ["name", l("Program name", "اسم البرنامج")],
              ["description", l("Program notes", "ملاحظات البرنامج")],
              ["weeks", l("Weeks", "الأسابيع")],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="block text-sm">
              {label}
              <Input
                className="mt-1"
                required={k !== "description"}
                inputMode={k === "weeks" ? "numeric" : undefined}
                value={draft[k]}
                disabled={!!pending || !!review}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            </label>
          ))}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {pending && (
            <p role="status" className="text-sm">
              {l(
                "Retry this same request to confirm whether the program was created.",
                "أعد محاولة الطلب نفسه لتأكيد إنشاء البرنامج.",
              )}
            </p>
          )}
          <Button type="submit" disabled={!!review || !allowed || !!programs.error}>
            {l("Review new program", "مراجعة برنامج جديد")}
          </Button>
        </form>
      </AdminEditorDrawer>
      <AdminChangeReview review={review} close={() => setReview(null)} />
      <AdminDraftWarning
        dirty={
          allowed &&
          (Object.values(dirty).some(Boolean) ||
            !!draft.name ||
            !!draft.description ||
            draft.weeks !== "4" ||
            !!review)
        }
      />
    </>
  );
}

import { NativeSelect } from "@/components/ui/native-select";
import { MemberSections } from "@/components/member-sections";
import { pageSection } from "@/lib/member-sections";
import { BackupRestore } from "@/components/backup-restore";
import { lazy, Suspense } from "react";
const TrainingImport = lazy(() =>
  import("@/components/training-import").then((m) => ({ default: m.TrainingImport })),
);
import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { PasswordField } from "@/components/auth-fields";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DeviceSettings } from "@/components/device-settings";
import { Camera, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useGamification } from "@/hooks/use-gamification";
import { useI18n, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { RankCrest } from "@/components/rank-crest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/_shell/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Prime Fitness" },
      {
        name: "description",
        content: "Your Prime Fitness athlete profile, preferences and security.",
      },
      { property: "og:title", content: "Profile — Prime Fitness" },
      {
        property: "og:description",
        content: "Your Prime Fitness athlete profile, preferences and security.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (
    raw: Record<string, unknown>,
  ): { section?: "account" | "preferences" | "offline" | "privacy" | undefined } => ({
    section: pageSection(
      raw["section"],
      ["account", "preferences", "offline", "privacy"],
      "account",
    ),
  }),
  component: Profile,
});

async function compress(file: File, max = 512): Promise<Blob> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
}

function Profile() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch(),
    navigate = Route.useNavigate(),
    section = search.section ?? "account";
  const { data } = useMe(user.id);
  const { data: g } = useGamification(user.id);
  const { t, locale: cur, setLocale } = useI18n();
  const ar = cur === "ar";
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [units, setUnits] = useState("metric");
  const [locale, setLoc] = useState<Locale>("ar");
  const [optIn, setOptIn] = useState(false);
  const [rest, setRest] = useState(90);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [baseline, setBaseline] = useState("");
  const initializedProfile = useRef<unknown>(null);
  const signingOut = useRef(false);
  const signature = JSON.stringify([name, units, locale, optIn, rest]);
  const dirty = !!baseline && signature !== baseline;
  const [saveMessage, setSaveMessage] = useState(""),
    [saveError, setSaveError] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(""),
    [passwordError, setPasswordError] = useState(false);
  const unsaved = dirty || !!pw || !!pw2;
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      !signingOut.current &&
      unsaved &&
      (current.pathname !== next.pathname ||
        JSON.stringify(current.search) !== JSON.stringify(next.search)),
    withResolver: true,
    enableBeforeUnload: () => !signingOut.current && unsaved,
  });
  function discardDrafts() {
    if (baseline) {
      const [savedName, savedUnits, savedLocale, savedOptIn, savedRest] = JSON.parse(baseline) as [
        string,
        string,
        Locale,
        boolean,
        number,
      ];
      setName(savedName);
      setUnits(savedUnits);
      setLoc(savedLocale);
      setOptIn(savedOptIn);
      setRest(savedRest);
    }
    setPw("");
    setPw2("");
  }
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRest(Number(localStorage.getItem("pf-rest-seconds")) || 90);
  }, []);
  useEffect(() => {
    if (!data?.profile || initializedProfile.current === data.profile) return;
    initializedProfile.current = data.profile;
    if (dirty) return;
    setName(data.profile.display_name ?? "");
    setUnits(data.profile.units);
    setLoc(data.profile.locale === "en" ? "en" : "ar");
    setOptIn(data.profile.leaderboard_opt_in);
    const savedRest = Number(localStorage.getItem("pf-rest-seconds")) || 90;
    setRest(savedRest);
    setBaseline(
      JSON.stringify([
        data.profile.display_name ?? "",
        data.profile.units,
        data.profile.locale === "en" ? "en" : "ar",
        data.profile.leaderboard_opt_in,
        savedRest,
      ]),
    );
  }, [data?.profile, dirty]);

  const avatarPath = data?.profile?.avatar_url;
  const { data: avatarUrl } = useQuery({
    queryKey: ["avatar", avatarPath],
    enabled: section === "account" && !!avatarPath,
    queryFn: async () =>
      (await supabase.storage.from("progress-photos").createSignedUrl(avatarPath!, 3600)).data
        ?.signedUrl ?? null,
  });
  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user.id],
    enabled: section === "account",
    queryFn: async () => {
      const [w, b] = await Promise.all([
        supabase
          .from("workout_sessions")
          .select("id", { count: "exact", head: true })
          .eq("member_id", user.id)
          .not("finished_at", "is", null),
        supabase
          .from("member_badges")
          .select("badge_code", { count: "exact", head: true })
          .eq("member_id", user.id),
      ]);
      return { workouts: w.count ?? 0, badges: b.count ?? 0 };
    },
  });

  async function save() {
    if (busy) return;
    setSaveMessage("");
    setSaveError(false);
    setBusy(true);
    try {
      const { data: saved, error } = await supabase
        .from("profiles")
        .update({ display_name: name, units, locale, leaderboard_opt_in: optIn })
        .eq("id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!saved?.id)
        throw new Error(
          ar
            ? "تعذر حفظ التفضيلات. حدّث الصفحة وحاول مجددًا."
            : "Could not save preferences. Refresh and try again.",
        );
      localStorage.setItem("pf-rest-seconds", String(rest));
      setLocale(locale);
      setBaseline(signature);
      qc.invalidateQueries({ queryKey: ["me", user.id] });
      setSaveMessage(t("saved"));
    } catch (error) {
      setSaveError(true);
      setSaveMessage(
        (error as { message?: string }).message ??
          (ar ? "تعذر حفظ التفضيلات." : "Could not save preferences."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(f?: File) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return void toast.error(t("imageOnly"));
    setBusy(true);
    try {
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const up = await supabase.storage
        .from("progress-photos")
        .upload(path, await compress(f), { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      if (error) throw error;
      if (avatarPath) await supabase.storage.from("progress-photos").remove([avatarPath]);
      qc.invalidateQueries({ queryKey: ["me", user.id] });
      toast.success(t("saved"));
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  async function changePw() {
    if (busy) return;
    setPasswordError(true);
    if (pw.length < 8)
      return void setPasswordMessage(ar ? "8 أحرف على الأقل" : "At least 8 characters");
    if (pw !== pw2)
      return void setPasswordMessage(ar ? "كلمتا المرور غير متطابقتين" : "Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return void setPasswordMessage(error.message);
    setPw("");
    setPw2("");
    setPasswordError(false);
    setPasswordMessage(ar ? "تم تغيير كلمة المرور" : "Password changed");
  }

  const p = data?.profile;
  const joined = p
    ? new Date(p.created_at).toLocaleDateString(ar ? "ar-EG" : "en-GB", {
        year: "numeric",
        month: "long",
      })
    : "";

  const card = "rounded-xl border border-border bg-card p-6";
  return (
    <>
      <PageHeader title={t("profile")} />
      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <AlertDialogContent dir={ar ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{ar ? "تغييرات غير محفوظة" : "Unsaved changes"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "احفظ تغييراتك أو تجاهلها قبل المغادرة."
                : "Save your changes or discard them before leaving."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              {ar ? "متابعة التعديل" : "Keep editing"}
            </AlertDialogCancel>
            <Button
              disabled={busy}
              onClick={() => {
                discardDrafts();
                blocker.proceed?.();
              }}
            >
              {ar ? "تجاهل ومتابعة" : "Discard and continue"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MemberSections
        label={ar ? "أقسام الملف" : "Profile sections"}
        value={section}
        disabled={busy}
        items={[
          ["account", ar ? "الحساب" : "Account"],
          ["preferences", ar ? "التفضيلات" : "Preferences"],
          ["offline", ar ? "التطبيق ودون اتصال" : "App & offline"],
          ["privacy", ar ? "البيانات والخصوصية" : "Data & privacy"],
        ]}
        onSelect={(section) =>
          void navigate({ search: { section: section === "account" ? undefined : section } })
        }
      />

      <div className="mt-8 grid max-w-3xl gap-6">
        {section === "account" && (
          <>
            {/* Member card */}
            <div className={`${card} gold-glow`}>
              <div className="flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-gold bg-muted"
                  aria-label={ar ? "تغيير الصورة" : "Change photo"}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center font-heading text-2xl text-gold">
                      {(name || p?.email || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex justify-center bg-background/70 py-0.5">
                    <Camera className="size-3.5" />
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => uploadAvatar(e.target.files?.[0])}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-xl font-bold">{name || p?.email}</p>
                  <p className="truncate text-sm text-muted-foreground">{p?.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 ${p?.access_active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
                    >
                      {p?.access_active ? t("accessOn") : t("accessOff")}
                    </span>
                    {data?.roles.map((r) => (
                      <span key={r} className="rounded-full bg-muted px-2 py-0.5">
                        {r}
                      </span>
                    ))}
                    {joined && (
                      <span className="text-muted-foreground">
                        {ar ? "عضو منذ" : "Member since"} {joined}
                      </span>
                    )}
                  </div>
                </div>
                {g && <RankCrest rank={g.rank.key} size={64} />}
              </div>
              {g && (
                <div className="mt-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gold">
                      {ar ? g.rank.ar : g.rank.key} · {t("level")} {g.level}
                    </span>
                    <span className="text-muted-foreground">
                      {g.xp} {t("xp")}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-gold"
                      style={{ width: `${Math.round(g.pct * 100)}%` }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    {[
                      [t("totalWorkouts"), stats?.workouts ?? "–"],
                      [t("badges"), stats?.badges ?? "–"],
                      [t("pvWallet"), g.pv],
                    ].map(([l, v]) => (
                      <div key={String(l)} className="rounded-lg bg-muted/50 p-3">
                        <p className="font-heading text-lg font-bold">{v}</p>
                        <p className="text-xs text-muted-foreground">{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        {section === "preferences" && (
          <>
            {/* Preferences */}
            <div className={`${card} space-y-4`}>
              <h2 className="font-heading font-semibold">{ar ? "التفضيلات" : "Preferences"}</h2>
              <div className="space-y-2">
                <Label htmlFor="profile-display-name">{t("displayName")}</Label>
                <Input
                  id="profile-display-name"
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-language">{t("language")}</Label>
                  <NativeSelect
                    id="profile-language"
                    value={locale}
                    onChange={(e) => setLoc(e.target.value as Locale)}
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-units">{t("units")}</Label>
                  <NativeSelect
                    id="profile-units"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                  >
                    <option value="metric">{t("metric")}</option>
                    <option value="imperial">{t("imperial")}</option>
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-rest">
                    {ar ? "مدة الراحة الافتراضية" : "Default rest timer"}
                  </Label>
                  <NativeSelect
                    id="profile-rest"
                    value={rest}
                    onChange={(e) => setRest(Number(e.target.value))}
                  >
                    {[30, 60, 90, 120, 180, 240].map((s) => (
                      <option key={s} value={s}>
                        {s >= 60 ? `${s / 60} ${t("min")}` : `${s}s`}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-lg bg-muted/40 p-3 text-sm">
                <span>
                  {t("showMe")}
                  <span className="block text-xs text-muted-foreground">{t("lbHint")}</span>
                </span>
                <Switch checked={optIn} onCheckedChange={setOptIn} />
              </label>
              {dirty && (
                <p role="status" className="text-sm text-gold">
                  {ar ? "تغييرات غير محفوظة" : "Unsaved preferences"}
                </p>
              )}
              {saveMessage && (
                <p role={saveError ? "alert" : "status"} className="text-sm">
                  {saveMessage}
                </p>
              )}
              <Button onClick={save} disabled={busy || !dirty}>
                {t("save")}
              </Button>
            </div>
          </>
        )}
        {section === "offline" && <DeviceSettings />}
        {section === "account" && (
          <>
            {/* Security */}
            <div className={`${card} space-y-4`}>
              <h2 className="font-heading font-semibold">
                {ar ? "تغيير كلمة المرور" : "Change password"}
              </h2>
              <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                <PasswordField
                  id="profile-new-password"
                  fresh
                  label={ar ? "كلمة المرور الجديدة" : "New password"}
                  value={pw}
                  onChange={setPw}
                  invalid={passwordError}
                  errorId="profile-password-feedback"
                />
                <PasswordField
                  id="profile-confirm-password"
                  fresh
                  label={ar ? "تأكيد كلمة المرور" : "Confirm password"}
                  value={pw2}
                  onChange={setPw2}
                  invalid={passwordError}
                  errorId="profile-password-feedback"
                />
              </fieldset>
              {passwordMessage && (
                <p
                  id="profile-password-feedback"
                  role={passwordError ? "alert" : "status"}
                  className="text-sm"
                >
                  {passwordMessage}
                </p>
              )}
              <Button variant="secondary" onClick={changePw} disabled={busy || !pw}>
                {ar ? "تحديث كلمة المرور" : "Update password"}
              </Button>
            </div>
          </>
        )}
        {section === "privacy" && (
          <>
            <BackupRestore userId={user.id} />
            <Suspense fallback={<p role="status">…</p>}>
              <TrainingImport userId={user.id} />
            </Suspense>
          </>
        )}
        {/* Data & account */}
        <div className={`${card} flex flex-wrap gap-3`}>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              signingOut.current = true;
              discardDrafts();
              const result = await supabase.auth.signOut();
              if (result.error) {
                signingOut.current = false;
                setPasswordError(true);
                setPasswordMessage(result.error.message);
              }
            }}
          >
            <LogOut className="size-4" />
            {t("signOut")}
          </Button>
        </div>
      </div>
    </>
  );
}

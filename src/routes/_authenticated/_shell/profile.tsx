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
import { Camera, ChevronDown, ChevronRight, Cloud, LogOut, Settings2 } from "lucide-react";
import { signOutMember, supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { staffAccess } from "@/features/navigation/workspace";
import { useMemberData } from "@/hooks/use-member-data";
import { readMemberState } from "@/lib/member-store";
import { isTransientConnectionError } from "@/lib/offline-access";
import {
  changedProfileSettings,
  blockedProfileSettings,
  discardBlockedProfileSettings,
  profileSettingsStatus,
  queueProfileSettings,
  type ProfileSettings,
} from "@/lib/offline-profile-settings";
import { useGamification } from "@/hooks/use-gamification";
import { useI18n, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { RankCrest } from "@/components/rank-crest";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
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
  const { state: memberState } = useMemberData(user.id);
  const settingsStatus = profileSettingsStatus(memberState);
  const settingsBlocked = settingsStatus === "conflict" || settingsStatus === "rejected";
  // While blocked, show the held-back edits so the member sees what discarding drops.
  const blockedEdits = JSON.stringify(blockedProfileSettings(memberState) ?? null);
  const { data: g } = useGamification(user.id);
  const { t, locale: cur, setLocale } = useI18n();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarCamera = useRef<HTMLInputElement>(null);
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
  const initializedProfile = useRef<[typeof data, string]>(undefined);
  const settingsBaseline = useRef<ProfileSettings | null>(null);
  const signingOut = useRef(false);
  const signature = JSON.stringify([name, units, locale, optIn, rest]);
  const dirty = !!baseline && signature !== baseline;
  const [saveMessage, setSaveMessage] = useState(""),
    [saveError, setSaveError] = useState(false);
  const [signOutError, setSignOutError] = useState("");
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
    const [seen, seenEdits] = initializedProfile.current ?? [];
    if (!data?.profile || (seen?.profile === data.profile && seenEdits === blockedEdits) || dirty)
      return;
    initializedProfile.current = [data, blockedEdits];
    settingsBaseline.current = data.profile;
    const shown = { ...data.profile, ...(JSON.parse(blockedEdits) as object | null) };
    setName(shown.display_name ?? "");
    setUnits(shown.units);
    setLoc(shown.locale === "en" ? "en" : "ar");
    setOptIn(shown.leaderboard_opt_in);
    const savedRest = Number(localStorage.getItem("pf-rest-seconds")) || 90;
    setRest(savedRest);
    setBaseline(
      JSON.stringify([
        shown.display_name ?? "",
        shown.units,
        shown.locale === "en" ? "en" : "ar",
        shown.leaderboard_opt_in,
        savedRest,
      ]),
    );
  }, [data, dirty, blockedEdits]);

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
    const previous = settingsBaseline.current;
    if (busy || !previous || !data?.profile?.access_active || settingsBlocked) return;
    setSaveMessage("");
    setSaveError(false);
    setBusy(true);
    try {
      const patch = changedProfileSettings(previous, {
        display_name: name === (previous.display_name ?? "") ? previous.display_name : name,
        units,
        locale,
        leaderboard_opt_in: optIn,
      });
      let savedOnDevice = false;
      if (Object.keys(patch).length) {
        const persistedState = await readMemberState(user.id).catch(() => null);
        const persistedStatus = persistedState && profileSettingsStatus(persistedState);
        if (persistedStatus === "conflict" || persistedStatus === "rejected")
          throw new Error("Pending preferences need review");
        if (navigator.onLine && !persistedStatus) {
          const response = await supabase
            .from("profiles")
            .update(patch)
            .eq("id", user.id)
            .select("id")
            .maybeSingle();
          if (!response.error && response.data?.id === user.id) {
            savedOnDevice = false;
          } else if (
            isTransientConnectionError(response.error) ||
            isTransientConnectionError({ status: response.status })
          ) {
            savedOnDevice = true;
          } else {
            throw new Error("Profile update was not confirmed");
          }
        } else {
          savedOnDevice = true;
        }
        if (savedOnDevice) {
          if (!data.offlineAccountPrepared) throw new Error("Offline account unavailable");
          await queueProfileSettings(user.id, previous, patch);
        }
        settingsBaseline.current = { ...previous, ...patch };
      }
      localStorage.setItem("pf-rest-seconds", String(rest));
      setLocale(locale);
      setBaseline(signature);
      qc.invalidateQueries({ queryKey: ["me", user.id] });
      setSaveMessage(savedOnDevice ? "" : t("saved"));
    } catch {
      setSaveError(true);
      setSaveMessage(ar ? "تعذر حفظ التفضيلات." : "Could not save preferences.");
    } finally {
      setBusy(false);
    }
  }

  async function discardPendingSettings() {
    setBusy(true);
    setSaveMessage("");
    try {
      await discardBlockedProfileSettings(user.id);
      discardDrafts();
      await qc.invalidateQueries({ queryKey: ["me", user.id] });
    } catch {
      setSaveError(true);
      setSaveMessage(ar ? "تعذر حذف التغييرات المعلقة." : "Could not discard pending changes.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(f?: File) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return void toast.error(t("imageOnly"));
    setBusy(true);
    let uploaded = false;
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
      if (error) {
        // Don't leave an unreferenced photo in storage.
        await supabase.storage.from("progress-photos").remove([path]);
        throw error;
      }
      if (avatarPath) await supabase.storage.from("progress-photos").remove([avatarPath]);
      qc.invalidateQueries({ queryKey: ["me", user.id] });
      toast.success(t("saved"));
      uploaded = true;
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
    return uploaded;
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
    ? new Date(p.created_at).toLocaleDateString(ar ? "ar-EG-u-nu-latn" : "en-GB", {
        year: "numeric",
        month: "long",
      })
    : "";

  // Presentation stays separate from the draft/blocker and upload controllers above.
  const card = "rounded-xl bg-card p-4 sm:p-5";
  return (
    <>
      {avatarFile && (
        <AvatarCropDialog
          key={`${user.id}:${avatarFile.lastModified}`}
          file={avatarFile}
          onCancel={() => setAvatarFile(null)}
          onConfirm={async (photo) => {
            const uploaded = await uploadAvatar(photo);
            if (!uploaded)
              throw new Error(
                ar ? "لم يتم حفظ الصورة. أعد المحاولة." : "Photo was not saved. Try again.",
              );
            setAvatarFile(null);
          }}
        />
      )}
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
        appearance="segmented"
        label={ar ? "أقسام الملف" : "Profile sections"}
        value={section}
        disabled={busy}
        items={[
          ["account", ar ? "الحساب" : "Account"],
          ["preferences", ar ? "التفضيلات" : "Preferences"],
          ["offline", ar ? "التطبيق" : "App"],
          ["privacy", ar ? "البيانات" : "Data"],
        ]}
        onSelect={(section) =>
          void navigate({ search: { section: section === "account" ? undefined : section } })
        }
      />

      <div data-stitch-profile className="mt-5 grid max-w-3xl gap-5">
        <TrainingPreferencesSummary value={p?.training_preferences} />
        {section === "account" && (
          <>
            {/* Member card */}
            <div className={card}>
              {/* Compact identity follows the reference; optional photo/activity controls
                  remain mounted in a native disclosure, preserving upload and crop ownership. */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-gold/60 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  aria-label={ar ? "تغيير الصورة" : "Change photo"}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center font-heading text-2xl text-gold">
                      {(name || p?.email || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex justify-center bg-background/80 py-1">
                    <Camera aria-hidden className="size-3.5" />
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  aria-label={ar ? "اختر صورة الملف الشخصي" : "Choose profile photo"}
                  onChange={(e) => {
                    setAvatarFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={avatarCamera}
                  type="file"
                  accept="image/*"
                  capture="user"
                  hidden
                  aria-label={ar ? "التقاط صورة الملف الشخصي" : "Take profile photo"}
                  onChange={(event) => {
                    setAvatarFile(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />

                <div className="min-w-0 flex-1">
                  <p className="break-words font-heading text-xl font-bold">{name || p?.email}</p>
                  {g && (
                    <p className="mt-1 text-sm text-gold">
                      {ar ? g.rank.ar : g.rank.key} · {t("level")} {g.level}
                    </p>
                  )}
                </div>
                {g && <RankCrest rank={g.rank.key} size={40} />}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-background p-3">
                  <dt className="text-xs text-muted-foreground">
                    {ar ? "حالة العضوية" : "Membership access"}
                  </dt>
                  <dd
                    className={`mt-1 font-medium ${p?.access_active ? "text-success" : "text-muted-foreground"}`}
                  >
                    {p ? (p.access_active ? t("accessOn") : t("accessOff")) : "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <dt className="text-xs text-muted-foreground">
                    {ar ? "عضو منذ" : "Member since"}
                  </dt>
                  <dd className="mt-1 font-medium">{joined || "—"}</dd>
                </div>
              </dl>
              <details className="group mt-3 border-t border-border pt-1" data-profile-activity>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold [&::-webkit-details-marker]:hidden">
                  {ar ? "الصورة والرتبة والنشاط" : "Photo, rank & activity"}
                  <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    {ar ? "المعرض" : "Gallery"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => avatarCamera.current?.click()}
                  >
                    <Camera aria-hidden className="size-4" />
                    {ar ? "التقاط صورة" : "Take photo"}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {data?.roles.map((role) => (
                    <span key={role} className="rounded-full bg-muted px-2 py-1">
                      {role}
                    </span>
                  ))}
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
                        <div key={String(l)} className="min-w-0 rounded-lg bg-background p-3">
                          <p className="font-heading text-lg font-bold">{v}</p>
                          <p className="text-xs text-muted-foreground">{l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </details>
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
              {settingsStatus === "pending" && (
                <p role="status" className="text-sm text-muted-foreground">
                  {ar
                    ? "تم الحفظ على هذا الجهاز. بانتظار المزامنة."
                    : "Saved on this device. Waiting to sync."}
                </p>
              )}
              {settingsBlocked && (
                <div className="space-y-2">
                  <p role="alert" className="text-sm">
                    {settingsStatus === "conflict"
                      ? ar
                        ? "تغيرت بعض التفضيلات على جهاز آخر. احذف التغييرات المعلقة لإعادة تعديلها."
                        : "Some preferences changed on another device. Discard pending edits to edit them again."
                      : ar
                        ? "تعذرت مزامنة التفضيلات. احذف التغييرات المعلقة لإعادة تعديلها."
                        : "Preferences could not sync. Discard pending edits to edit them again."}
                  </p>
                  <Button variant="secondary" onClick={discardPendingSettings} disabled={busy}>
                    {ar ? "حذف التغييرات المعلقة" : "Discard pending edits"}
                  </Button>
                </div>
              )}
              <Button onClick={save} disabled={busy || !dirty || settingsBlocked}>
                {t("save")}
              </Button>
            </div>
          </>
        )}
        {section === "offline" && (
          <DeviceSettings
            memberId={user.id}
            showStaffDownloads={
              staffAccess(data?.roles ?? [], data?.profile?.access_active === true).staff
            }
          />
        )}
        {section === "account" && (
          <>
            {/* Show actual account details; the mockup's passkey and ecosystem claims
                are not supported authentication methods or verified integrations. */}
            <section
              className={`${card} space-y-4`}
              aria-label={ar ? "بيانات الحساب" : "Account credentials"}
            >
              <h2 className="font-heading text-base font-bold">
                {ar ? "الأمان وبيانات الحساب" : "Security & credentials"}
              </h2>
              <div className="space-y-3 rounded-lg bg-background p-4 text-sm">
                <p className="text-xs text-muted-foreground">
                  {ar ? "بريد العضو" : "Member email"}
                </p>
                <p className="break-words" dir="ltr">
                  {p?.email || user.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ar ? "تسجيل الدخول بالبريد وكلمة المرور" : "Email and password sign-in"}
                </p>
              </div>
            </section>
            {/* Disclosure never clears values: unsaved-password navigation guards still apply. */}
            <details className={`${card} group`} data-profile-password>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-heading font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold [&::-webkit-details-marker]:hidden">
                {ar ? "تغيير كلمة المرور" : "Change password"}
                <ChevronDown
                  aria-hidden
                  className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <div className="space-y-4 pt-4">
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
            </details>
            {/* Overview rows link to existing URL sections; previews use saved profile
                values and never imply that a local queue is synchronized. */}
            <section
              aria-label={ar ? "نظرة عامة على التفضيلات" : "Preferences overview"}
              className="space-y-2"
            >
              <h2 className="px-1 font-heading text-base font-bold">
                {ar ? "نظرة عامة على التفضيلات" : "Preferences overview"}
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => void navigate({ search: { section: "preferences" } })}
                className={`${card} flex w-full items-center gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold`}
              >
                <Settings2 aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {ar ? "اللغة والوحدات والراحة" : "Language, units & rest"}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {p
                      ? `${p.locale === "ar" ? "العربية" : "English"} · ${p.units === "imperial" ? t("imperial") : t("metric")} · ${rest}s`
                      : "—"}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
              </button>
            </section>
            <section aria-label={ar ? "التخزين والمزامنة" : "Storage & sync"} className="space-y-2">
              <h2 className="px-1 font-heading text-base font-bold">
                {ar ? "التخزين والمزامنة" : "Storage & sync"}
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => void navigate({ search: { section: "offline" } })}
                aria-label={ar ? "مراجعة التطبيق ودون اتصال" : "Review app & offline"}
                className={`${card} flex w-full items-center gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold`}
              >
                <Cloud aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {ar ? "التطبيق ودون اتصال" : "App & offline"}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {ar
                      ? "مراجعة المزامنة والتخزين على الجهاز"
                      : "Review synchronization and device storage"}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
              </button>
            </section>
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
          {signOutError && (
            <p role="alert" className="w-full text-sm">
              {signOutError}
            </p>
          )}
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setSignOutError("");
              signingOut.current = true;
              discardDrafts();
              const result = await signOutMember();
              if (result.error) {
                signingOut.current = false;
                setSignOutError(result.error.message);
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
import { TrainingPreferencesSummary } from "@/components/training-preferences-summary";

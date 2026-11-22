import { createFileRoute, Link } from "@tanstack/react-router";
import { Dumbbell, Flame, Salad, Trophy } from "lucide-react";
import logo from "@/assets/logo.png";
import { RankCrest } from "@/components/rank-crest";
import { RANKS } from "@/lib/levels";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prime Fitness — Prime Vanguard" },
      {
        name: "description",
        content: "Train, fuel and rise through the ranks. Invite-only for Prime Vanguard members.",
      },
      { property: "og:title", content: "Prime Fitness — Prime Vanguard" },
      {
        property: "og:description",
        content: "Train, fuel and rise through the ranks. Invite-only for Prime Vanguard members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// Arabic copy is a draft until the founder approves it.
const copy = {
  en: {
    eyebrow: "Prime Vanguard members",
    lead: "Train, fuel your body and rise through six ranks with your Pod.",
    cta: "Member sign in",
    invite: "Access is by invitation only",
    ladder: "From Recruit to Prime Legend",
    pillars: [
      { icon: Dumbbell, title: "Train", text: "Programs and fast set logging." },
      { icon: Salad, title: "Fuel", text: "Targets, food log and water." },
      { icon: Flame, title: "Commit", text: "Streaks, quests and your Pod." },
      { icon: Trophy, title: "Rise", text: "Earn XP and climb the ranks." },
    ],
  },
  ar: {
    eyebrow: "لأعضاء برايم فانجارد",
    lead: "تدرّب، اهتم بأكلك، واطلع ست رتب مع البود بتاعك.",
    cta: "دخول الأعضاء",
    invite: "الدخول بدعوة فقط",
    ladder: "من مجنّد إلى أسطورة برايم",
    pillars: [
      { icon: Dumbbell, title: "تمرّن", text: "برامج وتسجيل سريع للمجموعات." },
      { icon: Salad, title: "تغذّى", text: "أهداف وسجل أكل ومياه." },
      { icon: Flame, title: "التزم", text: "سلاسل أيام ومهام والبود معاك." },
      { icon: Trophy, title: "اطلع", text: "اجمع XP واطلع في الرتب." },
    ],
  },
};

// Public entry point; membership and authorization are handled by the sign-in flow.
function Index() {
  const { locale } = useI18n();
  const c = copy[locale];
  return (
    <main className="bg-hero min-h-screen">
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-16 pb-10 text-center">
        {/* The logo artwork has a light background, so it sits on its own tile. */}
        <img
          src={logo}
          alt="Prime Vanguard"
          width={88}
          height={88}
          className="size-22 rounded-2xl bg-[#F1F5F9] object-contain p-1.5"
        />
        <p className="mt-6 text-sm font-semibold text-gold">{c.eyebrow}</p>
        <h1 dir="ltr" lang="en" className="mt-2 text-5xl font-extrabold sm:text-6xl">
          Prime Fitness
        </h1>
        <p className="mt-4 max-w-md text-lg text-muted-foreground">{c.lead}</p>
        <Link
          to="/auth"
          search={{ redirect: undefined }}
          className="mt-8 inline-flex min-h-12 items-center rounded-md bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {c.cta}
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">{c.invite}</p>
      </section>
      <section aria-label={c.ladder} className="mx-auto max-w-3xl px-6 pb-10 text-center">
        <ol className="flex items-end justify-center gap-1 sm:gap-3">
          {RANKS.map((rank, i) => (
            <li key={rank.key} className="flex flex-col items-center gap-1">
              <RankCrest rank={rank.key} size={40 + i * 6} />
              <span className="text-[11px] text-muted-foreground">
                {locale === "ar" ? rank.ar : rank.key}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="mx-auto grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 px-6 pb-20 sm:grid-cols-4">
        {c.pillars.map(({ icon: Icon, title, text }) => (
          <div key={title} className="text-start">
            <Icon className="h-5 w-5 text-gold" aria-hidden />
            <h2 className="mt-2 font-heading text-base font-bold">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

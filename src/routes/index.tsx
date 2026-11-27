import { createFileRoute, Link } from "@tanstack/react-router";
import { Dumbbell, Flame, MessageCircle, Salad, Trophy } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { RankStaircase } from "@/components/rank-staircase";
import { INVITE_WHATSAPP_URL } from "@/lib/contact";
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

const copy = {
  en: {
    title: "From Recruit to Prime Legend",
    lead: "Prime Fitness is the training app for Prime Vanguard members. Log your workouts and meals, keep your streak with your Pod, and earn XP to climb six ranks.",
    cta: "Member sign in",
    ask: "Ask for an invitation",
    invite: "Members join by invitation.",
    appTitle: "What you do in the app",
    pillars: [
      {
        icon: Dumbbell,
        title: "Train",
        text: "Follow your coach's program and log each set in seconds.",
      },
      {
        icon: Salad,
        title: "Fuel",
        text: "Hit your daily targets with a simple food and water log.",
      },
      {
        icon: Flame,
        title: "Commit",
        text: "Keep your streak, finish weekly quests and show up for your Pod.",
      },
      {
        icon: Trophy,
        title: "Rise",
        text: "Every workout earns XP. Climb from Recruit to Prime Legend.",
      },
    ],
    joinTitle: "How to join",
    steps: [
      { title: "Message us on WhatsApp", text: "Tell us you want to join Prime Vanguard." },
      { title: "Join the brotherhood", text: "We'll explain membership and the next steps." },
      {
        title: "Activate your invitation",
        text: "Your coach emails it to you. Set a password and start training.",
      },
    ],
    disclaimer:
      "Prime Fitness gives general training and nutrition guidance, not medical advice. Check with a doctor before starting a new program.",
  },
  ar: {
    title: "من مجنّد إلى أسطورة برايم",
    lead: "برايم فيتنس هو تطبيق التدريب لأعضاء برايم فانجارد. سجّل تمارينك وأكلك، حافظ على سلسلة أيامك مع البود بتاعك، واجمع XP عشان تطلع ست رتب.",
    cta: "دخول الأعضاء",
    ask: "اطلب دعوة",
    invite: "الانضمام بدعوة فقط.",
    appTitle: "هتعمل إيه في التطبيق",
    pillars: [
      { icon: Dumbbell, title: "تمرّن", text: "امشِ على برنامج مدربك وسجّل كل مجموعة في ثواني." },
      { icon: Salad, title: "تغذّى", text: "حقق أهدافك اليومية بسجل أكل ومياه بسيط." },
      {
        icon: Flame,
        title: "التزم",
        text: "حافظ على سلسلتك، خلّص مهام الأسبوع، وكن حاضر مع البود.",
      },
      { icon: Trophy, title: "اطلع", text: "كل تمرين بيجيبلك XP. اطلع من مجنّد لأسطورة برايم." },
    ],
    joinTitle: "إزاي تنضم",
    steps: [
      { title: "ابعتلنا على واتساب", text: "قولنا إنك عايز تنضم لبرايم فانجارد." },
      { title: "انضم للأخوية", text: "هنشرحلك العضوية والخطوات الجاية." },
      { title: "فعّل دعوتك", text: "مدربك هيبعتها على إيميلك. اختار كلمة مرور وابدأ تمرين." },
    ],
    disclaimer:
      "برايم فيتنس بيقدم إرشادات عامة للتدريب والتغذية وليس نصيحة طبية. استشر طبيب قبل ما تبدأ برنامج جديد.",
  },
};

// Public entry point; membership and authorization are handled by the sign-in flow.
function Index() {
  const { locale, setLocale } = useI18n();
  const c = copy[locale];
  const ask = INVITE_WHATSAPP_URL && (
    <a
      href={INVITE_WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-gold/50 px-6 text-base font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <MessageCircle className="size-5" aria-hidden />
      {c.ask}
    </a>
  );
  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="public-glow min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <BrandLockup />
        <button
          type="button"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          lang={locale === "ar" ? "en" : "ar"}
          className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {locale === "ar" ? "English" : "العربية"}
        </button>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-16 lg:pb-24">
          <div className="text-start">
            <h1 className="max-w-xl font-heading text-[40px] font-extrabold leading-[1.05] tracking-tight text-balance sm:text-6xl">
              {c.title}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.lead}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth"
                search={{ redirect: undefined }}
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {c.cta}
              </Link>
              {ask}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{c.invite}</p>
          </div>
          <RankStaircase className="mx-auto w-full max-w-md lg:max-w-none" />
        </section>

        <section aria-labelledby="app-title" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="app-title" className="font-heading text-2xl font-extrabold sm:text-3xl">
              {c.appTitle}
            </h2>
            <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {c.pillars.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-card text-gold">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-heading text-lg font-bold">{title}</h3>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="join-title" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="join-title" className="font-heading text-2xl font-extrabold sm:text-3xl">
              {c.joinTitle}
            </h2>
            <ol className="mt-8 grid gap-8 sm:grid-cols-3">
              {c.steps.map((step, i) => (
                <li key={step.title} className="border-t-2 border-gold/60 pt-4">
                  <span className="font-heading text-sm font-bold text-gold" aria-hidden>
                    {i + 1}
                  </span>
                  <h3 className="mt-1 font-heading text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
            {ask && <div className="mt-10">{ask}</div>}
          </div>
        </section>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-xs leading-relaxed text-muted-foreground sm:px-6">
          <p className="max-w-2xl">{c.disclaimer}</p>
          <p>
            <bdi lang="en">© Prime Vanguard</bdi>
          </p>
        </div>
      </footer>
    </div>
  );
}

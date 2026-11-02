import { createFileRoute, Link } from "@tanstack/react-router";
import { Dumbbell, Flame, Salad, Trophy } from "lucide-react";
import logo from "@/assets/logo.png";

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

const pillars = [
  { icon: Dumbbell, title: "Train", text: "Structured programs and fast set logging." },
  { icon: Salad, title: "Fuel", text: "Targets, food log and water, side by side." },
  { icon: Flame, title: "Commit", text: "Streaks, quests and your Pod behind you." },
  { icon: Trophy, title: "Rise", text: "Earn XP and climb from Recruit to Prime Legend." },
];

function Index() {
  return (
    <main className="bg-hero min-h-screen">
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 pb-16 text-center">
        <img src={logo} alt="Prime Vanguard" className="h-28 w-28 object-contain" />
        <div className="mt-8 h-px w-24 bg-gold" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-gold">
          Prime Vanguard · Members only
        </p>
        <h1 className="mt-4 text-5xl font-extrabold sm:text-6xl">Prime Fitness</h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Discipline, earned. Train, fuel your body and rise through the ranks with your Pod.
        </p>
        <Link
          to="/auth"
          search={{ redirect: undefined }}
          className="mt-10 inline-flex items-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Member sign in
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">Access is by invitation only</p>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-6 text-start">
            <Icon className="h-6 w-6 text-gold" />
            <h2 className="mt-4 text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

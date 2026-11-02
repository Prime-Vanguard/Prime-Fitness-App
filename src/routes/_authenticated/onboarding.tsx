import { createFileRoute } from "@tanstack/react-router";
import { OnboardingWorkspace } from "@/components/onboarding-workspace";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Prime Fitness" },
      { name: "description", content: "Set up your Prime Fitness account." },
      { property: "og:title", content: "Welcome — Prime Fitness" },
      { property: "og:description", content: "Set up your Prime Fitness account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = Route.useRouteContext();
  return <OnboardingWorkspace key={user.id} actor={user.id} />;
}

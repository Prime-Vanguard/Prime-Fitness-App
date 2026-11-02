import { createFileRoute } from "@tanstack/react-router";
import { pageSection } from "@/lib/member-sections";
import { CoachMemberWorkspace, type CoachSection } from "@/components/coach-member-workspace";
export const Route = createFileRoute("/_authenticated/_shell/members_/$memberId")({
  head: () => ({
    meta: [
      { title: "Member details — Prime Fitness" },
      {
        name: "description",
        content: "Coach view of a member's workouts, nutrition and progress photos.",
      },
      { property: "og:title", content: "Member details — Prime Fitness" },
      {
        property: "og:description",
        content: "Coach view of a member's workouts, nutrition and progress photos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
  validateSearch: (raw: Record<string, unknown>): { section?: CoachSection | undefined } => ({
    section: pageSection(
      raw["section"],
      ["overview", "training", "nutrition", "checkins", "photos"],
      "overview",
    ),
  }),
});

function Page() {
  const { user } = Route.useRouteContext(),
    { memberId } = Route.useParams(),
    search = Route.useSearch(),
    navigate = Route.useNavigate();
  return (
    <CoachMemberWorkspace
      key={`${user.id}:${memberId}`}
      actor={user.id}
      member={memberId}
      section={search.section ?? "overview"}
      onSection={(section) =>
        void navigate({ search: { section: section === "overview" ? undefined : section } })
      }
    />
  );
}

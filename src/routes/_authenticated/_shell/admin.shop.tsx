import { createFileRoute } from "@tanstack/react-router";
import { AdminShopWorkspace } from "@/components/admin-shop-workspace";
import { shopSearch } from "@/lib/admin-shop";

export const Route = createFileRoute("/_authenticated/_shell/admin/shop")({
  validateSearch: shopSearch,
  head: () => ({
    meta: [
      { title: "Reward shop — Prime Fitness Admin" },
      { name: "description", content: "Manage rewards and fulfill PV Points redemptions." },
      { property: "og:title", content: "Reward shop — Prime Fitness Admin" },
      { property: "og:description", content: "Manage rewards and fulfill PV Points redemptions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch(),
    navigate = Route.useNavigate();
  return (
    <AdminShopWorkspace
      actor={user.id}
      search={search}
      onSearch={(next, replace = false) => {
        void navigate({ search: next, replace });
      }}
    />
  );
}

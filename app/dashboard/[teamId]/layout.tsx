"use client";

import SidebarLayout, { SidebarItem } from "@/components/sidebar-layout";
import { SelectedTeamSwitcher, useUser } from "@stackframe/stack";
import {
  BadgePercent,
  BarChart4,
  Columns3,
  Globe,
  Locate,
  Settings2,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

const navigationItems: SidebarItem[] = [
  {
    name: "Overview",
    href: "/",
    icon: Globe,
    type: "item",
  },
  {
    type: "label",
    name: "Management",
  },
  {
    name: "Federations",
    href: "/federations",
    icon: Users,
    type: "item",
  },
  {
    type: "label",
    name: "Transactions",
  },
  {
    name: "Onchain",
    href: "/onchain",
    icon: BarChart4,
    type: "item",
  },
  {
    name: "Lightning",
    href: "/lightning",
    icon: ShoppingCart,
    type: "item",
  },
  {
    name: "Ecash",
    href: "/ecash",
    icon: BadgePercent,
    type: "item",
  },
  {
    type: "label",
    name: "Settings",
  },
  {
    name: "Configuration",
    href: "/configuration",
    icon: Settings2,
    type: "item",
  },
];

export default function Layout(props: { children: React.ReactNode }) {
  const params = useParams<{ teamId: string }>();
  const user = useUser({ or: "redirect" });
  const team = user.useTeam(params.teamId);
  const router = useRouter();

  if (!team) {
    router.push("/dashboard");
    return null;
  }

  return (
    <SidebarLayout
      items={navigationItems}
      basePath={`/dashboard/${team.id}`}
      sidebarTop={
        <SelectedTeamSwitcher selectedTeam={team} urlMap={team => `/dashboard/${team.id}`} />
      }
      baseBreadcrumb={[
        {
          title: team.displayName,
          href: `/dashboard/${team.id}`,
        },
      ]}
    >
      {props.children}
    </SidebarLayout>
  );
}

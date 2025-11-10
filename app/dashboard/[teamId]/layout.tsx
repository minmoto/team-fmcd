"use client";

import SidebarLayout, { SidebarItem } from "@/components/sidebar-layout";
import { SelectedTeamSwitcher, useUser } from "@stackframe/stack";
import { Globe, Settings2, Users, Network } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { FMCDInfo } from "@/lib/types/fmcd";

function useNavigationItems(teamId: string): SidebarItem[] {
  const [fmcdInfo, setFmcdInfo] = useState<FMCDInfo | null>(null);

  useEffect(() => {
    async function fetchFederations() {
      try {
        const response = await fetch(`/api/team/${teamId}/fmcd/info`);
        if (response.ok) {
          const data = await response.json();
          setFmcdInfo(data);
        }
      } catch (error) {
        // Silently handle error - federations will just not appear in nav
        console.warn("Failed to fetch federations for navigation:", error);
      }
    }

    if (teamId) {
      fetchFederations();
    }
  }, [teamId]);

  const federationSubItems =
    fmcdInfo?.federations?.map(federation => ({
      name:
        federation.config.global.federation_name || `Fed ${federation.federation_id.slice(0, 8)}`,
      href: `/federations/${federation.federation_id}`,
      icon: Network,
    })) || [];

  return [
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
      subItems: federationSubItems,
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
}

export default function Layout(props: { children: React.ReactNode }) {
  const params = useParams<{ teamId: string }>();
  const user = useUser({ or: "redirect" });
  const team = user.useTeam(params.teamId);
  const router = useRouter();
  const navigationItems = useNavigationItems(params.teamId);

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

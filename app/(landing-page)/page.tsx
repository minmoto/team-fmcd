import { FeatureGrid } from "@/components/features";
import { Hero } from "@/components/hero";
import { stackServerApp } from "@/stack";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Users, Bitcoin, Shield, Network, Zap } from "lucide-react";

export default async function IndexPage() {
  const project = await stackServerApp.getProject();
  if (!project.config.clientTeamCreationEnabled) {
    return (
      <div className="w-full min-h-96 flex items-center justify-center">
        <div className="max-w-xl gap-4">
          <p className="font-bold text-xl">Setup Required</p>
          <p className="">
            {
              "To start using this project, please enable client-side team creation in the Stack Auth dashboard (Project > Team Settings). This message will disappear once the feature is enabled."
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Hero
        capsuleText="100% Open-source & Free"
        capsuleLink="https://github.com/minmoto/fmcd"
        title="FMCD Dashboard for Teams"
        subtitle="Manage your Fedimint Client Daemon instances, connect to federations, and monitor balances in a private, collaborative environment."
        primaryCtaText="Get Started"
        primaryCtaLink={stackServerApp.urls.signUp}
        secondaryCtaText="GitHub"
        secondaryCtaLink="https://github.com/minmoto/team-fmcd"
        credits={
          <>
            Powered by{" "}
            <a
              href="https://github.com/minmoto/fmcd"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              FMCD
            </a>{" "}
            &{" "}
            <a
              href="https://github.com/stack-auth/stack"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Stack Auth
            </a>
          </>
        }
      />

      <div id="features" />
      <FeatureGrid
        title="Features"
        subtitle="Powerful FMCD management for teams."
        items={[
          {
            icon: <Bitcoin className="h-12 w-12" />,
            title: "FMCD Integration",
            description:
              "Connect to Fedimint Client Daemon instances and manage Bitcoin wallets collaboratively.",
          },
          {
            icon: <Network className="h-12 w-12" />,
            title: "Wallet Management",
            description:
              "Connect to federations using invite codes and monitor all your federated wallets.",
          },
          {
            icon: <Zap className="h-12 w-12" />,
            title: "Real-time Balance Tracking",
            description: "Monitor Bitcoin balances across all connected federations in real-time.",
          },
          {
            icon: <Users className="h-12 w-12" />,
            title: "Team Collaboration",
            description:
              "Create teams with role-based permissions. Team admins configure, all members can view.",
          },
          {
            icon: <Shield className="h-12 w-12" />,
            title: "Secure & Private",
            description:
              "Server-side FMCD communication with encrypted credentials. Complete team isolation.",
          },
          {
            icon: <GitHubLogoIcon className="h-12 w-12" />,
            title: "100% Open-source",
            description: "Built with open-source tools: FMCD, Stack Auth, Next.js, and more.",
          },
        ]}
      />
    </>
  );
}

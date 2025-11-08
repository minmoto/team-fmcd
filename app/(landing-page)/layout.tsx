import { Footer } from "@/components/footer";
import { LandingPageHeader } from "@/components/landing-page-header";

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingPageHeader
        items={[
          { title: "Features", href: "/#features" },
          { title: "Github", href: "https://github.com/minmoto/team-fmcd", external: true },
        ]}
      />
      <main className="flex-1">{props.children}</main>
      <Footer
        builtBy="Minmo"
        builtByLink="https://minmo.to/"
        githubLink="https://github.com/minmoto/team-fmcd"
        twitterLink="https://twitter.com/minmo_to"
        linkedinLink="https://linkedin.com/company/minmoto"
      />
    </div>
  );
}

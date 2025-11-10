import { Metadata } from "next";
import { FMCDStatusCards } from "@/components/fmcd-status-cards";
import { RecentTransactions } from "@/components/recent-transactions";

export const metadata: Metadata = {
  title: "FMCD Dashboard",
  description: "Fedimint Client Daemon (FMCD) dashboard for teams.",
};

export default function DashboardPage() {
  return (
    <>
      <div className="flex-col">
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
          </div>

          <FMCDStatusCards />

          <RecentTransactions className="mt-8" />
        </div>
      </div>
    </>
  );
}

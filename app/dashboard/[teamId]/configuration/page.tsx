import { Metadata } from "next";
import { FMCDConfigComponent } from "@/components/fmcd-config";

export const metadata: Metadata = {
  title: "Configuration",
  description: "Team configuration settings.",
};

export default function ConfigurationPage() {
  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Team Configuration</h2>
        </div>
        <FMCDConfigComponent />
      </div>
    </div>
  );
}

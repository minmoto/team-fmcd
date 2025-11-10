import { Metadata } from "next";
import { FMCDConfigComponent } from "@/components/fmcd-config";
import { DisplayUnitsConfig } from "@/components/display-units-config";

export const metadata: Metadata = {
  title: "Configuration",
  description: "Configurations and settings.",
};

export default function ConfigurationPage() {
  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Manage your team or personal settings and preferences
          </p>
        </div>
        <div className="grid gap-4 sm:gap-6">
          <FMCDConfigComponent />
          <DisplayUnitsConfig />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, Bitcoin, Settings, Loader2 } from "lucide-react";
import { useDisplayUnits } from "@/hooks/use-display-units";
import { DisplayUnit } from "@/lib/preferences/display-units";

export function DisplayUnitsConfig() {
  const { displayUnit, setDisplayUnit, isLoaded, isUpdating } = useDisplayUnits();
  const [draftDisplayUnit, setDraftDisplayUnit] = useState<DisplayUnit>(displayUnit);
  const [isSaving, setIsSaving] = useState(false);

  // Update draft state when loaded preferences change
  useEffect(() => {
    if (isLoaded) {
      setDraftDisplayUnit(displayUnit);
    }
  }, [isLoaded, displayUnit]);

  const handleUnitChange = (value: string) => {
    setDraftDisplayUnit(value as DisplayUnit);
  };

  const handleSave = async () => {
    if (draftDisplayUnit === displayUnit) return; // No changes to save

    setIsSaving(true);
    try {
      await setDisplayUnit(draftDisplayUnit);
    } catch (error) {
      console.error("Failed to save display unit preference:", error);
      // Revert draft to current saved value
      setDraftDisplayUnit(displayUnit);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = draftDisplayUnit !== displayUnit;

  // Show loading state during hydration to prevent layout shift
  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Display Units
            </CardTitle>
            <div className="h-6 w-16 bg-muted rounded animate-pulse"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 lg:gap-6 animate-pulse">
              <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
                <div className="h-4 w-4 bg-muted rounded-full"></div>
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-full bg-muted">
                    <div className="h-5 w-5 bg-muted rounded"></div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-4 w-16 bg-muted rounded"></div>
                    <div className="h-3 w-8 bg-muted rounded"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
                <div className="h-4 w-4 bg-muted rounded-full"></div>
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-full bg-muted">
                    <div className="h-5 w-5 bg-muted rounded"></div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-4 w-12 bg-muted rounded"></div>
                    <div className="h-3 w-6 bg-muted rounded"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0">
              <div className="h-10 w-32 bg-muted rounded animate-pulse"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Display Units
          </CardTitle>
          <Badge variant="outline" className="capitalize">
            {displayUnit}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <RadioGroup
            value={draftDisplayUnit}
            onValueChange={handleUnitChange}
            className="flex flex-col sm:flex-row gap-4 lg:gap-6"
            disabled={isSaving}
          >
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
              <RadioGroupItem value={DisplayUnit.SATS} id="sats" />
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-orange-500/10">
                  <Coins className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <Label htmlFor="sats" className="text-sm font-medium cursor-pointer block">
                    Satoshis
                  </Label>
                  <p className="text-xs text-muted-foreground">sats</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
              <RadioGroupItem value={DisplayUnit.BTC} id="btc" />
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-orange-500/10">
                  <Bitcoin className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <Label htmlFor="btc" className="text-sm font-medium cursor-pointer block">
                    Bitcoin
                  </Label>
                  <p className="text-xs text-muted-foreground">BTC</p>
                </div>
              </div>
            </div>
          </RadioGroup>

          <div className="flex-shrink-0">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="w-full sm:w-auto lg:w-auto"
              size="lg"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

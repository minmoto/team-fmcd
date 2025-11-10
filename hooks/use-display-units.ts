"use client";

import { useState, useEffect } from "react";
import { 
  DisplayUnit, 
  fetchDisplayUnit, 
  updateDisplayUnit
} from "@/lib/preferences/display-units";

/**
 * React hook for managing display units preferences
 * Provides state management and persistence using Stack Auth user secrets
 */
export function useDisplayUnits() {
  const [displayUnit, setDisplayUnitState] = useState<DisplayUnit>(DisplayUnit.SATS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load preference from API on mount
  useEffect(() => {
    async function loadPreference() {
      try {
        // Fetch current preference from API
        const unit = await fetchDisplayUnit();
        setDisplayUnitState(unit);
      } catch (error) {
        console.warn("Failed to load display unit preference:", error);
        // Fall back to default
        setDisplayUnitState(DisplayUnit.SATS);
      } finally {
        setIsLoaded(true);
      }
    }

    loadPreference();
  }, []);

  // Save preference via API
  const saveDisplayUnit = async (unit: DisplayUnit) => {
    if (isUpdating) return; // Prevent concurrent updates
    
    setIsUpdating(true);
    try {      
      // Update via API
      await updateDisplayUnit(unit);
      
      // Update local state only after successful API call
      setDisplayUnitState(unit);
    } catch (error) {
      // Don't update local state on error, let the component handle it
      console.error("Failed to update display unit:", error);
      throw error; // Re-throw so component can handle the error
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    displayUnit,
    setDisplayUnit: saveDisplayUnit,
    isLoaded,
    isUpdating,
  };
}
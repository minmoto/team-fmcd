export enum DisplayUnit {
  SATS = "SATS",
  BTC = "BTC",
}

/**
 * Get the user's preferred display unit from API
 */
export async function fetchDisplayUnit(): Promise<DisplayUnit> {
  try {
    const response = await fetch("/api/user/preferences");
    if (response.ok) {
      const data = await response.json();
      return data.displayUnit || DisplayUnit.SATS;
    }
  } catch (error) {
    console.warn("Failed to fetch display unit preference:", error);
  }
  return DisplayUnit.SATS;
}

/**
 * Update the user's preferred display unit via API
 */
export async function updateDisplayUnit(unit: DisplayUnit): Promise<void> {
  try {
    const response = await fetch("/api/user/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayUnit: unit }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update preference: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error updating display unit preference:", error);
    throw error;
  }
}

/**
 * Format amount in millisatoshis according to specified unit
 * Note: This function requires the unit to be passed explicitly
 */
export function formatAmount(msats: number, unit: DisplayUnit): string {
  if (unit === DisplayUnit.BTC) {
    const btc = msats / 100000000000; // Convert msats to BTC
    return btc.toFixed(8);
  } else {
    const sats = msats / 1000; // Convert msats to sats
    return sats.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
}

/**
 * Get the display label for the specified unit
 */
export function getDisplayUnitLabel(unit: DisplayUnit): string {
  return unit === DisplayUnit.BTC ? "BTC" : "sats";
}

/**
 * Format amount with unit label according to specified unit
 */
export function formatAmountWithUnit(msats: number, unit: DisplayUnit): string {
  const amount = formatAmount(msats, unit);
  const label = getDisplayUnitLabel(unit);

  return `${amount} ${label}`;
}

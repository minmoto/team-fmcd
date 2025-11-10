"use client";

import { useDisplayUnits } from "@/hooks/use-display-units";
import { formatAmount, formatAmountWithUnit, getDisplayUnitLabel, DisplayUnit } from "@/lib/preferences/display-units";

interface AmountDisplayProps {
  /** Amount in millisatoshis */
  msats: number;
  /** Show both primary and secondary units */
  showSecondary?: boolean;
  /** Additional CSS classes for the primary amount */
  className?: string;
  /** Additional CSS classes for the secondary amount */
  secondaryClassName?: string;
  /** Force a specific display unit (overrides user preference) */
  forceUnit?: DisplayUnit;
  /** Show only the amount without the unit label */
  amountOnly?: boolean;
}

/**
 * AmountDisplay - A reusable component for displaying Bitcoin amounts
 * 
 * Features:
 * - Respects user's display unit preference (SATS or BTC)
 * - Shows secondary unit when showSecondary is true
 * - Handles hydration properly to prevent layout shifts
 * - Customizable styling
 * - Can force a specific unit regardless of preference
 */
export function AmountDisplay({
  msats,
  showSecondary = false,
  className = "",
  secondaryClassName = "text-xs text-muted-foreground",
  forceUnit,
  amountOnly = false,
}: AmountDisplayProps) {
  const { displayUnit, isLoaded } = useDisplayUnits();

  // Use the forced unit or user preference
  const effectiveUnit = forceUnit || displayUnit;

  // Show fallback during hydration to prevent layout shift
  if (!isLoaded && !forceUnit) {
    return (
      <div>
        <span className={className}>
          {amountOnly 
            ? formatAmount(msats, DisplayUnit.SATS)
            : formatAmountWithUnit(msats, DisplayUnit.SATS)
          }
        </span>
        {showSecondary && (
          <div className={secondaryClassName}>
            {formatAmount(msats, DisplayUnit.BTC)} BTC
          </div>
        )}
      </div>
    );
  }

  const primaryAmount = amountOnly 
    ? formatAmount(msats, effectiveUnit)
    : formatAmountWithUnit(msats, effectiveUnit);

  // Determine secondary unit (opposite of primary)
  const secondaryUnit = effectiveUnit === DisplayUnit.BTC ? DisplayUnit.SATS : DisplayUnit.BTC;
  const secondaryAmount = `${formatAmount(msats, secondaryUnit)} ${getDisplayUnitLabel(secondaryUnit)}`;

  if (!showSecondary) {
    return <span className={className}>{primaryAmount}</span>;
  }

  return (
    <div>
      <div className={className}>{primaryAmount}</div>
      <div className={secondaryClassName}>{secondaryAmount}</div>
    </div>
  );
}

/**
 * AmountDisplayInline - For inline display without secondary unit
 */
export function AmountDisplayInline({
  msats,
  className = "",
  forceUnit,
  amountOnly = false,
}: Pick<AmountDisplayProps, 'msats' | 'className' | 'forceUnit' | 'amountOnly'>) {
  return (
    <AmountDisplay
      msats={msats}
      showSecondary={false}
      className={className}
      forceUnit={forceUnit}
      amountOnly={amountOnly}
    />
  );
}
"use client";

interface SCIncreaseBadgeProps {
  increase: number;
}

export default function SCIncreaseBadge({ increase }: SCIncreaseBadgeProps) {
  if (increase <= 0) return null;

  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-500/90 text-green-950 text-[9px] font-bold shadow-lg shadow-green-500/20 animate-sc-increase-fade pointer-events-none whitespace-nowrap">
      +{increase}
    </span>
  );
}

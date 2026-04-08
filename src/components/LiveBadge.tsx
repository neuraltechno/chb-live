"use client";

import { GameStatus } from "@/types";
import { cn } from "@/lib/utils";

interface LiveBadgeProps {
  status: GameStatus;
  minute?: number;
  className?: string;
}

export default function LiveBadge({ status, minute, className = "" }: LiveBadgeProps) {
  if (status === "live") {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
          {minute ? `${minute}'` : "LIVE"}
        </span>
      </div>
    );
  }

  if (status === "halftime") {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
        </span>
        <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">
          HT
        </span>
      </div>
    );
  }

  if (status === "finished") {
    return (
      <span
        className={cn(
          "text-xs font-medium text-dark-400 uppercase tracking-wider",
          className
        )}
      >
        FT
      </span>
    );
  }

  if (status === "postponed") {
    return (
      <span
        className={cn(
          "text-xs font-medium text-orange-400 uppercase tracking-wider",
          className
        )}
      >
        PPD
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span
        className={cn(
          "text-xs font-medium text-dark-500 uppercase tracking-wider line-through",
          className
        )}
      >
        CANC
      </span>
    );
  }

  return null;
}

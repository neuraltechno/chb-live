"use client";

import { cn } from "@/lib/utils";

interface LeagueFilterProps {
  selectedRound: number | null;
  onChangeRound: (round: number | null) => void;
  rightSlot?: React.ReactNode;
}

export default function LeagueFilter({
  selectedRound,
  onChangeRound,
  rightSlot,
}: LeagueFilterProps) {
  const rounds = Array.from({ length: 25 }, (_, i) => i); // 0 to 24

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-wider font-bold text-dark-500">
              AFL Rounds
            </span>
          </div>
          <div className="flex items-center gap-1 bg-dark-800/30 rounded-xl p-1 border border-dark-700/30 overflow-x-auto no-scrollbar">
            {rounds.map((round) => (
              <button
                key={round}
                onClick={() => onChangeRound(round)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap min-w-[32px]",
                  selectedRound === round
                    ? "bg-primary-600 text-white shadow-md shadow-primary-600/25"
                    : "text-dark-400 hover:text-dark-200 hover:bg-dark-700/50"
                )}
              >
                {round}
              </button>
            ))}
          </div>
        </div>
        {rightSlot && <div className="shrink-0 mt-6">{rightSlot}</div>}
      </div>
    </div>
  );
}

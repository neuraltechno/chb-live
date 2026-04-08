"use client";

import { memo } from "react";
import { Game, MatchCardProps } from "@/types";
import LiveBadge from "./LiveBadge";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { MessageSquare, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function MatchCard({ game, onClick }: MatchCardProps) {
  const router = useRouter();

  const isLive = game.status === "live" || game.status === "halftime";
  const isFinished = game.status === "finished";
  const isScheduled = game.status === "scheduled";

  console.log(`[MatchCard Debug] Game ${game.id} statusDisplay:`, game.statusDisplay);

  const startDate = parseISO(game.startTime);
  const timeString = format(startDate, "HH:mm");
  const dateString = isToday(startDate)
    ? `Today ${format(startDate, "MMM d")}`
    : isTomorrow(startDate)
    ? `Tomorrow ${format(startDate, "MMM d")}`
    : format(startDate, "EEEE MMM d");

  const handleClick = () => {
    if (onClick) {
      onClick(game);
    } else {
      router.push(`/match/${game.id}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left group relative bg-dark-800/80 hover:bg-dark-800 rounded-xl border transition-all duration-200 overflow-hidden",
        isLive
          ? "border-red-500/30 hover:border-red-500/50 shadow-lg shadow-red-500/5"
          : "border-dark-700/50 hover:border-dark-600/50",
        "hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
      )}
    >
      {/* Live indicator bar */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 via-red-400 to-red-500" />
      )}

      <div className="p-4">
        {/* League & Status Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-dark-400 uppercase tracking-wider">
              {game.league.shortName}
            </span>
            {game.league.country && (
              <span className="text-[10px] text-dark-500">
                · {game.league.country}
              </span>
            )}
            {(game.round || game.leg) && (
              <span className="text-[10px] text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">
                {game.round}{game.leg ? ` · ${game.leg}` : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLive && <LiveBadge status={game.status} minute={game.minute} />}
            {isFinished && <LiveBadge status="finished" />}
            {isScheduled && (
              <span className="text-xs text-dark-400">{timeString}</span>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="space-y-2.5">
          {/* Home Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-full bg-dark-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {game.homeTeam.logo ? (
                  <img
                    src={game.homeTeam.logo}
                    alt={game.homeTeam.shortName}
                    className="w-5 h-5 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-[10px] font-bold text-dark-400">
                    {game.homeTeam.shortName.slice(0, 3)}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-sm truncate",
                  isFinished &&
                    game.homeTeam.score !== undefined &&
                    game.awayTeam.score !== undefined &&
                    game.homeTeam.score > game.awayTeam.score
                    ? "text-white font-semibold"
                    : "text-dark-200"
                )}
              >
                {game.homeTeam.name}
              </span>
            </div>
            {(isLive || isFinished) && game.homeTeam.score !== undefined && (
              <span
                className={cn(
                  "text-lg font-bold tabular-nums ml-3",
                  isLive ? "text-white" : "text-dark-300"
                )}
              >
                {game.homeTeam.score}
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-full bg-dark-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {game.awayTeam.logo ? (
                  <img
                    src={game.awayTeam.logo}
                    alt={game.awayTeam.shortName}
                    className="w-5 h-5 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-[10px] font-bold text-dark-400">
                    {game.awayTeam.shortName.slice(0, 3)}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-sm truncate",
                  isFinished &&
                    game.awayTeam.score !== undefined &&
                    game.homeTeam.score !== undefined &&
                    game.awayTeam.score > game.homeTeam.score
                    ? "text-white font-semibold"
                    : "text-dark-200"
                )}
              >
                {game.awayTeam.name}
              </span>
            </div>
            {(isLive || isFinished) && game.awayTeam.score !== undefined && (
              <span
                className={cn(
                  "text-lg font-bold tabular-nums ml-3",
                  isLive ? "text-white" : "text-dark-300"
                )}
              >
                {game.awayTeam.score}
              </span>
            )}
          </div>

          {/* Status Display (Middle Column / Centered between teams area) */}
          {game.statusDisplay && game.statusDisplay !== "undefined" && (
            <div className="flex justify-center -mt-1.5 mb-0.5">
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                game.sport === "afl" 
                  ? "text-primary-400 bg-primary-500/10 border-primary-500/20"
                  : "text-dark-400 bg-dark-500/10 border-dark-500/20"
              )}>
                {game.statusDisplay}
              </span>
            </div>
          )}
        </div>

        {/* Footer - Chat & Users info */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-700/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-dark-500">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="text-[11px]">{game.messageCount}</span>
            </div>
            {game.activeUsers > 0 && (
              <div className="flex items-center gap-1 text-dark-500">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[11px]">{game.activeUsers}</span>
              </div>
            )}
            {game.venue && (
              <span className="text-[10px] text-dark-500 max-w-[120px] truncate">
                · {game.venue}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-dark-500">{dateString}</span>
            <span className="text-[10px] text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Open Chat →
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default memo(MatchCard);

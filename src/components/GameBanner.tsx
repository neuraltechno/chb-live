"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Game, SportType } from "@/types";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { memo } from "react";

interface GameBannerProps {
  round: number | null;
  sport: SportType | "all";
}

const GameBannerItem = memo(({ game }: { game: Game }) => {
  const isLive = game.status === "live" || game.status === "halftime";
  const isFinished = game.status === "finished";
  const startDate = parseISO(game.startTime);

  const timeString = format(startDate, "HH:mm");
  const dateString = format(startDate, "EEE");

  return (
    <Link
      href={`/match/${game.id}`}
      className="flex flex-col p-1.5 rounded-md bg-dark-800/40 hover:bg-dark-700/60 border border-dark-700/30 transition-all group overflow-hidden min-w-[80px] flex-1"
    >
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {game.homeTeam.logo ? (
            <img src={game.homeTeam.logo} alt="" className="w-3 h-3 object-contain" />
          ) : (
            <div className="w-3 h-3 rounded-full bg-dark-600" />
          )}
          <span className="text-[10px] font-medium truncate text-dark-100 group-hover:text-white transition-colors">
            {game.homeTeam.shortName}
          </span>
        </div>
        {(isLive || isFinished) && (
          <span className="text-[10px] font-bold tabular-nums text-white ml-1">
            {game.homeTeam.score}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {game.awayTeam.logo ? (
            <img src={game.awayTeam.logo} alt="" className="w-3 h-3 object-contain" />
          ) : (
            <div className="w-3 h-3 rounded-full bg-dark-600" />
          )}
          <span className="text-[10px] font-medium truncate text-dark-100 group-hover:text-white transition-colors">
            {game.awayTeam.shortName}
          </span>
        </div>
        {(isLive || isFinished) && (
          <span className="text-[10px] font-bold tabular-nums text-white ml-1">
            {game.awayTeam.score}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto pt-1 border-t border-dark-700/20">
        <div className="flex flex-col">
          {isLive ? (
            <div className="flex items-center gap-0.5">
              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[8px] font-bold text-red-500 uppercase tracking-tighter">
                Live {game.statusDisplay || (game.minute ? `${game.minute}'` : "")}
              </span>
            </div>
          ) : isFinished ? (
            <span className="text-[8px] font-bold text-dark-400 uppercase">FT</span>
          ) : (
            <span className="text-[8px] font-medium text-dark-400 uppercase tracking-tight">
              {dateString} {timeString}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});

GameBannerItem.displayName = "GameBannerItem";

export default function GameBanner({ round, sport }: GameBannerProps) {
  const games = useQuery(api.games.list, {
    round: round ?? undefined,
    sport: sport === "all" ? undefined : sport,
  }) || [];

  if (games.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-hidden flex-1 justify-center">
      {games.map((game) => (
        <GameBannerItem key={game.id} game={game} />
      ))}
    </div>
  );
}

"use client";

import { Game } from "@/types";
import MatchCard from "./MatchCard";
import { Flame, Clock, CheckCircle, Frown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchListProps {
  games: Game[];
  liveGames: Game[];
  scheduledGames: Game[];
  finishedGames: Game[];
  isLoading: boolean;
  error: string | null;
}

function SectionHeader({
  icon,
  title,
  count,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
}) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
      <div className={cn(color)}>{icon}</div>
      <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">
        {title}
      </h2>
      <span className="text-xs text-dark-500 bg-dark-800 px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-dark-800/80 rounded-xl border border-dark-700/50 p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-16 bg-dark-700 rounded" />
        <div className="h-3 w-10 bg-dark-700 rounded" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-dark-700" />
            <div className="h-4 w-32 bg-dark-700 rounded" />
          </div>
          <div className="h-5 w-6 bg-dark-700 rounded" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-dark-700" />
            <div className="h-4 w-28 bg-dark-700 rounded" />
          </div>
          <div className="h-5 w-6 bg-dark-700 rounded" />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-dark-700/50">
        <div className="h-3 w-20 bg-dark-700 rounded" />
      </div>
    </div>
  );
}

export default function MatchList({
  games,
  liveGames,
  scheduledGames,
  finishedGames,
  isLoading,
  error,
}: MatchListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Frown className="w-12 h-12 text-dark-500 mb-4" />
        <h3 className="text-lg font-semibold text-dark-300 mb-2">
          Failed to load games
        </h3>
        <p className="text-sm text-dark-500 max-w-md">{error}</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Frown className="w-12 h-12 text-dark-500 mb-4" />
        <h3 className="text-lg font-semibold text-dark-300 mb-2">
          No games found
        </h3>
        <p className="text-sm text-dark-500 max-w-md">
          There are no matches for the selected filters. Try changing the sport
          or league filters above.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Live Games */}
      <SectionHeader
        icon={<Flame className="w-4 h-4" />}
        title="Live Now"
        count={liveGames.length}
        color="text-red-500"
      />
      {liveGames.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-2">
          {liveGames.map((game) => (
            <MatchCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {/* Scheduled Games */}
      <SectionHeader
        icon={<Clock className="w-4 h-4" />}
        title="Upcoming"
        count={scheduledGames.length}
        color="text-primary-400"
      />
      {scheduledGames.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-2">
          {scheduledGames.map((game) => (
            <MatchCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {/* Finished Games */}
      <SectionHeader
        icon={<CheckCircle className="w-4 h-4" />}
        title="Finished"
        count={finishedGames.length}
        color="text-dark-500"
      />
      {finishedGames.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {finishedGames.map((game) => (
            <MatchCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}

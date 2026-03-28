"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Game, SportType } from "@/types";

interface UseGamesOptions {
  selectedLeagues?: string[];
  selectedSport?: SportType | "all";
}

export function useGames(options: UseGamesOptions = {}) {
  const { selectedLeagues, selectedSport = "all" } = options;

  console.log("useGames hook: leagues", selectedLeagues, "sport", selectedSport);

  const games = useQuery(api.games.list, {
    leagues: selectedLeagues,
    sport: selectedSport === "all" ? undefined : selectedSport,
  });

  const isLoading = games === undefined;
  const error = null; // Convex handles errors or we can check if it's null
  const lastUpdated = new Date().toISOString(); // We could store this in Convex too

  const { liveGames, scheduledGames, finishedGames } = useMemo(() => {
    if (!games) {
      return { liveGames: [], scheduledGames: [], finishedGames: [] };
    }
    const live = games.filter(
      (g: Game) => g.status === "live" || g.status === "halftime"
    );
    const scheduled = games.filter((g: Game) => g.status === "scheduled");
    const finished = games.filter((g: Game) => g.status === "finished");
    return {
      liveGames: live,
      scheduledGames: scheduled,
      finishedGames: finished,
    };
  }, [games]);

  return {
    games: games || [],
    liveGames,
    scheduledGames,
    finishedGames,
    isLoading,
    error,
    lastUpdated,
    refresh: () => {}, // Convex is reactive, no need for manual refresh
  };
}

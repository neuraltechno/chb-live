"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Game, SportType } from "@/types";

interface UseGamesOptions {
  selectedLeagues?: string[];
  selectedSport?: SportType | "all";
  selectedRound?: number | null;
}

export function useGames(options: UseGamesOptions = {}) {
  const { selectedLeagues, selectedSport = "all", selectedRound } = options;

  console.log("useGames hook: leagues", selectedLeagues, "sport", selectedSport, "round", selectedRound);

  const games = useQuery(api.games.list, {
    leagues: selectedLeagues,
    sport: selectedSport === "all" ? undefined : selectedSport,
    round: selectedRound ?? undefined,
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

  const currentRound = useMemo(() => {
    if (!games || games.length === 0) return null;
    
    // Find the round of the first game that is not finished
    const firstActiveGame = games.find(g => g.status !== "finished");
    if (firstActiveGame && firstActiveGame.roundNumber !== undefined) {
      return firstActiveGame.roundNumber;
    }
    
    // If all games are finished, return the round of the last game
    const lastGame = games[games.length - 1];
    if (lastGame && lastGame.roundNumber !== undefined) {
      return lastGame.roundNumber;
    }
    
    return null;
  }, [games]);

  return {
    games: games || [],
    liveGames,
    scheduledGames,
    finishedGames,
    currentRound,
    isLoading,
    error,
    lastUpdated,
    refresh: () => {}, // Convex is reactive, no need for manual refresh
  };
}

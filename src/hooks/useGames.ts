"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Game, SportType } from "@/types";

interface UseGamesOptions {
  selectedLeagues?: string[];
  selectedSport?: SportType | "all";
  refreshInterval?: number; // in ms
}

export function useGames(options: UseGamesOptions = {}) {
  const {
    selectedLeagues,
    selectedSport = "all",
    refreshInterval = 60000,
  } = options;

  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);

  const fetchGames = useCallback(async (force = false) => {
    if (isFetchingRef.current && !force) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    isFetchingRef.current = true;

    try {
      const params = new URLSearchParams();
      if (selectedLeagues && selectedLeagues.length > 0) {
        params.set("leagues", selectedLeagues.join(","));
      }

      const url = `/api/games${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { signal: controller.signal });
      const result = await response.json();

      if (result.success) {
        let filteredGames = result.data.games;

        // Client-side sport filter
        if (selectedSport !== "all") {
          filteredGames = filteredGames.filter(
            (g: Game) => g.sport === selectedSport
          );
        }

        setGames(filteredGames);
        setLastUpdated(result.data.lastUpdated);
        setError(null);
      } else {
        setError(result.error || "Failed to fetch games");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError("Failed to connect to server");
      console.error("Error fetching games:", err);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [selectedLeagues, selectedSport]);

  useEffect(() => {
    fetchGames(true);

    // Auto-refresh
    intervalRef.current = setInterval(fetchGames, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [fetchGames, refreshInterval]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchGames(true);
  }, [fetchGames]);

  const { liveGames, scheduledGames, finishedGames } = useMemo(() => {
    const live = games.filter((g) => g.status === "live" || g.status === "halftime");
    const scheduled = games.filter((g) => g.status === "scheduled");
    const finished = games.filter((g) => g.status === "finished");
    return {
      liveGames: live,
      scheduledGames: scheduled,
      finishedGames: finished,
    };
  }, [games]);

  return {
    games,
    liveGames,
    scheduledGames,
    finishedGames,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}

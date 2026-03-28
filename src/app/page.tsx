"use client";

import { useMemo } from "react";
import { useGames } from "@/hooks/useGames";
import { useGameStore } from "@/lib/store";
import MatchList from "@/components/MatchList";
import LeagueFilter from "@/components/LeagueFilter";
import TeamSearch from "@/components/TeamSearch";
import { RefreshCw, Zap, TrendingUp, Globe } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Game } from "@/types";

export default function HomePage() {
  const selectedSport = useGameStore((s) => s.selectedSport);
  const selectedLeagues = useGameStore((s) => s.selectedLeagues);
  const teamSearch = useGameStore((s) => s.teamSearch);
  const setSport = useGameStore((s) => s.setSport);
  const toggleLeague = useGameStore((s) => s.toggleLeague);
  const clearSelectedLeagues = useGameStore((s) => s.clearSelectedLeagues);

  const {
    games,
    liveGames,
    scheduledGames,
    finishedGames,
    isLoading,
    error,
    lastUpdated,
    refresh,
  } = useGames({
    selectedLeagues: selectedLeagues.length > 0 ? selectedLeagues : undefined,
    selectedSport,
  });

  const filterByTeam = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return null;
    return (list: typeof games) =>
      list.filter(
        (g: Game) =>
          g.homeTeam.name.toLowerCase().includes(q) ||
          g.awayTeam.name.toLowerCase().includes(q) ||
          g.homeTeam.shortName.toLowerCase().includes(q) ||
          g.awayTeam.shortName.toLowerCase().includes(q)
      );
  }, [teamSearch]);

  const filteredGames = filterByTeam ? filterByTeam(games) : games;
  const filteredLive = filterByTeam ? filterByTeam(liveGames) : liveGames;
  const filteredScheduled = filterByTeam ? filterByTeam(scheduledGames) : scheduledGames;
  const filteredFinished = filterByTeam ? filterByTeam(finishedGames) : finishedGames;

  return (
    <div className="min-h-screen bg-dark-950 bg-grid-pattern">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-950/20 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Live{" "}
                <span className="bg-gradient-to-r from-primary-400 to-accent-cyan bg-clip-text text-transparent">
                  Matches
                </span>
              </h1>
              <p className="text-dark-400 text-sm">
                Click on any match to join the live chat and share your thoughts
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Stats */}
              <div className="hidden sm:flex items-center gap-4">
                {liveGames.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Zap className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-dark-300">
                      {liveGames.length} live
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs">
                  <Globe className="w-3.5 h-3.5 text-primary-400" />
                  <span className="text-dark-300">
                    {games.length} matches
                  </span>
                </div>
              </div>

              {/* Last updated & refresh */}
              <div className="flex items-center gap-2">
                {lastUpdated && (
                  <span className="text-[11px] text-dark-500">
                    Live Data
                  </span>
                )}
                <button
                  disabled={true}
                  className="p-2 rounded-lg bg-dark-800/50 border border-dark-700/50 text-dark-400 opacity-50 cursor-default"
                  title="Auto-refreshing"
                >
                  <RefreshCw
                    className={`w-4 h-4`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <LeagueFilter
          selectedLeagues={selectedLeagues}
          onToggleLeague={toggleLeague}
          onClearLeagues={clearSelectedLeagues}
          selectedSport={selectedSport}
          onChangeSport={setSport}
          rightSlot={<TeamSearch games={games} />}
        />
      </div>

      {/* Match Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <MatchList
          games={filteredGames}
          liveGames={filteredLive}
          scheduledGames={filteredScheduled}
          finishedGames={filteredFinished}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {/* Footer */}
      <footer className="border-t border-dark-800/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-dark-500 text-xs">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                Soccer data powered by API-Football · NCAA data powered by ESPN
              </span>
            </div>
            <p className="text-xs text-dark-600">
              © {new Date().getFullYear()} Gamebloc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

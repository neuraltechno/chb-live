"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X } from "lucide-react";
import { useGameStore } from "@/lib/store";
import { Game } from "@/types";

interface TeamSearchProps {
  games?: Game[];
}

interface TeamSuggestion {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  league: string;
  sport: string;
}

export default function TeamSearch({ games = [] }: TeamSearchProps) {
  const teamSearch = useGameStore((s) => s.teamSearch);
  const setTeamSearch = useGameStore((s) => s.setTeamSearch);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Build unique team list from games
  const allTeams = useMemo<TeamSuggestion[]>(() => {
    const map = new Map<string, TeamSuggestion>();
    games.forEach((g) => {
      [g.homeTeam, g.awayTeam].forEach((t) => {
        if (t.name === "TBD") return;
        if (!map.has(t.id)) {
          map.set(t.id, {
            id: t.id,
            name: t.name,
            shortName: t.shortName,
            logo: t.logo,
            league: g.league.shortName,
            sport: g.sport,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [games]);

  // Filter suggestions based on query
  const suggestions = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return [];
    return allTeams
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.shortName.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [teamSearch, allTeams]);

  const showDropdown = isFocused && teamSearch.trim().length > 0 && suggestions.length > 0;

  return (
    <div className="relative w-full sm:w-72" ref={wrapperRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none z-10" />
      <input
        type="text"
        value={teamSearch}
        onChange={(e) => setTeamSearch(e.target.value)}
        onFocus={() => setIsFocused(true)}
        placeholder="Search teams…"
        className={`w-full pl-9 pr-8 py-2 bg-dark-800/50 border border-dark-700/50 text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-primary-500/50 focus:bg-dark-800 transition-all ${
          showDropdown ? "rounded-t-xl rounded-b-none border-b-0" : "rounded-xl"
        }`}
      />
      {teamSearch && (
        <button
          onClick={() => {
            setTeamSearch("");
            setIsFocused(false);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300 transition-colors z-10"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Autocomplete dropdown */}
      {showDropdown && (
        <ul className="absolute left-0 right-0 z-50 bg-dark-800 border border-dark-700/50 border-t-0 rounded-b-xl max-h-64 overflow-y-auto shadow-xl shadow-black/40">
          {suggestions.map((team) => (
            <li key={team.id}>
              <button
                onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                onClick={() => {
                  setTeamSearch(team.name);
                  setIsFocused(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-dark-700/60 transition-colors"
              >
                {team.logo ? (
                  <img
                    src={team.logo}
                    alt={team.shortName}
                    className="w-6 h-6 rounded-full object-contain bg-dark-700/50"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-dark-700 flex items-center justify-center text-[10px] text-dark-400 font-bold">
                    {team.shortName.slice(0, 2)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-dark-200 truncate block">
                    {team.name}
                  </span>
                </div>
                <span className="text-[10px] text-dark-500 font-medium shrink-0">
                  {team.league}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* No results state */}
      {isFocused && teamSearch.trim().length > 0 && suggestions.length === 0 && (
        <div className="absolute left-0 right-0 z-50 bg-dark-800 border border-dark-700/50 border-t-0 rounded-b-xl px-3 py-3 shadow-xl shadow-black/40">
          <p className="text-xs text-dark-500 text-center">No teams found</p>
        </div>
      )}
    </div>
  );
}

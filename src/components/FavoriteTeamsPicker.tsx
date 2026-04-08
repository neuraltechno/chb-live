"use client";

import { useState, useMemo } from "react";
import { FavoriteTeam, SportType } from "@/types";
import { Search, X, Star, Trophy, Dribbble, GraduationCap, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamEntry {
  teamId: string;
  name: string;
  shortName: string;
  logo: string;
  sport: string;
}

interface FavoriteTeamsPickerProps {
  selected: FavoriteTeam[];
  onChange: (teams: FavoriteTeam[]) => void;
  allTeams: TeamEntry[];
}

type SportTab = SportType | "all";

const SPORT_TABS: { id: SportTab; label: string; icon: React.ReactNode }[] = [
  { id: "all",              label: "All Sports",  icon: <Trophy className="w-3.5 h-3.5" /> },
  { id: "soccer",           label: "Soccer",      icon: <Dribbble className="w-3.5 h-3.5" /> },
  { id: "ncaa_football",    label: "NCAAF",       icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { id: "ncaa_basketball",  label: "NCAAB",       icon: <GraduationCap className="w-3.5 h-3.5" /> },
];

const SPORT_LABELS: Record<string, string> = {
  soccer: "Soccer",
  ncaa_football: "NCAAF",
  ncaa_basketball: "NCAAB",
};

const SPORT_COLORS: Record<string, string> = {
  soccer: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  ncaa_football: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  ncaa_basketball: "bg-blue-500/15 text-blue-400 border-blue-500/20",
};

export default function FavoriteTeamsPicker({
  selected,
  onChange,
  allTeams,
}: FavoriteTeamsPickerProps) {
  const [search, setSearch] = useState("");
  const [activeSport, setActiveSport] = useState<SportTab>("all");

  const selectedIds = new Set(selected.map((t) => t.teamId));

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allTeams
      .filter((t) => {
        if (activeSport !== "all" && t.sport !== activeSport) return false;
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.shortName.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [search, activeSport, allTeams]);

  const toggleTeam = (team: TeamEntry) => {
    if (selectedIds.has(team.teamId)) {
      onChange(selected.filter((t) => t.teamId !== team.teamId));
    } else if (selected.length < 3) {
      onChange([
        ...selected,
        {
          teamId: team.teamId,
          name: team.name,
          shortName: team.shortName,
          logo: team.logo,
          sport: team.sport as SportType,
        },
      ]);
    }
  };

  const removeTeam = (teamId: string) => {
    onChange(selected.filter((t) => t.teamId !== teamId));
  };

  return (
    <div className="space-y-4">
      {/* Selected teams */}
      {selected.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {selected.map((team, i) => (
            <div
              key={team.teamId}
              className="relative flex items-center gap-2.5 p-2.5 rounded-xl bg-dark-800 border border-dark-700/60 group"
            >
              {/* Rank badge */}
              <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] font-bold text-dark-900 z-10">
                {i + 1}
              </span>

              {team.logo ? (
                <img
                  src={team.logo}
                  alt={team.name}
                  className="w-9 h-9 object-contain rounded-lg bg-dark-700/50 flex-shrink-0 p-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-dark-400">
                    {team.shortName.slice(0, 2)}
                  </span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-dark-100 truncate leading-tight">
                  {team.name}
                </p>
                {team.sport && (
                  <span
                    className={cn(
                      "mt-0.5 inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full border",
                      SPORT_COLORS[team.sport] ?? "bg-dark-700 text-dark-400 border-dark-600"
                    )}
                  >
                    {SPORT_LABELS[team.sport] ?? team.sport}
                  </span>
                )}
              </div>

              <button
                onClick={() => removeTeam(team.teamId)}
                className="opacity-0 group-hover:opacity-100 absolute top-1.5 right-1.5 p-0.5 rounded text-dark-500 hover:text-red-400 transition-all"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: 3 - selected.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center justify-center h-[58px] rounded-xl border border-dashed border-dark-700/50 text-dark-600 text-xs"
            >
              <Star className="w-3.5 h-3.5 mr-1.5 opacity-40" />
              Slot {selected.length + i + 1}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-dark-700/50 text-dark-500 text-xs">
          <Star className="w-4 h-4 opacity-40" />
          No favorite teams selected yet
        </div>
      )}

      {/* Helper text */}
      <p className="text-[11px] text-dark-500">
        {selected.length < 3
          ? `Pick ${3 - selected.length} more team${3 - selected.length === 1 ? "" : "s"} — shown on your public profile`
          : "3/3 selected. Remove one to swap."}
      </p>

      {/* Sport tabs */}
      <div className="flex gap-1 flex-wrap">
        {SPORT_TABS.map((tab) => {
          const count = tab.id === "all"
            ? allTeams.length
            : allTeams.filter((t) => t.sport === tab.id).length;
          if (count === 0 && tab.id !== "all") return null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSport(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
                activeSport === tab.id
                  ? "bg-primary-600/20 border-primary-500/40 text-primary-300"
                  : "bg-dark-800/50 border-dark-700/50 text-dark-400 hover:text-dark-200 hover:border-dark-600/50"
              )}
            >
              {tab.icon}
              {tab.label}
              <span className="text-[10px] opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Search + list */}
      <div className="bg-dark-800 border border-dark-700/50 rounded-xl overflow-hidden">
        {/* Search */}
        <div className="relative border-b border-dark-700/50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeSport === "all" ? "all teams" : SPORT_LABELS[activeSport] + " teams"}…`}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-transparent text-white placeholder-dark-500 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Team list */}
        <div className="max-h-56 overflow-y-auto scrollbar-thin">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-dark-500 py-8">
              No teams found
              {activeSport !== "all" && (
                <> in this sport — <button className="text-primary-400 hover:underline" onClick={() => setActiveSport("all")}>show all</button></>
              )}
            </p>
          ) : (
            filtered.map((team) => {
              const isSelected = selectedIds.has(team.teamId);
              const isFull = !isSelected && selected.length >= 3;
              return (
                <button
                  key={team.teamId}
                  onClick={() => toggleTeam(team)}
                  disabled={isFull}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                    isSelected
                      ? "bg-primary-600/15 text-primary-300"
                      : "text-dark-200 hover:bg-dark-700/50",
                    "disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                >
                  {/* Logo */}
                  <div className="w-7 h-7 rounded-lg bg-dark-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {team.logo ? (
                      <img
                        src={team.logo}
                        alt={team.name}
                        className="w-5 h-5 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-dark-400">
                        {team.shortName.slice(0, 2)}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <span className="flex-1 truncate">{team.name}</span>

                  {/* Sport badge */}
                  {activeSport === "all" && team.sport && (
                    <span
                      className={cn(
                        "text-[9px] font-medium px-1.5 py-0.5 rounded-full border",
                        SPORT_COLORS[team.sport] ?? "bg-dark-700 text-dark-400 border-dark-600"
                      )}
                    >
                      {SPORT_LABELS[team.sport] ?? team.sport}
                    </span>
                  )}

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

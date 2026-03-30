"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Game } from "@/types";
import { User, Shield, Info, ChevronUp, ChevronDown } from "lucide-react";

interface PlayerStatsProps {
  game: Game;
}

export default function PlayerStats({ game }: PlayerStatsProps) {
  const stats = useQuery(api.stats.getPlayerStats, { externalId: game.externalId });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: game.sport === "afl" ? "sc" : (game.sport === "soccer" ? "goals" : "points"),
    direction: "desc"
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats || !Array.isArray(stats) || stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-dark-400 bg-dark-800/30 rounded-xl border border-dark-700/50">
        <Info className="w-8 h-8 mb-2 opacity-20" />
        <p className="text-sm">Player stats not available for this match yet.</p>
      </div>
    );
  }

  // ESPN player stats structure: stats is an array of objects, one for each team
  // Each object has 'team' (with name, logo) and 'statistics' (array of categories)
  // Each category has 'athletes' (array of players with their stats)

  return (
    <div className="space-y-8 pb-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {stats.map((teamData: any, teamIdx: number) => {
          const teamName = teamData.team?.displayName || (teamIdx === 0 ? game.homeTeam.name : game.awayTeam.name);
          const teamLogo = teamData.team?.logo || (teamIdx === 0 ? game.homeTeam.logo : game.awayTeam.logo);

          // Get all players for this team across all categories
          const playersMap = new Map<string, any>();
          
          teamData.statistics?.forEach((category: any) => {
            // AFL uses 'labels' as keys if 'keys' is missing
            const rawKeys = category.keys || category.labels || [];
            const keys = rawKeys.map((k: string) => k.toLowerCase());
            
            category.athletes?.forEach((athlete: any) => {
              const player = athlete.athlete;
              if (!player) return;
              
              const pos = player.position?.abbreviation || player.position?.name;
              if (pos === "EMERG") return; // Skip emergencies

              const existing = playersMap.get(player.id) || {
                id: player.id,
                name: player.displayName,
                position: pos,
                jersey: player.jersey || athlete.guernsey,
                headshot: player.headshot?.href,
                stats: {}
              };

              // Map stat values using lowercase keys
              athlete.stats?.forEach((val: string, i: number) => {
                const key = keys[i];
                if (key) {
                  existing.stats[key] = val;
                }
              });

              // Add SuperCoach score if available
              if (athlete.supercoach !== undefined) {
                existing.stats["sc"] = athlete.supercoach;
              }

              // Update jersey if footyinfo guernsey is available
              if (athlete.guernsey !== undefined) {
                existing.jersey = athlete.guernsey;
              }

              playersMap.set(player.id, existing);
            });
          });

          const players = Array.from(playersMap.values());

          // Define which stats to show based on sport
          const isSoccer = game.sport === "soccer";
          const isAfl = game.sport === "afl";
          
          let displayStats = [
            { key: "points", label: "PTS" },
            { key: "rebounds", label: "REB" },
            { key: "assists", label: "AST" },
            { key: "steals", label: "STL" },
            { key: "blocks", label: "BLK" }
          ];

          if (isSoccer) {
            displayStats = [
              { key: "goals", label: "G" },
              { key: "assists", label: "A" },
              { key: "shots", label: "SH" },
              { key: "shotsontarget", label: "SOT" },
              { key: "yellowcards", label: "YC" },
              { key: "redcards", label: "RC" }
            ];
          } else if (isAfl) {
            displayStats = [
              { key: "sc", label: "SC" },
              { key: "k", label: "K" },
              { key: "h", label: "HB" },
              { key: "d", label: "D" },
              { key: "m", label: "M" },
              { key: "t", label: "T" },
              { key: "g", label: "G" },
              { key: "b", label: "B" },
              { key: "ho", label: "HO" },
              { key: "bou", label: "BO" },
              { key: "ff", label: "FF" },
              { key: "fa", label: "FA" },
              { key: "cp", label: "CP" },
              { key: "tc", label: "CL" },
              { key: "c", label: "CG" },
              { key: "i50", label: "I50" },
              { key: "r50", label: "R50" }             
            ];
          }

          const getStatValue = (player: any, key: string) => {
            if (key === 'name') return player.name;
            const k = key.toLowerCase();
            const val = player.stats[k];
            if (val !== undefined) return val;
            return "0";
          };

          const sortedPlayers = [...players].sort((a, b) => {
            const aVal = getStatValue(a, sortConfig.key);
            const bVal = getStatValue(b, sortConfig.key);
            
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
            }

            return sortConfig.direction === 'asc'
              ? String(aVal).localeCompare(String(bVal))
              : String(bVal).localeCompare(String(aVal));
          });

          if (players.length === 0) return null;

          return (
            <div key={teamIdx} className="bg-dark-900/50 rounded-2xl border border-dark-700/50 overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-dark-800/50 border-b border-dark-700/50 flex items-center gap-3">
                {teamLogo ? (
                  <img src={teamLogo} alt={teamName} className="w-6 h-6 object-contain" />
                ) : (
                  <Shield className="w-5 h-5 text-dark-500" />
                )}
                <h3 className="font-semibold text-white text-sm truncate">{teamName}</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-dark-700/30 text-dark-400 uppercase tracking-wider font-medium">
                      <th
                        className="px-2 py-2.5 min-w-[110px] cursor-pointer hover:text-white transition-colors group"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Player
                          <div className={sortConfig.key === 'name' ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}>
                            {sortConfig.key === 'name' ? (
                              sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-dark-600" />
                            )}
                          </div>
                        </div>
                      </th>
                      {displayStats.map(s => (
                        <th
                          key={s.key}
                          className="px-0.5 py-2.5 text-center font-bold text-[13px] cursor-pointer hover:text-white transition-colors group"
                          onClick={() => handleSort(s.key)}
                        >
                          <div className="flex items-center justify-center gap-0">
                            {s.label}
                            <div className={sortConfig.key === s.key ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}>
                              {sortConfig.key === s.key ? (
                                sortConfig.direction === 'asc' ? <ChevronUp className="w-1.5 h-1.5" /> : <ChevronDown className="w-1.5 h-1.5" />
                              ) : (
                                <ChevronDown className="w-1.5 h-1.5 text-dark-600" />
                              )}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700/20">
                    {sortedPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-dark-800/30 transition-colors">
                        <td className="px-2 py-1.5 flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-lg bg-dark-800 border border-dark-700/50 flex-shrink-0 flex items-center justify-center">
                            <span className="text-[11px] font-bold text-primary-400">
                              {player.jersey || "-"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-white font-medium truncate text-[13px]">{player.name}</span>
                          </div>
                        </td>
                        {displayStats.map(s => (
                          <td key={s.key} className="px-0.5 py-1.5 text-center text-dark-200 tabular-nums text-[13px]">
                            {getStatValue(player, s.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

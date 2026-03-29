"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Game } from "@/types";
import { User, Shield, Info } from "lucide-react";

interface PlayerStatsProps {
  game: Game;
}

export default function PlayerStats({ game }: PlayerStatsProps) {
  const stats = useQuery(api.stats.getPlayerStats, { externalId: game.externalId });

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
                jersey: player.jersey,
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
            const k = key.toLowerCase();
            const val = player.stats[k];
            if (val !== undefined) return val;
            return "0";
          };

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
                      <th className="px-4 py-2.5 min-w-[140px]">Player</th>
                      {displayStats.map(s => (
                        <th key={s.key} className="px-2 py-2.5 text-center font-bold text-[10px]">{s.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700/20">
                    {players.map((player) => (
                      <tr key={player.id} className="hover:bg-dark-800/30 transition-colors">
                        <td className="px-4 py-1.5 flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-dark-800 border border-dark-700/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {player.headshot ? (
                              <img src={player.headshot} alt={player.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-3 h-3 text-dark-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-white font-medium truncate text-[13px]">{player.name}</span>
                            <span className="text-[11px] text-dark-500 whitespace-nowrap">
                              ({player.position || "-"}) {player.jersey ? `#${player.jersey}` : ""}
                            </span>
                          </div>
                        </td>
                        {displayStats.map(s => (
                          <td key={s.key} className="px-2 py-1.5 text-center text-dark-200 tabular-nums">
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

"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Game } from "@/types";
import { User, Shield, Info, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import SCIncreaseBadge from "./SCIncreaseBadge";
import { useGameLiveStats } from "@/hooks/use-game-live-stats";
import { Suspense, lazy } from "react";
import { cn } from "@/lib/utils";

// Lazy load the detailed player statistics tables
const PlayerStatsTable = lazy(() => Promise.resolve({ default: PlayerStatsTableContent }));

function TeamScoreAfl({ team, gameExternalId, leagueId, gameId, liveStats }: { team: any, gameExternalId: string, leagueId: string, gameId: string, liveStats?: any }) {
  const convexStatsRecord = useQuery(api.stats.getPlayerStats, { externalId: gameExternalId });
  
  // Prefer liveStats from the dedicated live API first
  const stats = liveStats || convexStatsRecord?.matchStats;

  // Determine side before any early returns
  const homeId = stats?.home?.teamId;
  const awayId = stats?.away?.teamId;
  const targetId = String(team.id);
  
  const isHome = homeId !== undefined && String(homeId) === targetId;
  const isAway = awayId !== undefined && String(awayId) === targetId;
  
  // If IDs don't match, try to match by short name or name as a fallback
  let side = isHome ? 'home' : (isAway ? 'away' : null);
  
  if (!side && stats) {
    const homeName = stats.home?.name?.toLowerCase();
    const awayName = stats.away?.name?.toLowerCase();
    const teamName = team.name?.toLowerCase();
    const teamShortName = team.shortName?.toLowerCase();
    
    if (homeName && (teamName?.includes(homeName) || homeName.includes(teamName || "") || teamShortName?.includes(homeName))) {
      side = 'home';
    } else if (awayName && (teamName?.includes(awayName) || awayName.includes(teamName || "") || teamShortName?.includes(awayName))) {
      side = 'away';
    }
  }

  if (!stats || !side) return <span>{team.score}</span>;

  const sideData = stats[side] || {};
  const goals = sideData.goals || "0";
  const behinds = sideData.behinds || "0";
  const score = sideData.score || team.score;

  return <span>{goals}.{behinds}.{score}</span>;
}

interface PlayerStatsProps {
  game: Game;
  liveStats?: any;
}

export default function PlayerStats({ game, liveStats: passedLiveStats }: PlayerStatsProps) {
  const convexStatsRecord = useQuery(api.stats.getPlayerStats, { externalId: game.externalId });
  const { stats: polledLiveStats } = useGameLiveStats(
    !passedLiveStats && (game.status === "live" || game.status === "halftime") ? game.id : undefined
  );

  const liveStatsRecord = passedLiveStats || polledLiveStats;

  const stats = useMemo(() => {
    // If we have live stats from the API, prefer them as the base
    const baseStats = liveStatsRecord?.boxscore?.players || convexStatsRecord?.stats;
    
    if (!baseStats || !Array.isArray(baseStats)) return baseStats;

    // If we are using live stats, they won't have supercoach scores.
    // Merge them from Convex cached stats if available.
    if (liveStatsRecord?.boxscore?.players && convexStatsRecord?.stats) {
      // Create a map of athlete ID -> supercoach score from convex data
      const scMap = new Map<string, number>();
      const guernseyMap = new Map<string, string>();

      convexStatsRecord.stats.forEach((teamData: any) => {
        teamData.statistics?.forEach((category: any) => {
          category.athletes?.forEach((athleteData: any) => {
            if (athleteData.athlete?.id) {
              const id = String(athleteData.athlete.id);
              if (athleteData.supercoach !== undefined) {
                scMap.set(id, athleteData.supercoach);
              }
              if (athleteData.guernsey !== undefined) {
                guernseyMap.set(id, athleteData.guernsey);
              }
            }
          });
        });
      });

      // Inject into live stats
      return baseStats.map((teamData: any) => ({
        ...teamData,
        statistics: (teamData.statistics || []).map((category: any) => ({
          ...category,
          athletes: (category.athletes || []).map((athleteData: any) => {
            const id = athleteData.athlete?.id ? String(athleteData.athlete.id) : null;
            if (!id) return athleteData;

            const sc = scMap.get(id);
            const guernsey = guernseyMap.get(id);

            if (sc !== undefined || guernsey !== undefined) {
              return {
                ...athleteData,
                supercoach: athleteData.supercoach ?? sc,
                guernsey: athleteData.guernsey ?? guernsey
              };
            }
            return athleteData;
          })
        }))
      }));
    }

    return baseStats;
  }, [liveStatsRecord, convexStatsRecord]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: game.sport === "afl" ? "sc" : (game.sport === "soccer" ? "goals" : "points"),
    direction: "desc"
  });

  // Track SC score increases for AFL matches
  const previousScoresRef = useRef<Record<string, number>>({});
  const [scIncreases, setScIncreases] = useState<Record<string, { increase: number; timestamp: number }>>({});

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  // Detect SC score changes when stats update
  useEffect(() => {
    if (!stats || game.sport !== "afl" || !Array.isArray(stats)) return;

    const newIncreases: Record<string, { increase: number; timestamp: number }> = {};
    const currentScores: Record<string, number> = {};

    stats.forEach((teamData: any, teamIdx: number) => {
      teamData.statistics?.forEach((category: any) => {
        category.athletes?.forEach((athlete: any) => {
          const player = athlete.athlete;
          if (!player) return;

          const playerKey = `${teamIdx}-${player.id}`;
          const scScore = athlete.supercoach !== undefined ? Number(athlete.supercoach) : undefined;

          if (scScore !== undefined) {
            currentScores[playerKey] = scScore;
            const previousScore = previousScoresRef.current[playerKey];

            if (previousScore !== undefined && scScore > previousScore) {
              const increase = scScore - previousScore;
              newIncreases[playerKey] = {
                increase,
                timestamp: Date.now(),
              };
            }
          }
        });
      });
    });

    // Merge with existing increases (keep any that haven't expired yet)
    setScIncreases(prev => {
      const now = Date.now();
      const activeIncreases = Object.entries(prev).reduce((acc, [key, value]) => {
        if (now - value.timestamp < 5000) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, { increase: number; timestamp: number }>);

      return { ...activeIncreases, ...newIncreases };
    });

    // Update previous scores reference
    previousScoresRef.current = currentScores;
  }, [stats, game.sport]);

  // Cleanup expired increases periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setScIncreases(prev => {
        const now = Date.now();
        const active: Record<string, { increase: number; timestamp: number }> = {};
        Object.entries(prev).forEach(([key, value]) => {
          if (now - value.timestamp < 5000) {
            active[key] = value;
          }
        });
        return active;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (convexStatsRecord === undefined && !liveStatsRecord) {
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

  return (
    <div className="space-y-8 pb-8">
      <Suspense fallback={<div className="flex items-center justify-center h-48"><Loader2 className="animate-spin" /></div>}>
        <PlayerStatsTable game={game} stats={stats} sortConfig={sortConfig} onSort={handleSort} scIncreases={scIncreases} liveStats={liveStatsRecord} />
      </Suspense>
    </div>
  );
}

function PlayerStatsTableContent({ 
  game, 
  stats, 
  sortConfig, 
  onSort, 
  scIncreases,
  liveStats
}: { 
  game: Game, 
  stats: any[], 
  sortConfig: any, 
  onSort: (key: string) => void, 
  scIncreases: any,
  liveStats: any
}) {
  const getStatValue = (player: any, key: string) => {
    if (key === 'name') return player.name;
    const k = key.toLowerCase();
    const val = player.stats[k];
    if (val !== undefined) return val;
    return "0";
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {stats.map((teamData: any, teamIdx: number) => {
        const teamName = teamData.team?.displayName || (teamIdx === 0 ? game.homeTeam.name : game.awayTeam.name);
        const teamLogo = teamData.team?.logo || (teamIdx === 0 ? game.homeTeam.logo : game.awayTeam.logo);

        // Get all players for this team across all categories
        const playersMap = new Map<string, any>();
        
        teamData.statistics?.forEach((category: any) => {
          const rawKeys = category.keys || category.labels || [];
          const keys = rawKeys.map((k: string) => k.toLowerCase());
          
          category.athletes?.forEach((athlete: any) => {
            const player = athlete.athlete;
            if (!player) return;
            
            const pos = player.position?.abbreviation || player.position?.name;
            const hasInvalidStats = athlete.stats?.some((val: string) => val === "--");
            if (hasInvalidStats) return;

            const existing = playersMap.get(player.id) || {
              id: player.id,
              name: player.displayName,
              position: pos,
              jersey: player.jersey || athlete.guernsey,
              headshot: player.headshot?.href,
              stats: {}
            };

            athlete.stats?.forEach((val: string, i: number) => {
              const key = keys[i];
              if (key) {
                existing.stats[key] = val;
              }
            });

            if (athlete.supercoach !== undefined) {
              existing.stats["sc"] = athlete.supercoach;
            }

            if (athlete.guernsey !== undefined) {
              existing.jersey = athlete.guernsey;
            }

            playersMap.set(player.id, existing);
          });
        });

        const players = Array.from(playersMap.values());
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
            { key: "r50", label: "R50" },
            { key: "de", label: "DE" }             
          ];
        }

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
              <h3 className="font-semibold text-white text-sm truncate flex items-center gap-2">
                {teamName}
                <span className="bg-dark-700/50 px-2 py-0.5 rounded text-primary-400 font-bold tabular-nums">
                  {game.sport === "afl" ? (
                    <TeamScoreAfl 
                      team={teamIdx === 0 ? game.homeTeam : game.awayTeam} 
                      gameExternalId={game.externalId} 
                      leagueId={game.league.id} 
                      gameId={game.id} 
                      liveStats={liveStats}
                    />
                  ) : (
                    teamIdx === 0 ? game.homeTeam.score : game.awayTeam.score
                  )}
                </span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-dark-700/30 text-dark-400 uppercase tracking-wider font-medium">
                      <th
                        className={cn(
                          "px-2 py-2.5 min-w-[110px] cursor-pointer hover:text-white transition-colors group",
                          sortConfig.key === 'name' && "text-white"
                        )}
                        onClick={() => onSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Player
                          <div className={cn(sortConfig.key === 'name' ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity")}>
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
                          className={cn(
                            "px-0.5 py-2.5 text-center font-bold text-[13px] cursor-pointer hover:text-white transition-colors group",
                            sortConfig.key === s.key && "text-white"
                          )}
                          onClick={() => onSort(s.key)}
                        >
                          <div className="flex items-center justify-center gap-0">
                            {s.label}
                            <div className={cn(sortConfig.key === s.key ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity")}>
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
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded bg-dark-800 border border-dark-700/50 flex-shrink-0 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary-400">
                              {player.jersey || "-"}
                            </span>
                          </div>
                          <span className="text-white font-medium truncate text-[14px] leading-none">{player.name}</span>
                        </div>
                      </td>
                      {displayStats.map(s => (
                        <td key={s.key} className="relative px-0.5 py-1.5 text-center text-dark-200 tabular-nums text-[14px] leading-none">
                          <div className="flex items-center justify-center">
                            {getStatValue(player, s.key)}
                          </div>
                          <div className={cn(
                            "absolute -top-1 left-0 right-0 flex justify-center pointer-events-none transition-opacity duration-200",
                            s.key === "sc" && game.sport === "afl" && scIncreases[`${teamIdx}-${player.id}`] ? "opacity-100" : "opacity-0"
                          )}>
                            <SCIncreaseBadge increase={scIncreases[`${teamIdx}-${player.id}`]?.increase ?? 0} />
                          </div>
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
  );
}

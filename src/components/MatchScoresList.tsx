"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ScrollText, Goal, ChevronDown, ChevronRight } from "lucide-react";
import { Game } from "@/types";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MatchScoresListProps {
  gameId: string;
  game: Game;
  liveStats?: any;
}

export default function MatchScoresList({ gameId, game, liveStats }: MatchScoresListProps) {
  const [scores, setScores] = useState<any[]>([]);
  const [expandedPeriods, setExpandedPeriods] = useState<Record<number, boolean>>({});
  const fetchStats = useAction(api.sportsApi.fetchGameStats);
  
  const statsRecord = useQuery(api.stats.getPlayerStats, { externalId: game.externalId });

  // Update from liveStats if available (passed from parent or polling)
  useEffect(() => {
    if (liveStats?.scoringPlays) {
      setScores(liveStats.scoringPlays);
      // If we don't have any periods expanded yet, expand them all
      if (Object.keys(expandedPeriods).length === 0) {
        const periods = [...new Set(liveStats.scoringPlays.map((s: any) => s.p))];
        const initialExpanded: Record<number, boolean> = {};
        periods.forEach((p: any) => {
          initialExpanded[p] = true;
        });
        setExpandedPeriods(initialExpanded);
      }
    }
  }, [liveStats]);

  // The initial fetch is still useful for immediate data if Convex cache is empty,
  // but real-time updates now come from the liveStats prop (which polls the API)
  useEffect(() => {
    if (!statsRecord && !liveStats) {
      fetchStats({ 
        externalId: game.externalId, 
        leagueId: game.league.id, 
        gameId: game.id 
      }).then((res: any) => {
        if (res?.scoringPlays && !statsRecord) {
          setScores(res.scoringPlays);
          // Initialize all periods as expanded
          const periods = [...new Set(res.scoringPlays.map((s: any) => s.p))];
          const initialExpanded: Record<number, boolean> = {};
          periods.forEach((p: any) => {
            initialExpanded[p] = true;
          });
          setExpandedPeriods(initialExpanded);
        }
      });
    }
  }, [game.externalId, game.league.id, game.id, fetchStats, statsRecord]);

  useEffect(() => {
    if (statsRecord?.scoringPlays) {
      setScores(statsRecord.scoringPlays);
      // If we don't have any periods expanded yet, expand them all
      if (Object.keys(expandedPeriods).length === 0) {
        const periods = [...new Set(statsRecord.scoringPlays.map((s: any) => s.p))];
        const initialExpanded: Record<number, boolean> = {};
        periods.forEach((p: any) => {
          initialExpanded[p] = true;
        });
        setExpandedPeriods(initialExpanded);
      }
    }
  }, [statsRecord]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic (only if the last period is expanded)
  useEffect(() => {
    if (scrollRef.current && scores.length > 0) {
      const lastPeriod = Math.max(...scores.map(s => s.p));
      if (expandedPeriods[lastPeriod]) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [scores?.length, expandedPeriods]);

  if (!scores || scores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <ScrollText className="w-8 h-8 text-dark-600 mb-2" />
        <p className="text-xs text-dark-500">No scoring plays recorded yet.</p>
      </div>
    );
  }

  const togglePeriod = (p: number) => {
    setExpandedPeriods(prev => ({
      ...prev,
      [p]: !prev[p]
    }));
  };

  // Group scores by period
  const scoresByPeriod = scores.reduce((acc: Record<number, any[]>, score) => {
    if (!acc[score.p]) acc[score.p] = [];
    acc[score.p].push(score);
    return acc;
  }, {});

  const periods = Object.keys(scoresByPeriod)
    .map(Number)
    .sort((a, b) => a - b);

  // Helper to get last score of a period
  const getPeriodEndScore = (p: number) => {
    const periodScores = scoresByPeriod[p];
    if (!periodScores || periodScores.length === 0) return null;
    return periodScores.sort((a, b) => Number(a.seq) - Number(b.seq))[periodScores.length - 1];
  };

  // Prepare worm graph data
  const wormData = scores.sort((a, b) => Number(a.seq) - Number(b.seq)).map((s) => {
    const homeScore = Number(s.home || 0);
    const awayScore = Number(s.away || 0);
    const diff = homeScore - awayScore;
    return { diff, p: s.p, seq: s.seq };
  });

  return (
    <div className="flex flex-col h-full bg-dark-900/50">
      <div className="flex-1 overflow-y-auto custom-scrollbar" ref={scrollRef}>
        <div className="divide-y divide-dark-700/30">
          {periods.map((p) => {
            const lastScore = getPeriodEndScore(p);
            const periodWormData = wormData.filter(d => d.p === p);
            const maxDiffOverall = Math.max(...wormData.map(d => Math.abs(d.diff)), 10);

            return (
              <div key={p} className="flex flex-col">
                {/* Period Header */}
                <button 
                  onClick={() => togglePeriod(p)}
                  className="flex flex-col w-full bg-dark-800/60 hover:bg-dark-700/60 transition-colors border-y border-dark-700/30 sticky top-0 z-20 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-2 w-full">
                    <div className="flex items-center gap-2">
                      {expandedPeriods[p] ? (
                        <ChevronDown className="w-3.5 h-3.5 text-dark-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-dark-400" />
                      )}
                      <span className="text-[11px] font-bold text-white uppercase tracking-widest">
                        Quarter {p}
                      </span>
                    </div>
                    
                    {lastScore && (
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1 bg-dark-900/50 px-2 py-0.5 rounded border border-dark-700/50">
                          <span className="text-[10px] font-bold text-primary-400 tabular-nums">
                            {lastScore.home}
                          </span>
                          <span className="text-[8px] text-dark-500 font-bold">•</span>
                          <span className="text-[10px] font-bold text-dark-300 tabular-nums">
                            {lastScore.away}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tiny Worm Graph - Compact Visual representation of score momentum */}
                  {periodWormData.length > 1 && (
                    <div className="h-[30px] w-full relative px-4 flex items-center justify-center bg-dark-900/30 overflow-hidden">
                      {/* Zero line */}
                      <div className="absolute inset-x-4 h-[1px] bg-dark-700/50 top-1/2 -translate-y-1/2 z-0" />
                      
                      <svg className="w-full h-full relative z-10 overflow-visible" preserveAspectRatio="none" viewBox={`0 -${maxDiffOverall} 100 ${maxDiffOverall * 2}`}>
                        {/* Area Fill */}
                        <path
                          d={`M 0 0 ${periodWormData.map((d, i) => {
                            const x = (i / (periodWormData.length - 1)) * 100;
                            const y = -d.diff;
                            return `L ${x} ${y}`;
                          }).join(' ')} L 100 0 Z`}
                          className="fill-primary-500/10"
                        />
                        {/* Line */}
                        <path
                          d={`M 0 0 ${periodWormData.map((d, i) => {
                            const x = (i / (periodWormData.length - 1)) * 100;
                            const y = -d.diff;
                            return `L ${x} ${y}`;
                          }).join(' ')}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-primary-500/60 transition-all duration-700"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Period Scores */}
                {expandedPeriods[p] && (
                  <div className="divide-y divide-dark-700/20">
                    {scoresByPeriod[p].sort((a, b) => Number(a.seq) - Number(b.seq)).map((score) => {
                      const isHome = score.tId === game.homeTeam.id;
                      const isGoal = score.type === "goal";
                      
                      return (
                        <div key={score.id} className="px-4 py-2.5 hover:bg-dark-800/40 transition-colors animate-fade-in">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                              isGoal ? "bg-accent-green/10 text-accent-green" : "bg-accent-yellow/10 text-accent-yellow font-bold text-[10px]"
                            )}>
                              {isGoal ? <Goal className="w-3.5 h-3.5" /> : "1"}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <span className="text-[10px] font-bold text-dark-400 uppercase tracking-wider whitespace-nowrap">
                                    {score.clk}
                                  </span>
                                  {score.tName && (
                                    <span className="text-[9px] font-semibold text-dark-500 uppercase tracking-tight truncate">
                                      {score.tName}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-medium text-dark-500 tabular-nums">
                                  {score.home} - {score.away}
                                </span>
                              </div>
                              
                              <p className="text-xs text-dark-100 font-medium leading-relaxed">
                                <span className={cn(isHome ? "text-primary-400" : "text-dark-300")}>
                                  {score.pName || score.pShort || (score.text?.toLowerCase().includes("rushed") ? "Rushed" : "Unknown")}
                                </span>
                                {" "}
                                <span className="text-dark-400">
                                  {score.type === "goal" ? "Goal" : "Behind"}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

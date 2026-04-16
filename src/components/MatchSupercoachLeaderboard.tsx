"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, User, Plus, Minus } from "lucide-react";
import { useState } from "react";

interface MatchSupercoachLeaderboardProps {
  externalMatchId: string;
  homeTeam: { id: string; name: string; logo: string; shortName: string };
  awayTeam: { id: string; name: string; logo: string; shortName: string };
}

export default function MatchSupercoachLeaderboard({
  externalMatchId,
  homeTeam,
  awayTeam,
}: MatchSupercoachLeaderboardProps) {
  const scores = useQuery(api.stats.getMatchSupercoachScores, { externalMatchId });
  const [isExpanded, setIsExpanded] = useState(true);

  if (!scores || scores.length === 0) {
    return null;
  }

  const getTeamLogo = (teamId: string) => {
    if (teamId === homeTeam.id) return homeTeam.logo;
    if (teamId === awayTeam.id) return awayTeam.logo;
    return "";
  };

  return (
    <div className="border-t border-dark-700/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 pt-3 pb-2 flex items-center justify-between hover:bg-dark-700/20 transition-colors group"
      >
        <div className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <h3 className="text-[10px] font-semibold text-dark-300 uppercase tracking-wider">
            Supercoach Top 10
          </h3>
        </div>
        <div className="text-dark-500 group-hover:text-dark-300 transition-colors">
          {isExpanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-1.5">
          <AnimatePresence mode="popLayout">
            {scores.map((player, index) => {
              const teamLogo = getTeamLogo(player.teamId);
              return (
                <motion.div
                  key={player.playerId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    mass: 1,
                  }}
                  className="bg-dark-800/40 rounded-lg border border-dark-700/30 p-1.5 flex items-center gap-2 group/item hover:bg-dark-700/40 transition-colors"
                >
                  {/* Rank */}
                  <div className="w-4 text-center">
                    <span className="text-[9px] font-bold text-dark-500">
                      {index + 1}
                    </span>
                  </div>

                  {/* Player Image */}
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-dark-700 overflow-hidden border border-dark-600/50 flex-shrink-0">
                      {player.playerImage ? (
                        <img
                          src={player.playerImage}
                          alt={player.playerName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-4 h-4 text-dark-500" />
                        </div>
                      )}
                    </div>
                    {/* Team Logo Overlay */}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-dark-900 border border-dark-700 p-0.5 shadow-lg">
                      <img
                        src={teamLogo}
                        alt={player.teamName}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Player Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate leading-tight">
                      {player.playerName}
                    </p>
                    <p className="text-[9px] text-dark-400 font-medium truncate leading-tight">
                      {player.teamName}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-[12px] font-black text-primary-400 tabular-nums leading-tight">
                      {player.score}
                    </div>
                    <div className="text-[8px] text-dark-500 font-bold uppercase tracking-tighter leading-none">
                      PTS
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

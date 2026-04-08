"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Trophy, Users, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface Top10SupercoachProps {
  round?: number;
}

export default function Top10Supercoach({ round }: Top10SupercoachProps) {
  const scores = useQuery(api.stats.getTopSupercoachScores, {
    round: round,
    limit: 10,
  });

  if (!scores || scores.length === 0) {
    return null;
  }

  return (
    <div className="bg-dark-900/50 border border-dark-800/50 rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-dark-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <Trophy className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Supercoach Leaderboard
            </h3>
            <p className="text-[10px] text-dark-400 font-medium">
              {round ? `Round ${round}` : "Global"} Top 10
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-primary-500/10 rounded-full border border-primary-500/20">
          <TrendingUp className="w-3 h-3 text-primary-400" />
          <span className="text-[10px] font-bold text-primary-400 uppercase tracking-tight">
            Live Updates
          </span>
        </div>
      </div>

      <div className="p-2">
        <div className="grid grid-cols-1 gap-1">
          <AnimatePresence mode="popLayout">
            {scores.map((player, index) => (
              <motion.div
                key={`${player.playerId}-${player.externalMatchId}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="group flex items-center justify-between p-2 rounded-xl hover:bg-dark-800/50 transition-all border border-transparent hover:border-dark-700/50"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span
                      className={cn(
                        "absolute -top-1 -left-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black z-10 border-2 border-dark-900",
                        index === 0 ? "bg-yellow-500 text-dark-950" :
                        index === 1 ? "bg-slate-300 text-dark-950" :
                        index === 2 ? "bg-amber-600 text-white" :
                        "bg-dark-700 text-dark-300"
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-dark-800 border border-dark-700 overflow-hidden relative">
                      {player.playerImage ? (
                        <Image
                          src={player.playerImage}
                          alt={player.playerName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-dark-600" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-primary-400 transition-colors">
                      {player.playerName}
                    </div>
                    <div className="text-[10px] text-dark-400 font-medium">
                      {player.teamName} vs {player.opponentName}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black bg-gradient-to-br from-white to-dark-400 bg-clip-text text-transparent leading-none">
                    {player.score}
                  </div>
                  <div className="text-[9px] font-bold text-primary-500/70 uppercase tracking-widest">
                    Points
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import ChatWindow from "@/components/ChatWindow";
import LiveBadge from "@/components/LiveBadge";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import MatchStats from "@/components/MatchStats";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const game = useQuery(api.games.get, { id: gameId });
  const isLoading = game === undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold text-dark-300">Match not found</h2>
        <p className="text-sm text-dark-500">
          This match may have ended or doesn't exist.
        </p>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Matches
        </button>
      </div>
    );
  }

  const isLive = game.status === "live" || game.status === "halftime";
  const startDate = parseISO(game.startTime);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="lg:w-[420px] xl:w-[480px] flex-shrink-0 bg-dark-900 border-r border-dark-700/50 overflow-y-auto lg:h-screen">
        <div className="px-4 py-3 border-b border-dark-700/50">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Matches</span>
          </button>
        </div>

        <div className={`relative overflow-hidden ${isLive ? "bg-gradient-to-b from-red-950/20 to-transparent" : ""}`}>
          {isLive && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-red-400 to-red-500" />}

          <div className="px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-dark-400 uppercase tracking-wider">{game.league.name}</span>
              <LiveBadge status={game.status} minute={game.minute} />
            </div>

            {(game.round || game.leg || game.seriesNote) && (
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {game.round && <span className="text-[11px] font-medium text-primary-400 bg-primary-500/10 px-2 py-1 rounded-md">{game.round}</span>}
                {game.leg && <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md">{game.leg}</span>}
                {game.seriesNote && <span className="text-[11px] text-dark-400">{game.seriesNote}</span>}
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-dark-800 border border-dark-700/50 flex items-center justify-center overflow-hidden mb-3">
                  {game.homeTeam.logo ? (
                    <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-10 h-10 object-contain" />
                  ) : (
                    <span className="text-lg font-bold text-dark-400">{game.homeTeam.shortName.slice(0, 3)}</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white leading-tight">{game.homeTeam.name}</h3>
                <span className="text-[11px] text-dark-500 mt-0.5">Home</span>
              </div>

              <div className="flex flex-col items-center">
                {game.homeTeam.score !== undefined && game.awayTeam.score !== undefined ? (
                  <div className="flex items-center gap-3">
                    <span className={`text-4xl font-bold tabular-nums ${isLive ? "text-white" : "text-dark-300"}`}>{game.homeTeam.score}</span>
                    <span className="text-lg text-dark-600">:</span>
                    <span className={`text-4xl font-bold tabular-nums ${isLive ? "text-white" : "text-dark-300"}`}>{game.awayTeam.score}</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-lg font-semibold text-dark-300">{format(startDate, "HH:mm")}</p>
                    <p className="text-xs text-dark-500">{format(startDate, "MMM d, yyyy")}</p>
                  </div>
                )}
                {isLive && game.minute && <span className="mt-2 text-xs text-red-400 font-medium">{game.minute}'</span>}
              </div>

              <div className="flex-1 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-dark-800 border border-dark-700/50 flex items-center justify-center overflow-hidden mb-3">
                  {game.awayTeam.logo ? (
                    <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-10 h-10 object-contain" />
                  ) : (
                    <span className="text-lg font-bold text-dark-400">{game.awayTeam.shortName.slice(0, 3)}</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white leading-tight">{game.awayTeam.name}</h3>
                <span className="text-[11px] text-dark-500 mt-0.5">Away</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-dark-700/50 space-y-2">
              {game.venue && (
                <div className="flex items-center gap-2 text-xs text-dark-400">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{game.venue}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-dark-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>{format(startDate, "EEEE, MMMM d, yyyy · HH:mm")}</span>
              </div>
            </div>
          </div>
        </div>

        <MatchStats game={game} />

        <div className="px-6 py-4 border-t border-dark-700/50">
          <div className="flex items-start gap-3 bg-dark-800/50 rounded-xl p-4 border border-dark-700/30">
            <span className="text-xl">💬</span>
            <div>
              <h4 className="text-sm font-medium text-dark-200 mb-1">Match Chat</h4>
              <p className="text-xs text-dark-400 leading-relaxed">
                Share your thoughts, reactions, and predictions with other fans watching this game. Sign in to participate!
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] relative">
        <ChatWindow gameId={gameId} game={game} />
      </div>
    </div>
  );
}

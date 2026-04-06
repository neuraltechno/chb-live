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
import PlayerStats from "@/components/PlayerStats";
import MatchSupercoachLeaderboard from "@/components/MatchSupercoachLeaderboard";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useEffect, useState } from "react";

function TeamScoreAfl({ team, gameExternalId, leagueId, gameId, onStatusUpdate }: { team: any, gameExternalId: string, leagueId: string, gameId: string, onStatusUpdate: (status: string) => void }) {
  const fetchStats = useAction(api.sportsApi.fetchGameStats);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchStats({ externalId: gameExternalId, leagueId, gameId }).then((res) => {
      setStats(res);
      // If we are on the match page, we can use the 'sts' from FootyInfo for AFL
      if (res?.sts && leagueId === "afl") {
        const sts = res.sts.toLowerCase();
        if (sts.includes("end of") || sts === "halftime") {
           onStatusUpdate(res.sts);
        }
      }
    });
  }, [gameExternalId, leagueId, gameId, fetchStats, onStatusUpdate]);

  if (!stats || !stats.home || !stats.away) return <span>{team.score}</span>;

  // Find which side matches our passed team ID
  const side = (stats.home.teamId === String(team.id)) ? 'home' : 'away';
  const goals = stats[side]?.goals || "0";
  const behinds = stats[side]?.behinds || "0";

  return <span>{goals}.{behinds}.{team.score}</span>;
}

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;
  const [detailStatus, setDetailStatus] = useState<string | null>(null);

  const game = useQuery(api.games.get, { id: gameId });
  const isLoading = game === undefined;

  useEffect(() => {
    if (game) {
      console.log(`[MatchPage Debug] Full Game Data:`, JSON.stringify(game, null, 2));
    }
  }, [game]);

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

  const renderStatus = () => {
    if (game.status === "scheduled") return null;
    if (game.status === "halftime" || game.statusDescription === "Halftime") return "Halftime";
    if (game.status === "finished") return "Final";
    
    if (game.displayClock || game.period) {
      const periodStr = game.period ? `Q${game.period}` : "";
      const clockStr = game.displayClock || "";
      return `${periodStr} ${clockStr}`.trim();
    }
    
    return game.statusDescription || null;
  };

  const statusText = detailStatus || renderStatus();

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row bg-dark-950 overflow-hidden">
      {/* Column 1: Team Info & Team Stats (15%) */}
      <div className="lg:w-[15%] flex-shrink-0 bg-dark-900 border-r border-dark-700/50 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-700/50">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Matches</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {game.sport === "afl" && (
            <div className="hidden">
              <TeamScoreAfl 
                team={game.homeTeam} 
                gameExternalId={game.externalId} 
                leagueId={game.league.id} 
                gameId={game.id} 
                onStatusUpdate={setDetailStatus}
              />
            </div>
          )}
          {game.sport === "afl" && (
            <MatchSupercoachLeaderboard
              externalMatchId={game.externalId}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
            />
          )}
          <MatchStats game={game} />
        </div>
      </div>

      {/* Column 2: Player Stats (70%) */}
      <div className="lg:w-[70%] flex-1 bg-dark-950 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-700/50 bg-dark-900/50 backdrop-blur-sm z-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary-500 rounded-full"></span>
              {game.homeTeam.shortName} vs {game.awayTeam.shortName}
            </h2>
            <div className="flex items-center gap-4 text-[11px] text-dark-400 border-l border-dark-700/50 pl-6">
              {game.venue && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary-500/70" />
                  <span>{game.venue}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary-500/70" />
                <span>{format(startDate, "MMM d, yyyy · HH:mm")}</span>
              </div>
              {(game.round && game.round !== "undefined" && game.round !== "Round undefined") && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-dark-600" />
                  <span className="font-medium text-primary-400">{game.round}</span>
                </div>
              )}
              {statusText && (
                <div className="flex items-center gap-1.5 border-l border-dark-700/50 pl-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-bold text-primary-400">{statusText}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LiveBadge status={game.status} minute={game.minute} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <PlayerStats game={game} />
        </div>
      </div>

      {/* Column 3: Chat (15%) */}
      <div className="lg:w-[15%] flex-shrink-0 bg-dark-900 border-l border-dark-700/50 flex flex-col overflow-hidden relative">
        <div className="px-4 py-3 border-b border-dark-700/50 bg-dark-900/80 backdrop-blur-sm z-10">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Match Chat
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          </h3>
        </div>
        <div className="flex-1 relative">
          <ChatWindow gameId={gameId} game={game} />
        </div>
      </div>
    </div>
  );
}

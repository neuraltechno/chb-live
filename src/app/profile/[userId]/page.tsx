"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Calendar,
  MessageSquare,
  Star,
  TrendingUp,
  Loader2,
  Settings,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import TeamActivityCard from "@/components/TeamActivityCard";
import { FavoriteTeam, TeamActivity } from "@/types";

interface PublicProfile {
  _id: string;
  username: string;
  avatar?: string;
  bio?: string;
  favoriteTeams: FavoriteTeam[];
  teamActivity: TeamActivity[];
  totalMessages: number;
  joinedAt: string;
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const userId = params.userId as string;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const isOwnProfile =
    session?.user && (session.user as any).id === userId;

  useEffect(() => {
    if (!userId) return;

    // If this is own profile, redirect to /profile
    if (isOwnProfile) {
      router.replace("/profile");
      return;
    }

    setIsLoading(true);
    fetch(`/api/profile/${userId}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setProfile(result.data);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [userId, isOwnProfile, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold text-dark-300">
          User not found
        </h2>
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

  return (
    <div className="min-h-screen bg-dark-950 bg-grid-pattern">
      {/* Header */}
      <div className="bg-dark-900 border-b border-dark-700/50">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-br from-primary-600/20 via-primary-800/10 to-dark-900 relative">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <button
              onClick={() => router.back()}
              className="absolute top-4 left-4 flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm bg-dark-900/50 backdrop-blur-sm px-3 py-1.5 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-end gap-4 -mt-10 pb-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-dark-800 border-4 border-dark-900 flex-shrink-0">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary-600/20">
                  <span className="text-2xl font-bold text-primary-400">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-xl font-bold text-white truncate">
                {profile.username}
              </h1>
              {profile.bio && (
                <p className="text-sm text-dark-400 mt-0.5 line-clamp-2">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-5 pb-4 text-xs text-dark-500">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{profile.totalMessages} messages</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Joined {format(parseISO(profile.joinedAt), "MMMM yyyy")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Favorite Teams */}
        {profile.favoriteTeams && profile.favoriteTeams.length > 0 && (
          <section className="bg-dark-900 rounded-2xl border border-dark-700/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-700/50 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">
                Favorite Teams
              </h2>
              <span className="text-[10px] text-dark-500 bg-dark-800 px-2 py-0.5 rounded-full ml-auto">
                {profile.favoriteTeams.length}/3
              </span>
            </div>
            <div className="px-5 py-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {profile.favoriteTeams.map((team, i) => {
                  const sportColor: Record<string, string> = {
                    soccer: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
                    ncaa_football: "bg-orange-500/15 text-orange-400 border-orange-500/20",
                    ncaa_basketball: "bg-blue-500/15 text-blue-400 border-blue-500/20",
                  };
                  const sportLabel: Record<string, string> = {
                    soccer: "Soccer",
                    ncaa_football: "NCAAF",
                    ncaa_basketball: "NCAAB",
                  };
                  return (
                    <div
                      key={team.teamId}
                      className="relative flex flex-col items-center gap-2 p-4 rounded-xl bg-dark-800/60 border border-dark-700/30 text-center"
                    >
                      {/* Rank */}
                      <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] font-bold text-dark-900 z-10">
                        {i + 1}
                      </span>

                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="w-12 h-12 object-contain rounded-lg bg-dark-700/50 p-1.5"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-dark-700 flex items-center justify-center">
                          <span className="text-lg font-bold text-dark-400">
                            {team.shortName.slice(0, 2)}
                          </span>
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-semibold text-dark-100 leading-tight">
                          {team.name}
                        </p>
                        {team.sport && (
                          <span
                            className={`mt-1 inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                              sportColor[team.sport] ?? "bg-dark-700 text-dark-400 border-dark-600"
                            }`}
                          >
                            {sportLabel[team.sport] ?? team.sport}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Top Active Chats */}
        {profile.teamActivity && profile.teamActivity.length > 0 && (
          <section className="bg-dark-900 rounded-2xl border border-dark-700/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-700/50 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent-green" />
              <h2 className="text-sm font-semibold text-white">
                Most Active Chats
              </h2>
            </div>
            <div className="px-5 py-5">
              <TeamActivityCard
                activity={profile.teamActivity}
                isOwnProfile={false}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

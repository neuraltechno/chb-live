"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  Calendar,
  Star,
  TrendingUp,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { format } from "date-fns";
import TeamActivityCard from "@/components/TeamActivityCard";
import { useDMStore } from "@/lib/store";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const userId = params.userId as any;
  const { openDM } = useDMStore();

  const profile = useQuery(api.users.getById, { id: userId });
  const teamActivity = useQuery(api.users.getTeamActivity, { userId });

  const isLoading = profile === undefined;
  const isOwnProfile = clerkUser?.id && profile?.clerkId === clerkUser.id;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold text-dark-300">User not found</h2>
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
      <div className="bg-dark-900 border-b border-dark-700/50">
        <div className="h-28 bg-gradient-to-br from-primary-600/20 via-primary-800/10 to-dark-900 relative">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <button
              onClick={() => router.back()}
              className="absolute top-4 left-4 flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm bg-dark-900/50 backdrop-blur-sm px-3 py-1.5 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-6">
          <div className="relative flex items-end justify-between -mt-10">
            <div className="w-24 h-24 rounded-3xl border-4 border-dark-950 overflow-hidden bg-dark-800 shadow-xl">
              {profile.image ? (
                <img
                  src={profile.image}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary-600/20">
                  <span className="text-3xl font-bold text-primary-400">
                    {profile.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 mb-1">
              {!isOwnProfile && (
                <button
                  onClick={() => openDM(profile._id)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold transition-all shadow-lg shadow-primary-900/20"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h1 className="text-2xl font-bold text-white">
              {profile.username}
            </h1>
            {profile.bio && (
              <p className="mt-2 text-dark-300 text-sm leading-relaxed max-w-xl">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-dark-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Joined {format(new Date(profile._creationTime), "MMMM yyyy")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {profile.favoriteTeams && profile.favoriteTeams.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Favorite Teams
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {profile.favoriteTeams.map((team: any) => (
                <div
                  key={team.teamId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-dark-900 border border-dark-700/50"
                >
                  <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center p-1.5 flex-shrink-0">
                    {team.logo ? (
                      <img
                        src={team.logo}
                        alt={team.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-dark-500">
                        {team.shortName}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-dark-200 truncate">
                    {team.name}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {teamActivity && teamActivity.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-accent-green" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Recent Chat Activity
              </h2>
            </div>
            <div className="grid gap-3">
              <TeamActivityCard activity={teamActivity as any} isOwnProfile={false} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

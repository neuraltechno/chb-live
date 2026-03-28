"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import {
  X,
  Calendar,
  MessageSquare,
  Star,
  Loader2,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { format } from "date-fns";
import TeamActivityCard from "./TeamActivityCard";
import { useDMStore } from "@/lib/store";
import { api } from "../../convex/_generated/api";

interface UserProfileModalProps {
  userId: any; // Convex ID
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({
  userId,
  isOpen,
  onClose,
}: UserProfileModalProps) {
  const router = useRouter();
  const { openDM } = useDMStore();

  const profile = useQuery(api.users.getById, isOpen ? { id: userId } : "skip");
  const teamActivity = useQuery(
    api.users.getTeamActivity,
    isOpen ? { userId } : "skip"
  );

  const isLoading = profile === undefined;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-dark-900 border border-dark-700/50 rounded-2xl shadow-2xl w-full max-sm pointer-events-auto animate-slide-up overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : !profile ? (
            <div className="text-center py-16 px-6">
              <p className="text-sm text-dark-400">User not found</p>
              <button
                onClick={onClose}
                className="mt-4 text-xs text-primary-400 hover:underline"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="h-20 bg-gradient-to-br from-primary-600/30 via-primary-800/20 to-dark-900" />
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-dark-800/80 border border-dark-700/50 text-dark-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute -bottom-8 left-5">
                  <div className="w-16 h-16 rounded-2xl border-4 border-dark-900 overflow-hidden bg-dark-800">
                    {profile.image ? (
                      <img
                        src={profile.image}
                        alt={profile.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary-600/20">
                        <span className="text-xl font-bold text-primary-400">
                          {profile.username?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 pt-11 pb-4">
                <h3 className="text-base font-bold text-white">
                  {profile.username}
                </h3>
                {profile.bio && (
                  <p className="text-xs text-dark-400 mt-1 leading-relaxed">
                    {profile.bio}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-dark-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      Joined {format(new Date(profile._creationTime), "MMM yyyy")}
                    </span>
                  </div>
                </div>
              </div>

              {profile.favoriteTeams && profile.favoriteTeams.length > 0 && (
                <div className="px-5 pb-3">
                  <h4 className="text-[10px] font-bold text-dark-500 uppercase tracking-widest mb-2">
                    <Star className="w-3 h-3 inline mr-1 text-amber-400" />
                    Favorite Teams
                  </h4>
                  <div className="flex gap-2">
                    {profile.favoriteTeams.map((team: any) => (
                      <div
                        key={team.teamId}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-dark-800/60 border border-dark-700/30 text-xs"
                      >
                        {team.logo && (
                          <img
                            src={team.logo}
                            alt={team.name}
                            className="w-4 h-4 object-contain"
                          />
                        )}
                        <span className="text-dark-300">{team.shortName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {teamActivity && teamActivity.length > 0 && (
                <div className="px-5 pb-4">
                  <h4 className="text-[10px] font-bold text-dark-500 uppercase tracking-widest mb-2">
                    Most Active Chats
                  </h4>
                  <TeamActivityCard
                    activity={teamActivity as any}
                    isOwnProfile={false}
                  />
                </div>
              )}

              <div className="px-5 pb-5 flex gap-2.5">
                <button
                  onClick={() => {
                    onClose();
                    openDM(profile._id);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-all text-xs font-semibold shadow-lg shadow-primary-900/30"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Message
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push(`/profile/${profile._id}`);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark-800 border border-dark-700/50 text-dark-300 hover:text-white hover:border-dark-600 transition-all text-xs font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Profile
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

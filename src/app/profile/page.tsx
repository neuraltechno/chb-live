"use client";

import { useEffect, useState } from "react";
import { useUser, UserProfile as ClerkUserProfile } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Loader2,
  Save,
  Calendar,
  Star,
  TrendingUp,
  Shield,
  Pen,
} from "lucide-react";
import { format } from "date-fns";
import { FavoriteTeam } from "@/types";
import FavoriteTeamsPicker from "@/components/FavoriteTeamsPicker";
import TeamActivityCard from "@/components/TeamActivityCard";
import toast from "react-hot-toast";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function ProfilePage() {
  const { isLoaded: isClerkLoaded, isSignedIn, user: clerkUser } = useUser();
  const router = useRouter();

  const profile = useQuery(api.users.getMe);
  const teamActivity = useQuery(
    api.users.getTeamActivity,
    profile ? { userId: profile._id } : "skip"
  );
  const updateProfileMutation = useMutation(api.users.updateProfile);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [favoriteTeams, setFavoriteTeams] = useState<FavoriteTeam[]>([]);
  const [hiddenTeams, setHiddenTeams] = useState<string[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);

  const [allTeams, setAllTeams] = useState<any[]>([]);

  // Redirect if not logged in
  useEffect(() => {
    if (isClerkLoaded && !isSignedIn) {
      router.push("/");
    }
  }, [isClerkLoaded, isSignedIn, router]);

  // Sync state with profile data
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setFavoriteTeams((profile.favoriteTeams || []) as FavoriteTeam[]);
      setHiddenTeams(profile.hiddenActivityTeams || []);
    }
  }, [profile]);

  // Fetch available teams (from games query)
  const games = useQuery(api.games.list, {});
  useEffect(() => {
    if (games) {
      const teamMap = new Map<string, any>();
      for (const game of games) {
        for (const side of ["homeTeam", "awayTeam"] as const) {
          const t = game[side];
          if (t && t.name && t.name !== "TBD" && !teamMap.has(t.id)) {
            teamMap.set(t.id, {
              teamId: t.id,
              name: t.name,
              shortName: t.shortName,
              logo: t.logo,
              sport: game.sport,
            });
          }
        }
      }
      setAllTeams(
        Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      );
    }
  }, [games]);

  const hasChanges =
    profile &&
    (username !== (profile.username || "") ||
      bio !== (profile.bio || "") ||
      JSON.stringify(favoriteTeams) !== JSON.stringify(profile.favoriteTeams || []) ||
      JSON.stringify(hiddenTeams) !== JSON.stringify(profile.hiddenActivityTeams || []));

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      await updateProfileMutation({
        username,
        bio,
        favoriteTeams: favoriteTeams as any,
        hiddenActivityTeams: hiddenTeams,
      });
      toast.success("Profile updated!");
    } catch (e) {
      toast.error("Failed to save profile");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleToggleHideTeam = (teamName: string) => {
    setHiddenTeams((prev) =>
      prev.includes(teamName)
        ? prev.filter((t) => t !== teamName)
        : [...prev, teamName]
    );
  };

  if (!isClerkLoaded || profile === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const activityWithHidden = (teamActivity || []).map((ta) => ({
    ...ta,
    hidden: hiddenTeams.includes(ta.teamName),
  }));

  return (
    <div className="min-h-screen bg-dark-950 bg-grid-pattern">
      <div className="bg-dark-900 border-b border-dark-700/50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Matches</span>
          </button>

          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-dark-800 border-2 border-dark-700/50 flex-shrink-0">
              {clerkUser?.imageUrl ? (
                <img
                  src={clerkUser.imageUrl}
                  alt={username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary-600/20">
                  <span className="text-2xl font-bold text-primary-400">
                    {username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white truncate">
                {username || clerkUser?.fullName}
              </h1>
              {bio && <p className="text-sm text-dark-400 mt-0.5">{bio}</p>}
              <div className="flex items-center gap-4 mt-2 text-xs text-dark-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Joined {format(new Date(profile._creationTime), "MMMM yyyy")}
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Clerk Auth
                </div>
              </div>
            </div>

            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saveLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-all disabled:opacity-50 flex-shrink-0"
              >
                {saveLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section className="bg-dark-900 rounded-2xl border border-dark-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-700/50 flex items-center gap-2">
            <Pen className="w-4 h-4 text-primary-400" />
            <h2 className="text-sm font-semibold text-white">Edit Profile</h2>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-dark-400 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={20}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700/50 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/25 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-dark-400 mb-1.5">
                Bio
                <span className="text-dark-600 ml-1">({bio.length}/160)</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={2}
                placeholder="Tell us about yourself..."
                className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700/50 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/25 transition-all resize-none"
              />
            </div>
          </div>
        </section>

        <section className="bg-dark-900 rounded-2xl border border-dark-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-700/50 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Favorite Teams</h2>
          </div>
          <div className="px-5 py-5">
            <FavoriteTeamsPicker
              selected={favoriteTeams}
              onChange={setFavoriteTeams}
              allTeams={allTeams}
            />
          </div>
        </section>

        <section className="bg-dark-900 rounded-2xl border border-dark-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-700/50 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-green" />
            <h2 className="text-sm font-semibold text-white">Top Active Chats</h2>
          </div>
          <div className="px-5 py-5">
            <TeamActivityCard
              activity={activityWithHidden as any}
              isOwnProfile={true}
              onToggleHide={handleToggleHideTeam}
            />
          </div>
        </section>

        <section className="bg-dark-900 rounded-2xl border border-dark-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-700/50 flex items-center gap-2">
            <Shield className="w-4 h-4 text-dark-400" />
            <h2 className="text-sm font-semibold text-white">Account Settings</h2>
          </div>
          <div className="p-5">
            <p className="text-xs text-dark-400 mb-4">
              Manage your account security and email settings via Clerk.
            </p>
            <ClerkUserProfile />
          </div>
        </section>
      </div>
    </div>
  );
}

"use client";

import { TeamActivity } from "@/types";
import { Eye, EyeOff, TrendingUp, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamActivityCardProps {
  activity: TeamActivity[];
  isOwnProfile: boolean;
  onToggleHide?: (teamName: string) => void;
}

export default function TeamActivityCard({
  activity,
  isOwnProfile,
  onToggleHide,
}: TeamActivityCardProps) {
  // For public view, filter out hidden ones
  const visible = isOwnProfile
    ? activity
    : activity.filter((ta) => !ta.hidden);

  if (visible.length === 0) {
    return (
      <div className="text-center py-6">
        <MessageSquare className="w-8 h-8 text-dark-600 mx-auto mb-2" />
        <p className="text-xs text-dark-500">
          No chat activity yet. Start chatting on match pages!
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...visible.map((t) => t.count), 1);

  return (
    <div className="space-y-2.5">
      {visible.map((team, i) => (
        <div
          key={team.teamName}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
            team.hidden
              ? "bg-dark-800/30 border-dark-700/20 opacity-60"
              : "bg-dark-800/60 border-dark-700/30"
          )}
        >
          {/* Rank */}
          <span
            className={cn(
              "text-xs font-bold w-5 text-center",
              i === 0
                ? "text-amber-400"
                : i === 1
                ? "text-dark-300"
                : i === 2
                ? "text-orange-400"
                : "text-dark-500"
            )}
          >
            #{i + 1}
          </span>

          {/* Logo */}
          <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {team.teamLogo ? (
              <img
                src={team.teamLogo}
                alt={team.teamName}
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-[10px] font-bold text-dark-400">
                {team.teamName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Name & bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-dark-200 truncate">
                {team.teamName}
              </span>
              <span className="text-[11px] text-dark-400 tabular-nums ml-2 flex-shrink-0">
                {team.count} msgs
              </span>
            </div>
            <div className="h-1 bg-dark-700/50 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  i === 0
                    ? "bg-amber-500"
                    : i === 1
                    ? "bg-primary-500"
                    : "bg-dark-500"
                )}
                style={{ width: `${(team.count / maxCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Hide toggle (own profile only) */}
          {isOwnProfile && onToggleHide && (
            <button
              onClick={() => onToggleHide(team.teamName)}
              className="p-1.5 rounded-lg hover:bg-dark-600/50 text-dark-500 hover:text-dark-300 transition-colors"
              title={team.hidden ? "Show on profile" : "Hide from profile"}
            >
              {team.hidden ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

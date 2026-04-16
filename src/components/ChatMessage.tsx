"use client";

import { Message } from "@/types";
import { format, parseISO } from "date-fns";
import { Reply, Shield, Trophy, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: Message;
  isOwnMessage: boolean;
  onClickAvatar?: (userId: string) => void;
  onReply?: (message: Message) => void;
}

export default function ChatMessage({ message, isOwnMessage, onClickAvatar, onReply }: ChatMessageProps) {
  const time = message.createdAt ? format(parseISO(message.createdAt), "HH:mm") : "00:00";
  const isMatchBot = message.user.username === "MatchBot";

  const roleStyles: Record<string, { nameClass: string; bubbleClass: string; badgeIcon: any; badgeColor: string }> = {
    admin: {
      nameClass: "text-amber-500 font-bold",
      bubbleClass: "border-l-2 border-amber-500/50 bg-amber-500/5",
      badgeIcon: Shield,
      badgeColor: "text-amber-500",
    },
    Admin: {
      nameClass: "text-amber-500 font-bold",
      bubbleClass: "border-l-2 border-amber-500/50 bg-amber-500/5",
      badgeIcon: Shield,
      badgeColor: "text-amber-500",
    },
    moderator: {
      nameClass: "text-blue-400 font-semibold",
      bubbleClass: "border-l-2 border-blue-400/50 bg-blue-400/5",
      badgeIcon: Shield,
      badgeColor: "text-blue-400",
    },
    winner: {
      nameClass: "text-emerald-400 font-semibold",
      bubbleClass: "border-l-2 border-emerald-400/50 bg-emerald-400/5",
      badgeIcon: Trophy,
      badgeColor: "text-emerald-400",
    },
  };

  const userRole = message.user.role || "user";
  const currentStyle = roleStyles[userRole];

  // Force debug: Log the role and style for the user
  console.log(`DEBUG CHAT: User: ${message.user.username}, Role: ${userRole}, HasStyle: ${!!currentStyle}, ClerkID: ${message.user._id}`);

  if (message.type === "reaction") {
    return (
      <div className="flex justify-center py-1 animate-fade-in">
        <span className="text-2xl">{message.content}</span>
      </div>
    );
  }

  const handleAvatarClick = () => {
    if (isMatchBot) return;
    if (onClickAvatar) onClickAvatar(message.user._id);
  };

  return (
    <div
      className={cn(
        "group flex flex-col gap-0.5 animate-slide-up px-2 py-0.5 hover:bg-dark-800/30 transition-colors",
        isMatchBot && "items-center my-1"
      )}
    >
      {/* Reply preview */}
      {message.replyTo && (
        <div
          className={cn(
            "flex items-center gap-2 mb-0.5 px-2 py-0.5 rounded bg-dark-800/50 border-l-2 border-primary-500/40 max-w-[90%] text-[10px]",
            isOwnMessage ? "self-end" : "self-start"
          )}
        >
          <Reply className="w-2.5 h-2.5 text-dark-500" />
          <span className="font-semibold text-primary-400/80 truncate">
            {message.replyTo.username}:
          </span>
          <span className="text-dark-400 truncate leading-tight">
            {message.replyTo.content}
          </span>
        </div>
      )}

      <div className={cn(
        "flex items-baseline gap-2 w-full",
        isMatchBot && "justify-center"
      )}>
        {/* Time */}
        {!isMatchBot && (
          <span className="text-[10px] text-dark-500 tabular-nums flex-shrink-0 w-8">
            {time}
          </span>
        )}

        {/* Username & Message Content */}
        <div className={cn(
          "flex flex-wrap items-baseline gap-x-1.5 min-w-0 flex-1",
          isMatchBot && "justify-center"
        )}>
          {!isMatchBot && (
            <button
              onClick={handleAvatarClick}
              className={cn(
                "text-xs font-bold hover:underline transition-opacity cursor-pointer flex items-center gap-1 flex-shrink-0",
                currentStyle ? currentStyle.nameClass : "text-primary-400"
              )}
            >
              {message.user.username}
              {currentStyle?.badgeIcon && (
                <currentStyle.badgeIcon className={cn("w-2.5 h-2.5", currentStyle.badgeColor)} />
              )}
              {message.user.badges?.includes("early_adopter") && (
                <Star className="w-2.5 h-2.5 text-purple-400" fill="currentColor" />
              )}
              <span className="text-dark-500 font-normal">:</span>
            </button>
          )}

          <div
            className={cn(
              "text-[13px] leading-relaxed break-words text-dark-100",
              isMatchBot && "bg-accent-blue/10 border border-accent-blue/30 text-accent-blue-light italic text-xs px-3 py-1 rounded-full",
              isOwnMessage && !isMatchBot && "text-white"
            )}
          >
            {message.content}
          </div>

          {onReply && !isMatchBot && (
            <button
              onClick={() => onReply(message)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-dark-500 hover:text-primary-400 transition-all inline-flex items-center"
              title="Reply"
            >
              <Reply className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

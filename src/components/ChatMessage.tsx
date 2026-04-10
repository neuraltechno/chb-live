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
        "group flex gap-2 animate-slide-up",
        isOwnMessage && "flex-row-reverse",
        isMatchBot && "justify-center w-full my-1"
      )}
    >
      {/* Avatar */}
      {!isMatchBot && (
        <button
          onClick={handleAvatarClick}
          className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity mt-0.5"
        >
          {message.user.avatar ? (
            <img
              src={message.user.avatar}
              alt={message.user.username}
              className="w-7 h-7 rounded-full"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-primary-600/30 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary-300">
                {message.user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </button>
      )}

      {/* Message Bubble */}
      <div
        className={cn(
          isMatchBot ? "max-w-[90%]" : "max-w-[85%]",
          isOwnMessage ? "items-end" : "items-start",
          isMatchBot && "items-center text-center"
        )}
      >
        {/* Username */}
        {!isMatchBot && (
          <button
            onClick={handleAvatarClick}
            className={cn(
              "text-[10px] font-medium mb-0 px-1 hover:opacity-80 transition-opacity cursor-pointer text-left leading-none flex items-center gap-1",
              currentStyle ? currentStyle.nameClass : "text-dark-400 hover:text-primary-400"
            )}
          >
            {message.user.username}
            {currentStyle?.badgeIcon && (
              <currentStyle.badgeIcon className={cn("w-2.5 h-2.5", currentStyle.badgeColor)} />
            )}
            {message.user.badges?.includes("early_adopter") && (
              <Star className="w-2.5 h-2.5 text-purple-400" fill="currentColor" />
            )}
          </button>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div
            className={cn(
              "flex items-start gap-1 mb-0.5 px-2 py-1 rounded-lg border-l-2 border-primary-500/60 bg-dark-700/40 max-w-full",
              isOwnMessage && "ml-auto"
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold text-primary-400 truncate leading-none">
                {message.replyTo.username}
              </p>
              <p className="text-[10px] text-dark-400 truncate leading-tight mt-0.5">
                {message.replyTo.content}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 group">
          {isOwnMessage && onReply && (
            <button
              onClick={() => onReply(message)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-dark-500 hover:text-primary-400 hover:bg-dark-700/50 transition-all"
              title="Reply"
            >
              <Reply className="w-3 h-3" />
            </button>
          )}
          <div
            className={cn(
              "px-2.5 py-1.5 rounded-xl text-[13px] leading-snug break-words",
              isOwnMessage
                ? "bg-primary-600 text-white rounded-br-sm"
                : isMatchBot
                ? "bg-accent-blue/10 border border-accent-blue/30 text-accent-blue-light italic text-xs"
                : cn("bg-dark-700/80 text-dark-100 rounded-bl-sm", currentStyle?.bubbleClass)
            )}
          >
            {message.content}
          </div>
          {!isOwnMessage && onReply && !isMatchBot && (
            <button
              onClick={() => onReply(message)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-dark-500 hover:text-primary-400 hover:bg-dark-700/50 transition-all"
              title="Reply"
            >
              <Reply className="w-3 h-3" />
            </button>
          )}
        </div>
        {!isMatchBot && (
          <p
            className={cn(
              "text-[9px] text-dark-500 mt-0 px-1 leading-none",
              isOwnMessage ? "text-right" : "text-left"
            )}
          >
            {time}
          </p>
        )}
      </div>
    </div>
  );
}

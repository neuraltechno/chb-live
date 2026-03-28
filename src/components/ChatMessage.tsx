"use client";

import { Message } from "@/types";
import { format, parseISO } from "date-fns";
import { Reply } from "lucide-react";

interface ChatMessageProps {
  message: Message;
  isOwnMessage: boolean;
  onClickAvatar?: (userId: string) => void;
  onReply?: (message: Message) => void;
}

export default function ChatMessage({ message, isOwnMessage, onClickAvatar, onReply }: ChatMessageProps) {
  const time = message.createdAt ? format(parseISO(message.createdAt), "HH:mm") : "00:00";

  if (message.type === "reaction") {
    return (
      <div className="flex justify-center py-1 animate-fade-in">
        <span className="text-2xl">{message.content}</span>
      </div>
    );
  }

  const handleAvatarClick = () => {
    if (onClickAvatar) onClickAvatar(message.user._id);
  };

  return (
    <div
      className={`group flex gap-2.5 animate-slide-up ${
        isOwnMessage ? "flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      <button
        onClick={handleAvatarClick}
        className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
      >
        {message.user.avatar ? (
          <img
            src={message.user.avatar}
            alt={message.user.username}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary-600/30 flex items-center justify-center">
            <span className="text-xs font-bold text-primary-300">
              {message.user.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </button>

      {/* Message Bubble */}
      <div className={`max-w-[75%] ${isOwnMessage ? "items-end" : "items-start"}`}>
        {/* Username */}
        {!isOwnMessage && (
          <button
            onClick={handleAvatarClick}
            className="text-[11px] font-medium text-dark-400 mb-0.5 px-1 hover:text-primary-400 transition-colors cursor-pointer text-left"
          >
            {message.user.username}
          </button>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div
            className={`flex items-start gap-1.5 mb-1 px-2.5 py-1.5 rounded-lg border-l-2 border-primary-500/60 bg-dark-700/40 max-w-full ${
              isOwnMessage ? "ml-auto" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-primary-400 truncate">
                {message.replyTo.username}
              </p>
              <p className="text-[11px] text-dark-400 truncate leading-snug">
                {message.replyTo.content}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 group">
          {isOwnMessage && onReply && (
            <button
              onClick={() => onReply(message)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-dark-500 hover:text-primary-400 hover:bg-dark-700/50 transition-all"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          )}
          <div
            className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
              isOwnMessage
                ? "bg-primary-600 text-white rounded-br-md"
                : "bg-dark-700/80 text-dark-100 rounded-bl-md"
            }`}
          >
            {message.content}
          </div>
          {!isOwnMessage && onReply && (
            <button
              onClick={() => onReply(message)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-dark-500 hover:text-primary-400 hover:bg-dark-700/50 transition-all"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p
          className={`text-[10px] text-dark-500 mt-0.5 px-1 ${
            isOwnMessage ? "text-right" : "text-left"
          }`}
        >
          {time}
        </p>
      </div>
    </div>
  );
}

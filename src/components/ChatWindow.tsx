"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { Game, Message } from "@/types";
import ChatMessage from "./ChatMessage";
import UserProfileModal from "./UserProfileModal";
import {
  Send,
  Users,
  Smile,
  Lock,
  ArrowDown,
  Loader2,
  X,
  Reply,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useChatPolling } from "@/hooks/use-chat-polling";

const QUICK_REACTIONS = ["⚽", "🔥", "😮", "👏", "😂", "💪", "❤️", "😤"];

interface ChatWindowProps {
  gameId: string;
  game: Game;
}

export default function ChatWindow({ gameId, game }: ChatWindowProps) {
  const { isLoaded: isUserLoaded, isSignedIn, user: clerkUser } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const [inputValue, setInputValue] = useState("");
  const [showReactions, setShowReactions] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(
    null
  );
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // State for slow mode
  const [slowModeRemaining, setSlowModeRemaining] = useState(0);

  // Track slow mode countdown
  useEffect(() => {
    if (slowModeRemaining > 0) {
      const timer = setTimeout(() => {
        setSlowModeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [slowModeRemaining]);

  // Convex Queries & Mutations
  const { messages, isLoading: isLoadingMessages, error: chatError, refetch: refetchChat } = useChatPolling(gameId);
  const sendMessageMutation = useMutation(api.messages.send);
  const updatePresence = useMutation(api.presence.update);
  const activeUsersList = useQuery(api.presence.listByGame, { gameId }) || [];
  const chatSettings = useQuery(api.chatSettings.get, { gameId });

  const typingUsers = useMemo(() => {
    return activeUsersList
      .filter((u) => u.isTyping && u.username !== clerkUser?.username)
      .map((u) => u.username);
  }, [activeUsersList, clerkUser?.username]);

  // Presence updates
  useEffect(() => {
    if (!isSignedIn) return;

    updatePresence({ gameId });

    const interval = setInterval(() => {
      updatePresence({ gameId });
    }, 30000);

    return () => {
      clearInterval(interval);
      updatePresence({ gameId: undefined, isTyping: false });
    };
  }, [isSignedIn, gameId, updatePresence]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    if (messages && messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages?.length, scrollToBottom]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollToBottom(!isNearBottom);
  }, []);

  // Handle sending message
  const handleSend = async () => {
    if (!inputValue.trim() || !isSignedIn) return;

    const replyData = replyingTo
      ? {
          _id: replyingTo._id,
          content: replyingTo.content,
          username: replyingTo.username || replyingTo.user?.username,
        }
      : undefined;

    try {
      await sendMessageMutation({
        gameId,
        content: inputValue.trim(),
        type: "text",
        replyTo: replyData,
      });

      setInputValue("");
      setReplyingTo(null);
      updatePresence({ gameId, isTyping: false });
      inputRef.current?.focus();
      
      // Handle slow mode countdown
      if (chatSettings?.slowModeEnabled) {
        setSlowModeRemaining(chatSettings.slowModeDelay);
      }
    } catch (error: any) {
      console.error("Failed to send message:", error);
      // Handle slow mode error message
      if (error.message?.includes("Slow mode")) {
        const match = error.message.match(/Wait (\d+)s/);
        if (match) setSlowModeRemaining(parseInt(match[1]));
      }
    }
  };

  // Handle reaction
  const handleReaction = async (emoji: string) => {
    if (!isSignedIn) return;
    try {
      await sendMessageMutation({
        gameId,
        content: emoji,
        type: "reaction",
      });
      setShowReactions(false);
    } catch (error) {
      console.error("Failed to send reaction:", error);
    }
  };

  // Handle typing
  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (!isSignedIn) return;
    updatePresence({ gameId, isTyping: value.length > 0 });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark-900">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700/50 bg-dark-850">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-green" />
            <span className="text-xs text-dark-400">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-dark-400">
          <Users className="w-4 h-4" />
          <span className="text-xs font-medium">{activeUsersList.length}</span>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin"
      >
        {isLoadingMessages ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 text-dark-500 animate-spin" />
          </div>
        ) : chatError ? (
          <div className="text-center py-10 text-red-400">
            <p className="text-sm mb-2">Failed to load messages</p>
            <button
              onClick={() => refetchChat()}
              className="text-xs underline text-dark-400 hover:text-dark-200"
            >
              Retry
            </button>
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <h3 className="text-sm font-semibold text-dark-300 mb-1">
              No messages yet
            </h3>
            <p className="text-xs text-dark-500 max-w-[240px]">
              Be the first to share your thoughts about this match!
            </p>
          </div>
        ) : (
          messages.map((msg: any) => (
            <ChatMessage
              key={msg._id}
              message={{
                ...msg,
                createdAt: msg._creationTime ? new Date(msg._creationTime).toISOString() : new Date().toISOString(),
                user: {
                  _id: msg.userId,
                  username: msg.username,
                  avatar: msg.userAvatar,
                },
              }}
              isOwnMessage={clerkUser?.id === msg.userId || clerkUser?.id === msg.clerkId} // Adjusted for Convex IDs
              onClickAvatar={(uid) => setProfileModalUserId(uid)}
              onReply={(m) => {
                setReplyingTo(m);
                inputRef.current?.focus();
              }}
            />
          ))
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-dark-500 animate-fade-in">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-dark-500 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-dark-500 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-dark-500 animate-bounce [animation-delay:300ms]" />
            </div>
            <span>
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing...`
                : `${typingUsers.length} people are typing...`}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom */}
      {showScrollToBottom && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-24 right-6 w-8 h-8 rounded-full bg-dark-700 border border-dark-600 flex items-center justify-center text-dark-300 hover:text-white transition-colors shadow-lg"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Quick Reactions */}
      {showReactions && isSignedIn && (
        <div className="flex items-center gap-1 px-4 py-2 border-t border-dark-700/50 bg-dark-850 animate-slide-up">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="w-10 h-10 rounded-xl hover:bg-dark-700/50 flex items-center justify-center text-xl transition-all hover:scale-110"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-dark-700/50 bg-dark-850">
        {isSignedIn ? (
          <>
            {/* Reply preview bar */}
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-dark-800 rounded-lg border-l-2 border-primary-500 animate-fade-in">
                <Reply className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-primary-400">
                    {replyingTo.username || replyingTo.user?.username}
                  </p>
                  <p className="text-xs text-dark-400 truncate">
                    {replyingTo.content}
                  </p>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-0.5 rounded text-dark-500 hover:text-dark-300 transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowReactions(!showReactions)}
                className={`p-2 rounded-lg transition-colors ${
                  showReactions
                    ? "text-primary-400 bg-primary-600/10"
                    : "text-dark-400 hover:text-dark-200"
                }`}
              >
                <Smile className="w-5 h-5" />
              </button>
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={slowModeRemaining > 0 ? `Wait ${slowModeRemaining}s...` : "Share your thoughts..."}
                  maxLength={500}
                  disabled={slowModeRemaining > 0}
                  className="w-full bg-dark-800 border border-dark-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/25 transition-all disabled:opacity-50"
                />
                {slowModeRemaining > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary-400 tabular-nums">
                    {slowModeRemaining}s
                  </div>
                )}
              </div>
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || slowModeRemaining > 0}
                className="p-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-30 disabled:hover:bg-primary-600 transition-all disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <SignInButton mode="modal">
            <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-dark-800 border border-dark-700/50 text-dark-300 hover:text-white hover:border-primary-500/50 transition-all group">
              <Lock className="w-4 h-4 text-dark-500 group-hover:text-primary-400 transition-colors" />
              <span className="text-sm">Sign in to join the conversation</span>
            </button>
          </SignInButton>
        )}
      </div>

      {/* User Profile Modal */}
      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          isOpen={!!profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
    </div>
  );
}

// Dummy SignInButton wrapper for clarity if not using Clerk's built-in one directly
function SignInButton({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: string;
}) {
  return <div className="w-full">{children}</div>;
}

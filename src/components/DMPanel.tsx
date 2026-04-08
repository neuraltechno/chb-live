"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import {
  X,
  ChevronLeft,
  Send,
  MessageCircle,
  Loader2,
  CheckCheck,
  Edit3,
  Reply,
} from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { useDMStore } from "@/lib/store";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";

interface DMPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function Avatar({
  username,
  avatar,
  size = "md",
}: {
  username: string;
  avatar?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "sm" ? "w-7 h-7" : size === "lg" ? "w-12 h-12" : "w-9 h-9";
  const text = size === "sm" ? "text-xs" : size === "lg" ? "text-xl" : "text-sm";
  return avatar ? (
    <img
      src={avatar}
      alt={username}
      className={cn(dims, "rounded-full object-cover flex-shrink-0")}
    />
  ) : (
    <div
      className={cn(
        dims,
        "rounded-full bg-primary-600/25 flex items-center justify-center flex-shrink-0"
      )}
    >
      <span className={cn(text, "font-bold text-primary-400")}>
        {username.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function formatTimestamp(date: number): string {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

export default function DMPanel({ isOpen, onClose }: DMPanelProps) {
  const { isSignedIn, user: clerkUser } = useUser();
  const { targetDMUserId, clearTargetDMUser } = useDMStore();

  const [view, setView] = useState<"list" | "chat">("list");
  const [activeConvId, setActiveConvId] = useState<any | null>(null);
  const [input, setInput] = useState("");
  const [dmReplyingTo, setDmReplyingTo] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convex Hooks
  const conversations = useQuery(api.conversations.list) || [];
  const activeConversation = useMemo(
    () => conversations.find((c) => c._id === activeConvId),
    [conversations, activeConvId]
  );
  const messages = useQuery(
    api.dmMessages.list,
    activeConvId ? { conversationId: activeConvId } : "skip"
  );
  const sendMessageMutation = useMutation(api.dmMessages.send);
  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);
  const updatePresence = useMutation(api.presence.update);

  // ---------- Open targeted conversation ----------
  useEffect(() => {
    if (!targetDMUserId || !isSignedIn || !isOpen) return;

    const init = async () => {
      try {
        const id = await getOrCreateConversation({
          otherUserId: targetDMUserId as any,
        });
        setActiveConvId(id);
        setView("chat");
        clearTargetDMUser();
      } catch (e) {
        console.error("Failed to init conversation:", e);
      }
    };
    init();
  }, [targetDMUserId, isSignedIn, isOpen, getOrCreateConversation, clearTargetDMUser]);

  // ---------- Auto-scroll ----------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // ---------- Send message ----------
  const handleSend = async () => {
    if (!input.trim() || !activeConvId || !isSignedIn) return;

    const content = input.trim();
    setInput("");

    const replyData = dmReplyingTo
      ? {
          _id: dmReplyingTo._id,
          content: dmReplyingTo.content,
          username: dmReplyingTo.senderUsername,
        }
      : undefined;

    setDmReplyingTo(null);

    try {
      await sendMessageMutation({
        conversationId: activeConvId,
        content,
        replyTo: replyData,
      });
      updatePresence({ gameId: "dm", isTyping: false });
    } catch (e) {
      console.error("Failed to send DM:", e);
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (isSignedIn) {
      updatePresence({ gameId: "dm", isTyping: value.length > 0 });
    }
  };

  const handleBack = () => {
    setView("list");
    setActiveConvId(null);
    setDmReplyingTo(null);
  };

  const openConversation = (convId: any) => {
    setActiveConvId(convId);
    setView("chat");
  };

  // ---------- Render ----------
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[390px] z-[70] flex flex-col bg-dark-900 border-l border-dark-700/40 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* List View */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            view === "list" ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-dark-700/40">
            <h2 className="text-base font-bold text-white">Messages</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <MessageCircle className="w-9 h-9 text-dark-500 mb-5" />
                <h3 className="text-sm font-semibold text-dark-200 mb-1.5">No messages yet</h3>
                <p className="text-xs text-dark-500">Tap on a user in chat to message them.</p>
              </div>
            ) : (
              <div className="py-1">
                {conversations.map((conv) => (
                  <button
                    key={conv._id}
                    onClick={() => openConversation(conv._id)}
                    className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-dark-800/50 transition-colors text-left"
                  >
                    <Avatar username={conv.otherParticipant.username} avatar={conv.otherParticipant.avatar} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-0.5">
                        <span className="text-sm font-semibold text-white truncate">{conv.otherParticipant.username}</span>
                        <span className="text-[10px] text-dark-500">{formatTimestamp(conv.lastMessageAt)}</span>
                      </div>
                      <p className="text-xs text-dark-400 truncate">{conv.lastMessage || "Start a conversation"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat View */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] bg-dark-900",
            view === "chat" ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-700/40 bg-dark-850">
            <button onClick={handleBack} className="p-1 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            {activeConversation && (
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar username={activeConversation.otherParticipant.username} avatar={activeConversation.otherParticipant.avatar} size="sm" />
                <span className="text-sm font-bold text-white truncate">{activeConversation.otherParticipant.username}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scrollbar-thin">
            {!messages ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
              </div>
            ) : (
              messages.map((msg: any) => (
                <div key={msg._id} className={cn("flex flex-col", msg.senderId === clerkUser?.id ? "items-end" : "items-start")}>
                  <div className={cn(
                    "max-w-[85%] px-3.5 py-2 rounded-2xl text-sm",
                    msg.senderId === clerkUser?.id ? "bg-primary-600 text-white rounded-tr-none" : "bg-dark-800 text-dark-100 rounded-tl-none"
                  )}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-dark-500 mt-1 px-1">{formatTimestamp(msg._id === msg.createdAt ? msg.createdAt : Date.now())}</span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 py-4 border-t border-dark-700/40 bg-dark-850">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Message..."
                className="flex-1 bg-dark-800 border border-dark-700/40 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary-500/50"
              />
              <button onClick={handleSend} disabled={!input.trim()} className="p-2 rounded-xl bg-primary-600 text-white disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

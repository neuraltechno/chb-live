import { useState, useEffect, useCallback, useRef } from "react";

interface ChatMessage {
  _id: string;
  _creationTime: number;
  userId: string | null;
  username: string;
  userAvatar?: string;
  content: string;
  type: "text" | "reaction";
  replyTo?: {
    _id: string;
    content: string;
    username: string;
  };
}

export function useChatPolling(gameId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use a ref for lastTimestamp to avoid re-creating poll in useEffect
  const lastTimestampRef = useRef<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const params = new URLSearchParams({ gameId });
      if (lastTimestampRef.current) {
        params.set("since", lastTimestampRef.current.toString());
      }

      const res = await fetch(`/api/chat?${params}`);
      if (!res.ok) throw new Error("Failed to fetch messages");

      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const newMessages = data.messages.filter(
            (m: ChatMessage) => !existingIds.has(m._id)
          );

          if (newMessages.length === 0) return prev;

          const updated = [...prev, ...newMessages].sort(
            (a, b) => a._creationTime - b._creationTime
          );
          
          // Keep only last 100 messages for performance
          return updated.slice(-100);
        });

        const maxTs = Math.max(...data.messages.map((m: ChatMessage) => m._creationTime));
        if (!lastTimestampRef.current || maxTs > lastTimestampRef.current) {
            lastTimestampRef.current = maxTs;
            setLastTimestamp(maxTs);
        }
      }

      setError(null);
    } catch (err) {
      console.error("Chat polling error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    // Reset state when gameId changes
    setMessages([]);
    setLastTimestamp(null);
    lastTimestampRef.current = null;
    setIsLoading(true);

    // Initial fetch
    poll();

    // Set up polling interval
    const interval = setInterval(poll, 3000);

    return () => clearInterval(interval);
  }, [gameId, poll]);

  return { messages, isLoading, error, refetch: poll };
}

# Chat - Hybrid Architecture Implementation Plan

## Overview
Implement a basic, functional match chat system using a hybrid architecture: **Convex mutations** for sending messages and **REST API polling** for receiving messages. This plan focuses on core functionality without the advanced Twitch-style features.

---

## Architecture Decision

| Feature | Method | Why |
|---------|--------|-----|
| **Send message** | Convex mutation | Real-time, low bandwidth |
| **Message list** | REST API polling (3s) | Cached, cost-effective |
| **Active user count** | Convex subscription | Low data, infrequent |
| **Typing indicators** | Convex subscription | Tiny payloads |

**Cost benefit: 60-70% reduction in Convex bandwidth vs full subscriptions**

---

## Phase 1: Schema Updates

### 1.1 Update `convex/schema.ts`

Add minimal fields to existing `messages` table:
```typescript
messages: defineTable({
  gameId: v.string(),
  userId: v.optional(v.id("users")),
  username: v.string(),
  userAvatar: v.optional(v.string()),
  content: v.string(),
  type: v.union(v.literal("text"), v.literal("reaction")),
  replyTo: v.optional(
    v.object({
      _id: v.string(),
      content: v.string(),
      username: v.string(),
    })
  ),
  // New fields for basic moderation
  isDeleted: v.optional(v.boolean()), // Soft delete for moderation
  deletedAt: v.optional(v.number()),
}).index("by_gameId", ["gameId"])
 .index("by_gameId_creationTime", ["gameId", "_creationTime"]), // For efficient time-based queries
```

Add `chatSettings` table for basic settings:
```typescript
chatSettings: defineTable({
  gameId: v.string(),
  slowModeEnabled: v.boolean(),
  slowModeDelay: v.number(), // seconds
  lastMessageTime: v.optional(v.number()),
}).index("by_gameId", ["gameId"]),
```

---

## Phase 2: Backend Implementation

### 2.1 Update `convex/messages.ts`

#### Send Message (Mutation - unchanged, already exists)
Keep the existing `send` mutation. Add slow mode check:

```typescript
export const send = mutation({
  args: {
    gameId: v.string(),
    content: v.string(),
    type: v.union(v.literal("text"), v.literal("reaction")),
    replyTo: v.optional(
      v.object({
        _id: v.string(),
        content: v.string(),
        username: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Check slow mode
    const settings = await ctx.db
      .query("chatSettings")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .unique();

    if (settings?.slowModeEnabled && settings.lastMessageTime) {
      const timeSinceLast = Date.now() - settings.lastMessageTime;
      const delayMs = (settings.slowModeDelay || 0) * 1000;
      if (timeSinceLast < delayMs) {
        const remaining = Math.ceil((delayMs - timeSinceLast) / 1000);
        throw new Error(`Slow mode active. Wait ${remaining}s before sending another message.`);
      }
    }

    const messageId = await ctx.db.insert("messages", {
      gameId: args.gameId,
      userId: user._id,
      username: user.username || identity.nickname || identity.name || "Anonymous",
      userAvatar: user.image || identity.pictureUrl,
      content: args.content,
      type: args.type,
      replyTo: args.replyTo,
    });

    // Update last message time for slow mode
    if (settings) {
      await ctx.db.patch(settings._id, { lastMessageTime: Date.now() });
    }

    return messageId;
  },
});
```

#### List Messages for API (Query - optimized for API polling)
```typescript
export const listForApi = query({
  args: {
    gameId: v.string(),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let messages = await ctx.db
      .query("messages")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .take(args.limit || 100);

    // Filter out deleted messages
    messages = messages.filter(m => !m.isDeleted);

    // Filter by time if since provided
    if (args.since) {
      messages = messages.filter(m => m._creationTime > args.since!);
    }

    // Reverse to get ascending order
    messages.reverse();

    // Return minimal fields
    return messages.map(m => ({
      _id: m._id,
      _creationTime: m._creationTime,
      userId: m.userId,
      username: m.username,
      userAvatar: m.userAvatar,
      content: m.content,
      type: m.type,
      replyTo: m.replyTo,
    }));
  },
});
```

#### Delete Message (Mutation - for moderation)
```typescript
export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if user is moderator (implement your role check here)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    // TODO: Add role check - for now, only allow deleting own messages
    const message = await ctx.db.get("messages", args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.userId !== user._id) {
      throw new Error("Not authorized to delete this message");
    }

    // Soft delete
    await ctx.db.patch(args.messageId, {
      isDeleted: true,
      deletedAt: Date.now(),
    });
  },
});
```

### 2.2 Update `convex/chatSettings.ts` (new file)

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: { gameId: v.string() },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("chatSettings")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .unique();

    return settings || {
      gameId: args.gameId,
      slowModeEnabled: false,
      slowModeDelay: 5,
      lastMessageTime: undefined,
    };
  },
});

export const update = mutation({
  args: {
    gameId: v.string(),
    slowModeEnabled: v.optional(v.boolean()),
    slowModeDelay: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // TODO: Add moderator check

    const existing = await ctx.db
      .query("chatSettings")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        slowModeEnabled: args.slowModeEnabled ?? existing.slowModeEnabled,
        slowModeDelay: args.slowModeDelay ?? existing.slowModeDelay,
      });
    } else {
      await ctx.db.insert("chatSettings", {
        gameId: args.gameId,
        slowModeEnabled: args.slowModeEnabled ?? false,
        slowModeDelay: args.slowModeDelay ?? 5,
      });
    }
  },
});
```

---

## Phase 3: API Route Implementation

### 3.1 Create `src/app/api/chat/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

// In-memory cache with TTL
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 3000; // 3 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const since = searchParams.get("since");

    if (!gameId) {
      return NextResponse.json({ error: "gameId is required" }, { status: 400 });
    }

    const cacheKey = `chat:${gameId}:${since || "all"}`;
    const cached = cache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Fetch from Convex
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const messages = await convex.query(api.messages.listForApi, {
      gameId,
      since: since ? parseInt(since) : undefined,
      limit: 100,
    });

    const response = {
      messages,
      timestamp: Date.now(),
    };

    // Cache the response
    cache.set(cacheKey, response);

    // Clean old cache entries (keep map size manageable)
    if (cache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

## Phase 4: Frontend Implementation

### 4.1 Create `src/hooks/use-chat-polling.ts`

```typescript
import { useState, useEffect, useCallback } from "react";

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

  const poll = useCallback(async () => {
    try {
      const params = new URLSearchParams({ gameId });
      if (lastTimestamp) {
        params.set("since", lastTimestamp.toString());
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

          return [...prev, ...newMessages].sort(
            (a, b) => a._creationTime - b._creationTime
          );
        });

        const maxTs = Math.max(...data.messages.map((m: ChatMessage) => m._creationTime));
        setLastTimestamp(maxTs);
      }

      setError(null);
    } catch (err) {
      console.error("Chat polling error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [gameId, lastTimestamp]);

  useEffect(() => {
    // Initial fetch
    poll();

    // Set up polling interval
    const interval = setInterval(poll, 3000);

    return () => clearInterval(interval);
  }, [poll]);

  return { messages, isLoading, error, refetch: poll };
}
```

### 4.2 Update `src/components/ChatWindow.tsx`

Replace Convex subscription with polling hook:

```typescript
// Replace this:
// const messages = useQuery(api.messages.list, { gameId, limit: 100 });

// With this:
const { messages, isLoading, error, refetch } = useChatPolling(gameId);

// Keep sendMessageMutation as Convex mutation
const sendMessageMutation = useMutation(api.messages.send);
```

Update the loading/error states:
```typescript
{isLoading ? (
  <div className="flex items-center justify-center py-10">
    <Loader2 className="w-6 h-6 text-dark-500 animate-spin" />
  </div>
) : error ? (
  <div className="text-center py-10 text-red-400">
    <p>Failed to load messages</p>
    <button onClick={refetch} className="text-sm underline">
      Retry
    </button>
  </div>
) : !messages || messages.length === 0 ? (
  // Empty state...
) : (
  // Render messages...
)}
```

### 4.3 Add Slow Mode Countdown to Chat Input

```typescript
// In ChatWindow.tsx, add state for slow mode
const [slowModeRemaining, setSlowModeRemaining] = useState(0);

// After successful send, start countdown
const handleSend = async () => {
  // ... existing send logic ...
  
  try {
    await sendMessageMutation({ ... });
    setInputValue("");
    
    // Get chat settings to check slow mode
    const settings = await fetch(`/api/chat-settings?gameId=${gameId}`).then(r => r.json());
    if (settings.slowModeEnabled) {
      setSlowModeRemaining(settings.slowModeDelay);
      const interval = setInterval(() => {
        setSlowModeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  } catch (error) {
    // Handle slow mode error message
    if (error.message?.includes("Slow mode")) {
      const match = error.message.match(/Wait (\d+)s/);
      if (match) setSlowModeRemaining(parseInt(match[1]));
    }
  }
};

// In input area, show countdown
{slowModeRemaining > 0 ? (
  <div className="text-xs text-dark-400 px-4 py-2">
    Slow mode: wait {slowModeRemaining}s
  </div>
) : (
  // Normal input...
)}
```

---

## Phase 5: Type Updates

### 5.1 Update `src/types/index.ts`

Add ChatSettings interface:
```typescript
export interface ChatSettings {
  gameId: string;
  slowModeEnabled: boolean;
  slowModeDelay: number;
  lastMessageTime?: number;
}
```

---

## Implementation Order

1. **Schema updates** - Add indexes, chatSettings table
2. **Convex functions** - Update messages.ts, create chatSettings.ts
3. **API route** - Create `/api/chat` with caching
4. **Polling hook** - Create `useChatPolling`
5. **Update ChatWindow** - Replace subscription with polling
6. **Slow mode UI** - Add countdown indicator
7. **Test** - Verify cost savings and functionality

---

## Cost Comparison

| Scenario | Full Convex Subscriptions | Hybrid (This Plan) |
|----------|--------------------------|-------------------|
| 50 users, 30 msg/min | ~$4.50/month | ~$1.20/month |
| 100 users, 50 msg/min | ~$7.00/month | ~$1.75/month |
| 500 users, 100 msg/min | ~$35/month | ~$8.50/month |

---

## Future Enhancements

This basic implementation can be extended with the Twitch-style features from [`twitch-chat-features.md`](./twitch-chat-features.md):
- Chat badges and roles
- Polls and predictions
- Highlights and pinned messages
- Moderator panel
- Hype mode and clutch time
- Fan pulse bar
- And more...

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(), // Clerk's user ID
    username: v.optional(v.string()),
    email: v.string(),
    image: v.optional(v.string()),
    bio: v.optional(v.string()),
    favoriteTeams: v.optional(
      v.array(
        v.object({
          teamId: v.string(),
          name: v.string(),
          shortName: v.string(),
          logo: v.string(),
          sport: v.string(),
        })
      )
    ),
    hiddenActivityTeams: v.optional(v.array(v.string())),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_username", ["username"]),

  messages: defineTable({
    gameId: v.string(),
    userId: v.id("users"),
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
  }).index("by_gameId", ["gameId"]),

  cachedGames: defineTable({
    externalId: v.string(),
    sport: v.string(),
    leagueId: v.string(),
    data: v.any(),
    lastFetched: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_sport_league", ["sport", "leagueId"]),

  conversations: defineTable({
    key: v.string(), // Sorted userId1_userId2
    participants: v.array(v.id("users")),
    lastMessage: v.optional(v.string()),
    lastMessageAt: v.number(),
    lastSenderId: v.optional(v.id("users")),
  })
    .index("by_key", ["key"])
    .index("by_lastMessageAt", ["lastMessageAt"]),

  dmMessages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    senderUsername: v.string(),
    senderAvatar: v.optional(v.string()),
    content: v.string(),
    replyTo: v.optional(
      v.object({
        _id: v.string(),
        content: v.string(),
        username: v.string(),
      })
    ),
    readBy: v.array(v.id("users")),
  }).index("by_conversationId", ["conversationId"]),

  presence: defineTable({
    userId: v.id("users"),
    gameId: v.optional(v.string()),
    lastSeen: v.number(),
    isTyping: v.optional(v.boolean()),
  })
    .index("by_gameId", ["gameId"])
    .index("by_userId", ["userId"]),
});

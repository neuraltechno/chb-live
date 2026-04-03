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
  }).index("by_gameId", ["gameId"]),

  cachedGames: defineTable({
    externalId: v.string(),
    sport: v.string(),
    leagueId: v.string(),
    startTime: v.number(), // UTC timestamp
    roundNumber: v.optional(v.number()),
    roundName: v.optional(v.string()),
    statusDisplay: v.optional(v.string()),
    displayClock: v.optional(v.string()),
    period: v.optional(v.number()),
    data: v.any(),
    lastFetched: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_sport_league", ["sport", "leagueId"])
    .index("by_round", ["roundNumber"])
    .index("by_startTime", ["startTime"]),

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
    username: v.optional(v.string()),
    avatar: v.optional(v.string()),
    gameId: v.optional(v.string()),
    lastSeen: v.number(),
    isTyping: v.optional(v.boolean()),
  })
    .index("by_gameId", ["gameId", "lastSeen"])
    .index("by_userId", ["userId"]),

  cachedStats: defineTable({
    externalId: v.string(),
    stats: v.any(),
    lastFetched: v.number(),
  }).index("by_externalId", ["externalId"]),

  cachedPlayerStats: defineTable({
    externalId: v.string(),
    stats: v.any(),
    lastFetched: v.number(),
  }).index("by_externalId", ["externalId"]),

  supercoachScores: defineTable({
    playerId: v.string(), // Normalized player name or ID
    playerName: v.string(), // Display name
    playerImage: v.optional(v.string()),
    externalMatchId: v.string(), // ESPN match ID (e.g. "401646704")
    gameId: v.optional(v.string()), // Convex internal ID (e.g. "afl_401646704")
    score: v.number(), // Latest/Final Supercoach score
    round: v.optional(v.number()), // Round number
    roundName: v.optional(v.string()),
    teamId: v.string(), // Player's team ID
    teamName: v.string(), // Player's team name
    opponentId: v.optional(v.string()),
    opponentName: v.optional(v.string()),
    timestamp: v.number(), // Last updated timestamp
  })
    .index("by_match_player", ["externalMatchId", "playerId"])
    .index("by_match_score", ["externalMatchId", "score"]) // For Match Top 10
    .index("by_score", ["score"]) // For global Top 10
    .index("by_team_score", ["teamId", "score"]) // For Team Top 10
    .index("by_round_score", ["round", "score"]) // For Round Top 10
    .index("by_player", ["playerId", "timestamp"]), // For Player history
});

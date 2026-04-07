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
    // For now, allow anyone authenticated to update (for testing/MVP)
    // In production, this should be restricted to admins/moderators

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

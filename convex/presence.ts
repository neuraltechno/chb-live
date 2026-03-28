import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const update = mutation({
  args: {
    gameId: v.optional(v.string()),
    isTyping: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return;

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        gameId: args.gameId,
        isTyping: args.isTyping,
        lastSeen: Date.now(),
      });
    } else {
      await ctx.db.insert("presence", {
        userId: user._id,
        gameId: args.gameId,
        isTyping: args.isTyping,
        lastSeen: Date.now(),
      });
    }
  },
});

export const listByGame = query({
  args: { gameId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 30000; // 30 seconds ago
    const active = await ctx.db
      .query("presence")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.gt(q.field("lastSeen"), cutoff))
      .collect();

    return await Promise.all(
      active.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          username: user?.username || "Anonymous",
          avatar: user?.image,
          isTyping: p.isTyping,
        };
      })
    );
  },
});

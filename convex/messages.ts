import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

    const messageId = await ctx.db.insert("messages", {
      gameId: args.gameId,
      userId: user._id,
      username: user.username || identity.nickname || identity.name || "Anonymous",
      userAvatar: user.image || identity.pictureUrl,
      content: args.content,
      type: args.type,
      replyTo: args.replyTo,
    });

    return messageId;
  },
});

export const list = query({
  args: {
    gameId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .take(args.limit || 50);

    return messages.reverse();
  },
});

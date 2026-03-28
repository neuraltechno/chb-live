import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getOrCreate = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) throw new Error("User not found");

    const key = [me._id, args.otherUserId].sort().join("_");

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("conversations", {
      key,
      participants: [me._id, args.otherUserId],
      lastMessageAt: Date.now(),
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) return [];

    const convos = await ctx.db
      .query("conversations")
      .collect();

    const myConvos = convos.filter(c => c.participants.includes(me._id));
    
    // Fetch other participants
    return await Promise.all(
      myConvos.map(async (c) => {
        const otherId = c.participants.find((p) => p !== me._id)!;
        const other = await ctx.db.get(otherId);
        return {
          ...c,
          otherParticipant: {
            _id: other!._id,
            username: other!.username || "Unknown",
            avatar: other!.image,
          },
        };
      })
    );
  },
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
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
    if (!identity) throw new Error("Not authenticated");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) throw new Error("User not found");

    const messageId = await ctx.db.insert("dmMessages", {
      conversationId: args.conversationId,
      senderId: me._id,
      senderUsername: me.username || identity.name || "Anonymous",
      senderAvatar: me.image || identity.pictureUrl,
      content: args.content,
      replyTo: args.replyTo,
      readBy: [me._id],
    });

    await ctx.db.patch(args.conversationId, {
      lastMessage: args.content,
      lastMessageAt: Date.now(),
      lastSenderId: me._id,
    });

    return messageId;
  },
});

export const list = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("dmMessages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(args.limit || 50);

    return messages.reverse();
  },
});

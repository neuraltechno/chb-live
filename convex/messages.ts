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

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      // Auto-create user if missing (Clerk-synced user)
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        username: identity.nickname || identity.name || "Anonymous",
        email: identity.email!,
        image: identity.pictureUrl,
      });
      user = await ctx.db.get(userId);
    }

    if (!user) {
      throw new Error("User not found and could not be created");
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

    const filtered = messages.filter(m => !m.isDeleted).reverse();

    // Fetch user details for each message to get roles/badges
    const messagesWithUsers = await Promise.all(
      filtered.map(async (m) => {
        if (!m.userId) return { ...m, userRole: "user", userBadges: [] };
        const user = await ctx.db.get(m.userId);
        
        let roleToUse = "user";
        if (user) {
          const u = user as any;
          if (Array.isArray(u.roles)) {
            if (u.roles.includes("admin")) roleToUse = "admin";
            else if (u.roles.includes("moderator")) roleToUse = "moderator";
            else if (u.roles.includes("winner")) roleToUse = "winner";
          } 
          if (roleToUse === "user" && typeof u.role === "string") {
            const r = u.role.toLowerCase();
            if (["admin", "moderator", "winner"].includes(r)) roleToUse = r;
          }
          if (roleToUse === "user" && typeof u.roles === "string") {
            const r = u.roles.toLowerCase();
            if (["admin", "moderator", "winner"].includes(r)) roleToUse = r;
          }
        }
        
        return {
          ...m,
          userRole: roleToUse,
          userBadges: user?.badges || [],
        };
      })
    );

    return messagesWithUsers;
  },
});

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

    // Fetch user details for each message
    const messagesWithUsers = await Promise.all(
      messages.map(async (m) => {
        let userRole = "user";
        let userBadges: string[] = [];
        if (m.userId) {
          const user = await ctx.db.get(m.userId);
          
          if (user) {
            const u = user as any;
            if (Array.isArray(u.roles)) {
              if (u.roles.includes("admin")) userRole = "admin";
              else if (u.roles.includes("moderator")) userRole = "moderator";
              else if (u.roles.includes("winner")) userRole = "winner";
            } else if (typeof u.role === "string") {
              const r = u.role.toLowerCase();
              if (["admin", "moderator", "winner"].includes(r)) userRole = r;
            } else if (typeof u.roles === "string") {
              const r = u.roles.toLowerCase();
              if (["admin", "moderator", "winner"].includes(r)) userRole = r;
            }
            userBadges = u.badges || [];
          }
        }
        return {
          _id: m._id,
          _creationTime: m._creationTime,
          userId: m.userId,
          username: m.username,
          userAvatar: m.userAvatar,
          content: m.content,
          type: m.type,
          replyTo: m.replyTo,
          userRole,
          userBadges,
        };
      })
    );

    return messagesWithUsers;
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    
    const message = await ctx.db.get("messages", args.messageId);
    if (!message) throw new Error("Message not found");
    
    // For now, only allow deleting own messages
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

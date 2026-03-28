import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Check if we've already stored this user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (user !== null) {
      // If we've seen this user before but their name or picture has changed, patch them.
      if (user.username !== identity.nickname && identity.nickname !== undefined) {
        await ctx.db.patch(user._id, { username: identity.nickname });
      }
      if (user.image !== identity.pictureUrl && identity.pictureUrl !== undefined) {
        await ctx.db.patch(user._id, { image: identity.pictureUrl });
      }
      return user._id;
    }

    // If it's a new identity, create a new User.
    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email!,
      username: identity.nickname || identity.name,
      image: identity.pictureUrl,
    });
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});

export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const updateProfile = mutation({
  args: {
    username: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const updates: any = {};
    if (args.username !== undefined) updates.username = args.username;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.favoriteTeams !== undefined) updates.favoriteTeams = args.favoriteTeams;
    if (args.hiddenActivityTeams !== undefined)
      updates.hiddenActivityTeams = args.hiddenActivityTeams;

    await ctx.db.patch(user._id, updates);
  },
});

export const getTeamActivity = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();

    const gameCountMap: Record<string, number> = {};
    for (const msg of messages) {
      gameCountMap[msg.gameId] = (gameCountMap[msg.gameId] || 0) + 1;
    }

    const gameIds = Object.keys(gameCountMap);
    if (gameIds.length === 0) return [];

    const games = await Promise.all(
      gameIds.map(async (gid) => {
        return await ctx.db
          .query("cachedGames")
          .withIndex("by_externalId", (q) => q.eq("externalId", gid.split("_").pop()!))
          .unique();
      })
    );

    const teamCounts: Record<string, { count: number; logo: string }> = {};

    for (const gameEntry of games) {
      if (!gameEntry) continue;
      const game = gameEntry.data;
      const msgCount = gameCountMap[game.id];

      const homeName = game.homeTeam?.name;
      const awayName = game.awayTeam?.name;
      const homeLogo = game.homeTeam?.logo || "";
      const awayLogo = game.awayTeam?.logo || "";

      if (homeName) {
        if (!teamCounts[homeName])
          teamCounts[homeName] = { count: 0, logo: homeLogo };
        teamCounts[homeName].count += msgCount;
      }
      if (awayName) {
        if (!teamCounts[awayName])
          teamCounts[awayName] = { count: 0, logo: awayLogo };
        teamCounts[awayName].count += msgCount;
      }
    }

    return Object.entries(teamCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([teamName, data]) => ({
        teamName,
        teamLogo: data.logo,
        count: data.count,
      }));
  },
});

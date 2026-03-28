import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const syncGames = internalMutation({
  args: {
    games: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const gameData of args.games) {
      const existing = await ctx.db
        .query("cachedGames")
        .withIndex("by_externalId", (q) => q.eq("externalId", gameData.externalId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          data: gameData,
          lastFetched: now,
          sport: gameData.sport,
          leagueId: gameData.league.id,
        });
      } else {
        await ctx.db.insert("cachedGames", {
          externalId: gameData.externalId,
          sport: gameData.sport,
          leagueId: gameData.league.id,
          data: gameData,
          lastFetched: now,
        });
      }
    }

    // Cleanup: Remove any games that are not AFL (since we only want AFL for now)
    const nonAflGames = await ctx.db
      .query("cachedGames")
      .filter((q) => q.neq(q.field("sport"), "afl"))
      .collect();

    for (const game of nonAflGames) {
      await ctx.db.delete(game._id);
    }
  },
});

export const list = query({
  args: {
    leagues: v.optional(v.array(v.string())),
    sport: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let games = await ctx.db.query("cachedGames").collect();

    if (args.leagues && args.leagues.length > 0) {
      games = games.filter((g) => args.leagues!.includes(g.leagueId));
    }

    if (args.sport && args.sport !== "all") {
      games = games.filter((g) => g.sport === args.sport);
    }

    // Sort by status and time (similar to original logic)
    return games
      .map((g) => g.data)
      .sort((a, b) => {
        const statusOrder: Record<string, number> = {
          live: 0,
          halftime: 1,
          scheduled: 2,
          finished: 3,
          postponed: 4,
          cancelled: 5,
        };

        const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        if (statusDiff !== 0) return statusDiff;

        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
  },
});

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("cachedGames")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.id.split("_").pop()!))
      .unique();
    return game?.data || null;
  },
});

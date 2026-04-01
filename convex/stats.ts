import { v } from "convex/values";
import { internalMutation, internalQuery, query, internalAction } from "./_generated/server";
import { api } from "./_generated/api";

export const getCachedStats = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    return await ctx.db
      .query("cachedStats")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
  },
});

export const getCachedPlayerStats = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    return await ctx.db
      .query("cachedPlayerStats")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
  },
});

export const getPlayerStats = query({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const record = await ctx.db
      .query("cachedPlayerStats")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    return record?.stats || null;
  },
});

export const saveStatsAndDetectChanges = internalMutation({
  args: {
    externalId: v.string(),
    stats: v.any(),
    gameId: v.optional(v.string()),
  },
  handler: async (ctx, { externalId, stats, gameId }) => {
    const existing = await ctx.db
      .query("cachedStats")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();

    if (existing && gameId) {
      const oldStats = existing.stats;

      // --- Change Detection Logic ---
      const detectors = [
        { key: "goals", label: "Goal", icon: "⚽" },
        { key: "touchdowns", label: "Touchdown", icon: "🏈" },
        { key: "fieldGoalsMade", label: "Field Goal", icon: "🏀" },
        { key: "behinds", label: "Behind", icon: "🏉" },
      ];

      for (const { key, label, icon } of detectors) {
        const oldHome = parseInt(oldStats.home?.[key] || "0");
        const newHome = parseInt(stats.home?.[key] || "0");
        const oldAway = parseInt(oldStats.away?.[key] || "0");
        const newAway = parseInt(stats.away?.[key] || "0");

        if (newHome > oldHome) {
          await ctx.db.insert("messages", {
            gameId,
            content: `${icon} ${label}! The home team just scored!`,
            username: "MatchBot",
            type: "text",
          });
        }
        if (newAway > oldAway) {
          await ctx.db.insert("messages", {
            gameId,
            content: `${icon} ${label}! The away team just scored!`,
            username: "MatchBot",
            type: "text",
          });
        }
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        stats,
        lastFetched: Date.now(),
      });
    } else {
      await ctx.db.insert("cachedStats", {
        externalId,
        stats,
        lastFetched: Date.now(),
      });
    }
  },
});

export const upsertSupercoachScores = internalMutation({
  args: {
    scores: v.array(
      v.object({
        playerId: v.string(),
        playerName: v.string(),
        playerImage: v.optional(v.string()),
        externalMatchId: v.string(),
        gameId: v.optional(v.string()),
        score: v.number(),
        round: v.optional(v.number()),
        roundName: v.optional(v.string()),
        teamId: v.string(),
        teamName: v.string(),
        opponentId: v.optional(v.string()),
        opponentName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { scores }) => {
    const timestamp = Date.now();
    for (const score of scores) {
      const existing = await ctx.db
        .query("supercoachScores")
        .withIndex("by_match_player", (q) =>
          q.eq("externalMatchId", score.externalMatchId).eq("playerId", score.playerId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...score,
          timestamp,
        });
      } else {
        await ctx.db.insert("supercoachScores", {
          ...score,
          timestamp,
        });
      }
    }
  },
});

export const getTopSupercoachScores = query({
  args: {
    round: v.optional(v.number()),
    teamId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("supercoachScores");
    const limit = args.limit || 10;

    if (args.teamId) {
      return await q
        .withIndex("by_team_score", (indexedQ) => indexedQ.eq("teamId", args.teamId!))
        .order("desc")
        .take(limit);
    }

    if (args.round !== undefined) {
      return await q
        .withIndex("by_round_score", (indexedQ) => indexedQ.eq("round", args.round!))
        .order("desc")
        .take(limit);
    }

    return await q.withIndex("by_score").order("desc").take(limit);
  },
});

/**
 * Backfill function to populate supercoachScores for past games.
 * This can be run manually from the Convex dashboard.
 */
export const backfillSupercoachScores = internalAction({
  args: {
    roundNumber: v.optional(v.number()), // If provided, only backfill this round
    limit: v.optional(v.number()),       // Limit number of games to process
  },
  handler: async (ctx, args) => {
    // 1. Get all finished AFL games
    const games = (await ctx.runQuery(api.games.list, { 
      sport: "afl",
      round: args.roundNumber 
    })) as any[];

    const finishedGames = games.filter(g => g.status === "finished").slice(0, args.limit || 999);
    console.log(`[Backfill] Starting backfill for ${finishedGames.length} finished AFL games`);

    let processedCount = 0;
    for (const game of finishedGames) {
      console.log(`[Backfill] Processing game: ${game.homeTeam.name} vs ${game.awayTeam.name} (${game.id})`);
      
      // We call fetchGameStats which now has the logic to upsert SC scores
      try {
        await ctx.runAction(api.sportsApi.fetchGameStats, {
          externalId: game.externalId,
          leagueId: "afl",
          gameId: game.id,
        });
        processedCount++;
        // Small delay to avoid hitting rate limits if any
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.error(`[Backfill] Error processing game ${game.id}:`, e);
      }
    }

    return { processed: processedCount, totalFound: finishedGames.length };
  },
});

export const savePlayerStats = internalMutation({
  args: {
    externalId: v.string(),
    stats: v.any(),
  },
  handler: async (ctx, { externalId, stats }) => {
    const existing = await ctx.db
      .query("cachedPlayerStats")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stats,
        lastFetched: Date.now(),
      });
    } else {
      await ctx.db.insert("cachedPlayerStats", {
        externalId,
        stats,
        lastFetched: Date.now(),
      });
    }
  },
});

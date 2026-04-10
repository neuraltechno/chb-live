import { v } from "convex/values";
import { internalMutation, internalQuery, query, internalAction, MutationContext } from "./_generated/server";
import { api, internal } from "./_generated/api";

const MOMENTUM_THRESHOLD = 3;
const VELOCITY_THRESHOLD = 15;
const SNAPSHOT_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function detectMomentum(
  ctx: MutationContext,
  gameId: string,
  externalId: string,
  scoringPlays: any[]
) {
  if (!scoringPlays || scoringPlays.length === 0) return;

  const momentum = await ctx.db
    .query("gameMomentum")
    .withIndex("by_gameId", (q) => q.eq("gameId", externalId))
    .unique();

  const lastPlay = scoringPlays[scoringPlays.length - 1];
  const lastTeamId = lastPlay.team?.id;
  if (!lastTeamId) return;

  let consecutiveScores = 1;
  let recentAlerts = momentum?.recentAlerts || [];

  if (momentum && momentum.lastScoringTeamId === lastTeamId) {
    consecutiveScores = momentum.consecutiveScores + 1;
  }

  // Trigger alert if threshold met and not already alerted for this streak
  const alertKey = `momentum_${lastTeamId}_${consecutiveScores}`;
  if (consecutiveScores >= MOMENTUM_THRESHOLD && !recentAlerts.includes(alertKey)) {
    const teamName = lastPlay.team?.displayName || "The team";
    await ctx.db.insert("messages", {
      gameId,
      content: `🔥 Momentum Alert: ${teamName} has scored the last ${consecutiveScores} times!`,
      username: "MatchBot",
      type: "text",
    });
    recentAlerts.push(alertKey);
    // Keep alerts array manageable
    if (recentAlerts.length > 10) recentAlerts.shift();
  }

  if (momentum) {
    await ctx.db.patch(momentum._id, {
      lastScoringTeamId: lastTeamId,
      consecutiveScores,
      recentAlerts,
    });
  } else {
    await ctx.db.insert("gameMomentum", {
      gameId: externalId,
      lastScoringTeamId: lastTeamId,
      consecutiveScores,
      recentAlerts,
    });
  }
}

async function detectVelocity(
  ctx: MutationContext,
  gameId: string,
  externalId: string,
  currentScores: any[]
) {
  const fiveMinsAgo = Date.now() - SNAPSHOT_INTERVAL;
  const snapshot = await ctx.db
    .query("statSnapshots")
    .withIndex("by_gameId_timestamp", (q) =>
      q.eq("gameId", externalId).gte("timestamp", fiveMinsAgo)
    )
    .order("asc")
    .first();

  if (!snapshot) return;

  const momentum = await ctx.db
    .query("gameMomentum")
    .withIndex("by_gameId", (q) => q.eq("gameId", externalId))
    .unique();

  let recentAlerts = momentum?.recentAlerts || [];
  let alerted = false;

  for (const player of currentScores) {
    const oldPlayer = snapshot.topPerformers.find((p) => p.pId === player.playerId);
    if (oldPlayer) {
      const diff = player.score - oldPlayer.sc;
      const alertKey = `velocity_${player.playerId}_${Math.floor(player.score / 10)}`;
      
      if (diff >= VELOCITY_THRESHOLD && !recentAlerts.includes(alertKey)) {
        await ctx.db.insert("messages", {
          gameId,
          content: `⚡ Performance Alert: ${player.playerName} has scored ${diff} SuperCoach points in the last 5 minutes!`,
          username: "MatchBot",
          type: "text",
        });
        recentAlerts.push(alertKey);
        alerted = true;
      }
    }
  }

  if (alerted) {
    if (momentum) {
      await ctx.db.patch(momentum._id, { recentAlerts });
    } else {
      await ctx.db.insert("gameMomentum", {
        gameId: externalId,
        consecutiveScores: 0,
        recentAlerts,
      });
    }
  }
}

async function createSnapshot(
  ctx: MutationContext,
  externalId: string,
  currentScores: any[],
  stats: any
) {
  const lastSnapshot = await ctx.db
    .query("statSnapshots")
    .withIndex("by_gameId", (q) => q.eq("gameId", externalId))
    .order("desc")
    .first();

  if (!lastSnapshot || Date.now() - lastSnapshot.timestamp >= SNAPSHOT_INTERVAL) {
    const topPerformers = currentScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((p) => ({ pId: p.playerId, sc: p.score }));

    const teamScores = [
      { teamId: "home", score: parseInt(stats.home?.score || "0") },
      { teamId: "away", score: parseInt(stats.away?.score || "0") },
    ];

    await ctx.db.insert("statSnapshots", {
      gameId: externalId,
      timestamp: Date.now(),
      topPerformers,
      teamScores,
    });
  }
}

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
    // 1. Get boxscore/stats from cachedStats
    const statsRecord = await ctx.db
      .query("cachedStats")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    
    // 2. Get athletes/players from cachedPlayerStats (this is where the players array lives)
    const playerStatsRecord = await ctx.db
      .query("cachedPlayerStats")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();

    return {
      stats: playerStatsRecord?.stats || null, // The players array
      scoringPlays: statsRecord?.scoringPlays || [],
      matchStats: statsRecord?.stats || null // Home/Away team stats
    };
  },
});

export const saveStatsAndDetectChanges = internalMutation({
  args: {
    externalId: v.string(),
    stats: v.any(),
    gameId: v.optional(v.string()),
    scoringPlays: v.optional(v.array(v.any())),
  },
  handler: async (ctx, { externalId, stats, gameId, scoringPlays }) => {
    const existing = await ctx.db
      .query("cachedStats")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();

    if (gameId) {
      // 1. Get current top scores for velocity detection
      const currentScores = await ctx.db
        .query("supercoachScores")
        .withIndex("by_match_score", (q) => q.eq("externalMatchId", externalId))
        .order("desc")
        .take(20);

      // 2. Detect Momentum (Scoring streaks)
      if (scoringPlays) {
        await detectMomentum(ctx, gameId, externalId, scoringPlays);
      }

      // 3. Detect Velocity (Rapid SC gain)
      if (currentScores.length > 0) {
        await detectVelocity(ctx, gameId, externalId, currentScores);
      }

      // 4. Create periodic snapshot
      await createSnapshot(ctx, externalId, currentScores, stats);
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        stats,
        lastFetched: Date.now(),
        scoringPlays: scoringPlays || existing.scoringPlays,
      });
    } else {
      await ctx.db.insert("cachedStats", {
        externalId,
        stats,
        lastFetched: Date.now(),
        scoringPlays,
      });
    }

    // Update game root statusDisplay if present in stats
    if (gameId && (stats.statusDisplay || stats.displayClock || stats.period !== undefined || stats.statusDescription || scoringPlays)) {
      const gameRecord = await ctx.db
        .query("cachedGames")
        .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
        .unique();
      if (gameRecord) {
        const patch: any = {
          statusDisplay: stats.statusDisplay,
          displayClock: stats.displayClock,
          period: stats.period,
          statusDescription: stats.statusDescription,
        };
        
        // Ensure data exists and update it
        patch.data = { 
          ...(gameRecord.data || {}), 
          statusDisplay: stats.statusDisplay,
          displayClock: stats.displayClock,
          period: stats.period,
          statusDescription: stats.statusDescription,
        };
        
        if (scoringPlays) {
          patch.scoringPlays = scoringPlays;
        }
        await ctx.db.patch(gameRecord._id, patch);
      }
    }
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

export const finalizeGameResults = internalMutation({
  args: {
    externalId: v.string(),
    stats: v.any(),
    scoringPlays: v.optional(v.array(v.any())),
  },
  handler: async (ctx, { externalId, stats, scoringPlays }) => {
    const existing = await ctx.db
      .query("cachedStats")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stats,
        lastFetched: Date.now(),
        scoringPlays: scoringPlays || existing.scoringPlays,
      });
    } else {
      await ctx.db.insert("cachedStats", {
        externalId,
        stats,
        lastFetched: Date.now(),
        scoringPlays,
      });
    }

    // Also cache player stats for the final state
    if (stats.boxscore?.players) {
      const existingPlayers = await ctx.db
        .query("cachedPlayerStats")
        .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
        .unique();

      if (existingPlayers) {
        await ctx.db.patch(existingPlayers._id, {
          stats: stats.boxscore.players,
          lastFetched: Date.now(),
        });
      } else {
        await ctx.db.insert("cachedPlayerStats", {
          externalId,
          stats: stats.boxscore.players,
          lastFetched: Date.now(),
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

export const getMatchSupercoachScores = query({
  args: { externalMatchId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { externalMatchId, limit }) => {
    return await ctx.db
      .query("supercoachScores")
      .withIndex("by_match_score", (q) => q.eq("externalMatchId", externalMatchId))
      .order("desc")
      .take(limit || 10);
  },
});


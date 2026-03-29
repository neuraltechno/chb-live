import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

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

import { query } from "./_generated/server";

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
        const oldHome = parseInt(oldStats.home[key] || "0");
        const newHome = parseInt(stats.home[key] || "0");
        const oldAway = parseInt(oldStats.away[key] || "0");
        const newAway = parseInt(stats.away[key] || "0");

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

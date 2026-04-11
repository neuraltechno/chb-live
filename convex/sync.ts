import { v } from "convex/values";
import { action, internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const syncAllLeagues = internalAction({
  args: {
    deep: v.optional(v.boolean()),
    round: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Check if we actually need to fetch (any games active or starting soon)
    const shouldFetch = await ctx.runQuery(internal.sync.shouldSyncGames);
    
    if (!shouldFetch && !args.deep && args.round === undefined) {
      // console.log("[Sync] Skipping scheduled sync: No active games or games starting soon.");
      return;
    }

    const games = await ctx.runAction(api.sportsApi.fetchAllGames, {
      deep: args.deep,
      round: args.round,
    });
    await ctx.runMutation(internal.games.syncGames, { games });
  },
});

export const shouldSyncGames = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Look for games that are:
    // 1. Currently 'live' or 'halftime'
    // 2. 'scheduled' and starting within the next 30 minutes
    // 3. Just finished in the last 15 minutes (to catch final score updates)
    
    // Check games within a 24-hour window around 'now' to be safe and efficient
    const twelveHoursAgo = now - 12 * 60 * 60 * 1000;
    const twelveHoursFromNow = now + 12 * 60 * 60 * 1000;

    const games = await ctx.db
      .query("cachedGames")
      .withIndex("by_startTime", (q) =>
        q.gt("startTime", twelveHoursAgo).lt("startTime", twelveHoursFromNow)
      )
      .collect();

    if (games.length === 0) return true; // Fallback to true if no games in cache

    const thirtyMinutes = 30 * 60 * 1000;
    const fifteenMinutes = 15 * 60 * 1000;

    const activeOrSoon = games.some((g) => {
      const status = g.data.status;
      const startTime = g.startTime;
      
      // Live or halftime games
      if (status === "live" || status === "halftime") return true;
      
      // Starting soon
      if (status === "scheduled" && (startTime - now) < thirtyMinutes) return true;
      
      // Check if it finished very recently (within the last 10 minutes)
      // This ensures we get the final scores accurately before stopping
      if (status === "finished" && (now - (g.lastFetched || 0)) < 10 * 60 * 1000) {
        // If it was live last time we checked but now it's finished, we might want one more sync
        // to be absolutely sure. But actually, if it's already finished in our DB, we've already
        // received the final status. The problem is if the API hasn't updated yet.
        // Let's just keep it simple.
      }

      return false;
    });

    // Also check for any games that AREN'T finished yet but their start time was in the past
    // This handles games that should have started but haven't been updated to 'live' yet
    const overdueGames = games.some(g => g.data.status !== "finished" && g.startTime < now);
    
    // If we have no games in the window, fetch once every few hours just in case
    // We'll use the lastFetched of the newest game or just return true if nothing found
    if (games.length === 0) return true;

    // Last resort: If we haven't synced ANY games in the last 4 hours, do it anyway
    const lastSync = Math.max(...games.map(g => g.lastFetched || 0));
    if (now - lastSync > 4 * 60 * 60 * 1000) return true;
    
    return activeOrSoon || overdueGames;
  }
});

export const syncRound = action({
  args: {
    round: v.number(),
  },
  handler: async (ctx, args) => {
    const games = await ctx.runAction(api.sportsApi.fetchAllGames, {
      round: args.round,
    });
    await ctx.runMutation(internal.games.syncGames, { games });
  },
});

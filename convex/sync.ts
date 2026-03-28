import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const syncAllLeagues = internalAction({
  args: {},
  handler: async (ctx) => {
    const games = await ctx.runAction(api.sportsApi.fetchAllGames, {});
    await ctx.runMutation(internal.games.syncGames, { games });
  },
});

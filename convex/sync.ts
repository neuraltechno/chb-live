import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const syncAllLeagues = internalAction({
  args: {
    deep: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const games = await ctx.runAction(api.sportsApi.fetchAllGames, {
      deep: args.deep,
    });
    await ctx.runMutation(internal.games.syncGames, { games });
  },
});

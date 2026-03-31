import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const syncAllLeagues = internalAction({
  args: {
    deep: v.optional(v.boolean()),
    round: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const games = await ctx.runAction(api.sportsApi.fetchAllGames, {
      deep: args.deep,
      round: args.round,
    });
    await ctx.runMutation(internal.games.syncGames, { games });
  },
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

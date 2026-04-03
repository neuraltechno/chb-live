import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const syncGames = internalMutation({
  args: {
    games: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const incomingExternalIds = new Set(args.games.map((g) => g.externalId));

    // Single query to fetch ALL existing games, then filter in memory
    const allExisting = await ctx.db.query("cachedGames").collect();
    const existingMap = new Map();
    for (const existing of allExisting) {
      existingMap.set(existing.externalId, existing);
    }

    const toInsert: any[] = [];
    const toUpdate: { id: any; fields: any }[] = [];

    for (const gameData of args.games) {
      const existing = existingMap.get(gameData.externalId);

      if (existing) {
        // Merge data to preserve fields like messageCount/activeUsers
        const mergedData = { ...existing.data, ...gameData };
        toUpdate.push({
          id: existing._id,
          fields: {
            data: mergedData,
            lastFetched: now,
            sport: gameData.sport,
            leagueId: gameData.league.id,
            startTime: new Date(gameData.startTime).getTime(),
            roundNumber: gameData.roundNumber,
            roundName: gameData.round,
            statusDisplay: gameData.statusDisplay,
            displayClock: gameData.displayClock,
            period: gameData.period,
            statusDescription: gameData.statusDescription,
          },
        });
      } else {
        toInsert.push({
          externalId: gameData.externalId,
          sport: gameData.sport,
          leagueId: gameData.league.id,
          startTime: new Date(gameData.startTime).getTime(),
          roundNumber: gameData.roundNumber,
          roundName: gameData.round,
          statusDisplay: gameData.statusDisplay,
          displayClock: gameData.displayClock,
          period: gameData.period,
          statusDescription: gameData.statusDescription,
          data: gameData,
          lastFetched: now,
        });
      }
    }

    // Batch all inserts and updates
    for (const fields of toInsert) {
      await ctx.db.insert("cachedGames", fields);
    }
    for (const { id, fields } of toUpdate) {
      await ctx.db.patch(id, fields);
    }

    // Cleanup: Remove games that are not in the incoming batch AND are not AFL
    // This is more efficient - only delete games we know are stale
    const gamesToDelete = allExisting.filter(
      (g) => g.sport !== "afl" && !incomingExternalIds.has(g.externalId)
    );

    for (const game of gamesToDelete) {
      await ctx.db.delete(game._id);
    }
  },
});

// One-time migration function to fix AFL games without round data
export const migrateAflRounds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allGames = await ctx.db.query("cachedGames").collect();
    const aflGames = allGames.filter((g) => g.sport === "afl");

    let count = 0;
    for (const game of aflGames) {
      const data = game.data || {};
      
      let roundNum = game.roundNumber;
      let roundName = game.roundName || data.round;

      if (roundNum === undefined && roundName) {
        if (roundName === "Opening Round") {
          roundNum = 0;
        } else if (roundName.startsWith("Round ")) {
          const num = parseInt(roundName.replace("Round ", ""));
          if (!isNaN(num)) roundNum = num;
        }
      }

      if (roundNum !== undefined) {
        await ctx.db.patch(game._id, {
          roundNumber: roundNum,
          roundName: roundName,
          data: { ...data, roundNumber: roundNum, round: roundName }
        });
        count++;
      }
    }
    return { migrated: count, totalAfl: aflGames.length };
  },
});

export const list = query({
  args: {
    leagues: v.optional(v.array(v.string())),
    sport: v.optional(v.string()),
    round: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let games;
    if (args.round !== undefined) {
      games = await ctx.db
        .query("cachedGames")
        .withIndex("by_round", (q) => q.eq("roundNumber", args.round))
        .collect();
    } else {
      // Default to 14-day window to avoid fetching the entire database
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
      
      games = await ctx.db
        .query("cachedGames")
        .withIndex("by_startTime", (q) => 
          q.gt("startTime", sevenDaysAgo).lt("startTime", sevenDaysFromNow)
        )
        .collect();
    }

    if (args.leagues && args.leagues.length > 0) {
      games = games.filter((g) => args.leagues!.includes(g.leagueId));
    }

    if (args.sport && args.sport !== "all") {
      games = games.filter((g) => g.sport === args.sport);
    }

    // Deduplicate games by externalId
    const seen = new Set<string>();
    const uniqueGames = games.filter((g) => {
      if (seen.has(g.externalId)) return false;
      seen.add(g.externalId);
      return true;
    });

    // Sort and project only necessary fields for the list view
    return uniqueGames
      .map((g) => {
        const d = g.data;
        return {
          id: d.id,
          externalId: d.externalId,
          status: d.status,
          startTime: d.startTime,
          league: d.league,
          round: d.round,
          roundNumber: d.roundNumber,
          leg: d.leg,
          seriesNote: d.seriesNote,
          minute: d.minute,
          venue: d.venue,
          homeTeam: {
            id: d.homeTeam.id,
            name: d.homeTeam.name,
            shortName: d.homeTeam.shortName,
            logo: d.homeTeam.logo,
            score: d.homeTeam.score,
          },
          awayTeam: {
            id: d.awayTeam.id,
            name: d.awayTeam.name,
            shortName: d.awayTeam.shortName,
            logo: d.awayTeam.logo,
            score: d.awayTeam.score,
          },
          messageCount: d.messageCount,
          activeUsers: d.activeUsers,
          sport: d.sport,
          statusDisplay: g.statusDisplay || d.statusDisplay,
          displayClock: g.displayClock || d.displayClock,
          period: g.period || d.period,
          statusDescription: g.statusDescription || d.statusDescription,
        };
      })
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
    const externalId = args.id.split("_").pop()!;
    const game = await ctx.db
      .query("cachedGames")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    if (!game) return null;
    
    const d = game.data;
    return {
      id: d.id,
      externalId: d.externalId,
      status: d.status,
      startTime: d.startTime,
      league: d.league,
      round: d.round,
      roundNumber: d.roundNumber,
      leg: d.leg,
      seriesNote: d.seriesNote,
      minute: d.minute,
      venue: d.venue,
      statusDisplay: game.statusDisplay || d.statusDisplay,
      displayClock: game.displayClock || d.displayClock,
      period: game.period || d.period,
      statusDescription: game.statusDescription || d.statusDescription,
      homeTeam: {
        id: d.homeTeam.id,
        name: d.homeTeam.name,
        shortName: d.homeTeam.shortName,
        logo: d.homeTeam.logo,
        score: d.homeTeam.score,
      },
      awayTeam: {
        id: d.awayTeam.id,
        name: d.awayTeam.name,
        shortName: d.awayTeam.shortName,
        logo: d.awayTeam.logo,
        score: d.awayTeam.score,
      },
      messageCount: d.messageCount,
      activeUsers: d.activeUsers,
      sport: d.sport,
    };
  },
});

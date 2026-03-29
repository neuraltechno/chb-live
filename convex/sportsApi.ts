import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  Game,
  GameStatus,
  League,
  SportType,
} from "../src/types";
import {
  ESPN_SPORT_SLUGS,
  SPORT_DATE_WINDOWS,
  SOCCER_LEAGUES,
  NCAA_LEAGUES,
  AFL_LEAGUES,
} from "./constants";

// ---------- Status Mapping ----------

function mapEspnStatus(state: string): GameStatus {
  switch (state?.toLowerCase()) {
    case "in":
      return "live";
    case "pre":
      return "scheduled";
    case "post":
      return "finished";
    default:
      return "scheduled";
  }
}

function getMinute(competition: any, sport: SportType): number | undefined {
  const statusType = competition?.status?.type;
  const state = statusType?.state;

  if (state !== "in") return undefined;

  if (sport === "soccer") {
    const clock = competition?.status?.displayClock;
    if (clock) {
      const num = parseInt(clock.replace(/[^0-9]/g, ""));
      if (!isNaN(num)) return num;
    }
    if (statusType?.description === "Halftime") return 45;
    return undefined;
  }

  return undefined;
}

function getSoccerHalftime(competition: any): boolean {
  const desc = competition?.status?.type?.description;
  return desc === "Halftime";
}

// ---------- Unified ESPN Fetcher ----------

async function fetchEspnGames(
  leagueId: string,
  league: League,
  sport: SportType
): Promise<Game[]> {
  const slug = ESPN_SPORT_SLUGS[leagueId];
  if (!slug) return [];

  try {
    const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`;
    
    // Fetch today
    const response = await fetch(`${baseUrl}?limit=50`);
    const data = await response.json();
    const events = data?.events || [];

    // Build date offsets
    const window = SPORT_DATE_WINDOWS[sport];
    const today = new Date();
    const dateOffsets: number[] = [];
    for (let d = -window.pastDays; d <= window.futureDays; d++) {
      if (d !== 0) dateOffsets.push(d);
    }

    const datePromises = dateOffsets.map(async (dayOffset) => {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
      try {
        const res = await fetch(`${baseUrl}?dates=${dateStr}&limit=40`);
        const resData = await res.json();
        return resData?.events || [];
      } catch (e) {
        return [];
      }
    });

    const dateResults = await Promise.all(datePromises);
    const upcomingEvents = dateResults.flat();

    // Combine and deduplicate
    const allEvents = [...events, ...upcomingEvents];
    const seen = new Set<string>();
    const uniqueEvents = allEvents.filter((ev: any) => {
      if (seen.has(ev.id)) return false;
      seen.add(ev.id);
      return true;
    });

    return uniqueEvents.map((event: any) => {
      const competition = event.competitions?.[0];
      const homeCompetitor = competition?.competitors?.find(
        (c: any) => c.homeAway === "home"
      );
      const awayCompetitor = competition?.competitors?.find(
        (c: any) => c.homeAway === "away"
      );

      // Determine game status
      const stateStr = competition?.status?.type?.state;
      let status = mapEspnStatus(stateStr);

      if (sport === "soccer" && getSoccerHalftime(competition)) {
        status = "halftime";
      }

      const description = competition?.status?.type?.description?.toLowerCase();
      if (description === "postponed") status = "postponed";
      if (description === "canceled" || description === "cancelled")
        status = "cancelled";

      const minute = getMinute(competition, sport);

      const homeScore = homeCompetitor?.score
        ? parseInt(homeCompetitor.score)
        : undefined;
      const awayScore = awayCompetitor?.score
        ? parseInt(awayCompetitor.score)
        : undefined;

      const showScore =
        status === "live" || status === "halftime" || status === "finished";

      // Extract round/leg info
      const notes = competition?.notes;
      const series = competition?.series;
      const leg = competition?.leg;
      let roundName: string | undefined;
      let legStr: string | undefined;
      let seriesNote: string | undefined;

      if (series?.title) {
        roundName = series.title;
      }
      if (leg?.displayValue) {
        legStr = leg.displayValue;
      }
      if (notes?.[0]?.headline) {
        seriesNote = notes[0].headline;
      }

      const seasonSlug = event.season?.slug;
      if (
        seasonSlug &&
        !roundName &&
        seasonSlug !== "regular-season" &&
        seasonSlug !== "preseason"
      ) {
        roundName = seasonSlug
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }

      const idPrefix = sport === "soccer" ? "soccer" : sport === "afl" ? "afl" : "ncaa";

      return {
        id: `${idPrefix}_${event.id}`,
        externalId: String(event.id),
        sport,
        league,
        homeTeam: {
          id: String(homeCompetitor?.id || homeCompetitor?.team?.id || ""),
          name: homeCompetitor?.team?.displayName || "TBD",
          shortName: homeCompetitor?.team?.abbreviation || "TBD",
          logo: homeCompetitor?.team?.logo || "",
          score: showScore ? homeScore : undefined,
        },
        awayTeam: {
          id: String(awayCompetitor?.id || awayCompetitor?.team?.id || ""),
          name: awayCompetitor?.team?.displayName || "TBD",
          shortName: awayCompetitor?.team?.abbreviation || "TBD",
          logo: awayCompetitor?.team?.logo || "",
          score: showScore ? awayScore : undefined,
        },
        status,
        startTime: event.date,
        minute,
        venue: competition?.venue?.fullName || competition?.venue?.displayName,
        round: roundName,
        leg: legStr,
        seriesNote,
        messageCount: 0,
        activeUsers: 0,
      } as Game;
    });
  } catch (error: any) {
    console.error(`[ESPN API] Error:`, error?.message || error);
    return [];
  }
}

// ---------- Public Actions ----------

export const fetchAllGames = action({
  args: {
    leagueFilter: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const soccerLeagueIds = args.leagueFilter
      ? SOCCER_LEAGUES.filter((l) => args.leagueFilter!.includes(l.id)).map((l) => l.id)
      : []; // Temporarily disabled: SOCCER_LEAGUES.map((l) => l.id);

    const ncaaLeagueIds = args.leagueFilter
      ? NCAA_LEAGUES.filter((l) => args.leagueFilter!.includes(l.id)).map((l) => l.id)
      : []; // Temporarily disabled: NCAA_LEAGUES.map((l) => l.id);

    const aflLeagueIds = args.leagueFilter
      ? AFL_LEAGUES.filter((l) => args.leagueFilter!.includes(l.id)).map((l) => l.id)
      : AFL_LEAGUES.map((l) => l.id);

    const allPromises = [
      ...soccerLeagueIds.map((id) => {
        const league = SOCCER_LEAGUES.find((l) => l.id === id)!;
        return fetchEspnGames(id, league, "soccer");
      }),
      ...ncaaLeagueIds.map((id) => {
        const league = NCAA_LEAGUES.find((l) => l.id === id)!;
        return fetchEspnGames(id, league, league.sport);
      }),
      ...aflLeagueIds.map((id) => {
        const league = AFL_LEAGUES.find((l) => l.id === id)!;
        return fetchEspnGames(id, league, "afl");
      }),
    ];

    const results = await Promise.all(allPromises);
    const allGames = results.flat();

    return allGames.sort((a, b) => {
      const statusOrder: Record<GameStatus, number> = {
        live: 0,
        halftime: 1,
        scheduled: 2,
        finished: 3,
        postponed: 4,
        cancelled: 5,
      };

      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;

      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  },
});

export const fetchGameStats = action({
  args: {
    externalId: v.string(),
    leagueId: v.string(),
    gameId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Check cache first
    const cached = (await ctx.runQuery(internal.stats.getCachedStats, {
      externalId: args.externalId,
    })) as any;

    // If cache is fresh (less than 30 seconds old), return it
    if (cached && Date.now() - cached.lastFetched < 30_000) {
      return cached.stats;
    }

    const slug = ESPN_SPORT_SLUGS[args.leagueId];
    if (!slug) return null;

    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/summary?event=${args.externalId}`;
      const response = await fetch(url);
      const data = await response.json();

      const boxscore = data?.boxscore;
      const players = boxscore?.players || [];

      // Save player stats
      await ctx.runMutation(internal.stats.savePlayerStats, {
        externalId: args.externalId,
        stats: players,
      });

      const teams: any[] = boxscore?.teams || [];

      const homeTeam = teams.find((t: any) => t.homeAway === "home");
      const awayTeam = teams.find((t: any) => t.homeAway === "away");

      if (!homeTeam || !awayTeam) return cached?.stats || null;

      const homeMap: Record<string, string> = {};
      const awayMap: Record<string, string> = {};

      (homeTeam.statistics || []).forEach((s: any) => {
        if (s.name && s.displayValue !== undefined) {
          homeMap[s.name] = String(s.displayValue);
        }
      });

      (awayTeam.statistics || []).forEach((s: any) => {
        if (s.name && s.displayValue !== undefined) {
          awayMap[s.name] = String(s.displayValue);
        }
      });

      if (
        Object.keys(homeMap).length === 0 &&
        Object.keys(awayMap).length === 0
      ) {
        return cached?.stats || null;
      }

      const newStats = { home: homeMap, away: awayMap };

      // 2. Save to cache and detect changes (bot messages)
      await ctx.runMutation(internal.stats.saveStatsAndDetectChanges, {
        externalId: args.externalId,
        stats: newStats,
        gameId: args.gameId,
      });

      return newStats;
    } catch (error) {
      console.error("[Stats Action] Error:", error);
      return cached?.stats || null;
    }
  },
});

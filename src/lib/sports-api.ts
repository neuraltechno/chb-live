// =============================================
// Sports API Integration — ESPN Public API
// Fetches REAL live/upcoming game data from ESPN
// for ALL sports. No API key required.
//
// Supported leagues:
//   Soccer: Premier League, La Liga, Bundesliga,
//           Serie A, Ligue 1, UEFA Champions League
//   NCAA:   Football, Men's Basketball
// =============================================

import axios from "axios";
import {
  Game,
  GameStatus,
  League,
  SportType,
  SOCCER_LEAGUES,
  NCAA_LEAGUES,
  ESPN_SPORT_SLUGS,
} from "@/types";

// ---------- ESPN API Client ----------

const espnApi = axios.create({
  baseURL: "https://site.api.espn.com/apis/site/v2/sports",
  timeout: 15000,
});

const SPORT_DATE_WINDOWS: Record<SportType, { pastDays: number; futureDays: number }> = {
  soccer: { pastDays: 2, futureDays: 3 },
  ncaa_football: { pastDays: 1, futureDays: 2 },
  ncaa_basketball: { pastDays: 1, futureDays: 2 },
};

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
    const params: Record<string, any> = { limit: 50 };
    const response = await espnApi.get(`/${slug}/scoreboard`, { params });
    const events = response.data?.events || [];

    // Build date offsets with a narrow window to keep response times low
    const window = SPORT_DATE_WINDOWS[sport];
    const today = new Date();
    const dateOffsets: number[] = [];
    for (let d = -window.pastDays; d <= window.futureDays; d++) {
      if (d !== 0) dateOffsets.push(d); // skip today — already fetched above
    }

    const datePromises = dateOffsets.map((dayOffset) => {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
      return espnApi
        .get(`/${slug}/scoreboard`, { params: { dates: dateStr, limit: 40 } })
        .then((res) => res.data?.events || [])
        .catch(() => []);
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

      // Extract round/leg info (UCL knockout stages, etc.)
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

      const idPrefix = sport === "soccer" ? "soccer" : "ncaa";

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
    console.error(
      `[ESPN API] Error fetching ${leagueId}:`,
      error?.message || error
    );
    return [];
  }
}

// ---------- Public Fetch Functions ----------

export async function fetchSoccerGames(leagueId: string): Promise<Game[]> {
  const league = SOCCER_LEAGUES.find((l) => l.id === leagueId);
  if (!league) return [];
  return fetchEspnGames(leagueId, league, "soccer");
}

export async function fetchNcaaGames(leagueId: string): Promise<Game[]> {
  const league = NCAA_LEAGUES.find((l) => l.id === leagueId);
  if (!league) return [];
  return fetchEspnGames(leagueId, league, league.sport);
}

// ---------- Fetch All Games ----------

export async function fetchAllGames(
  leagueFilter?: string[]
): Promise<Game[]> {
  const soccerLeagueIds = leagueFilter
    ? SOCCER_LEAGUES.filter((l) => leagueFilter.includes(l.id)).map((l) => l.id)
    : SOCCER_LEAGUES.map((l) => l.id);

  const ncaaLeagueIds = leagueFilter
    ? NCAA_LEAGUES.filter((l) => leagueFilter.includes(l.id)).map((l) => l.id)
    : NCAA_LEAGUES.map((l) => l.id);

  const allPromises = [
    ...soccerLeagueIds.map((id) => fetchSoccerGames(id)),
    ...ncaaLeagueIds.map((id) => fetchNcaaGames(id)),
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
}

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
    case "status_scheduled":
      return "scheduled";
    case "status_in_progress":
      return "live";
    case "status_final":
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

      // Try to parse round number for AFL
      let roundNumber: number | undefined;
      const round = event.competitions?.[0]?.round;
      if (round) {
        roundNumber = typeof round === 'object' ? round.number : round;
      }
      
      // Fallback for round name if it's in regular season
      let roundNameDisplay = roundName;
      if (sport === "afl" && !roundNameDisplay) {
          if (roundNumber !== undefined) {
              roundNameDisplay = roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;
          }
      }

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
        round: roundNameDisplay,
        roundNumber,
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

    // Special case for AFL: if we are fetching AFL, we also want to fetch all rounds
    if (aflLeagueIds.includes("afl")) {
      const aflLeague = AFL_LEAGUES.find((l) => l.id === "afl")!;
      const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/australian-football/afl/scoreboard`;
      
      // ESPN usually supports fetching by year and week
      // For AFL, rounds are often called 'weeks' in ESPN API
      // Opening Round is sometimes Round 1 in ESPN if Round 1 is called Round 2,
      // OR Opening Round is its own thing. Let's fetch 0 to 24.
      const rounds = Array.from({ length: 25 }, (_, i) => i);
      const year = new Date().getFullYear();

      const roundPromises = rounds.map(async (roundNum) => {
        try {
          // If we are fetching today's matches, ESPN might return a different format
          // than if we fetch a specific week. Let's make sure we handle both.
          // IMPORTANT: If current year is 2026, we fetch 2026.
          const res = await fetch(`${baseUrl}?dates=${year}&week=${roundNum}&limit=50`);
          const resData = await res.json();
          const events = resData?.events || [];
          
          if (events.length === 0) {
            console.log(`[AFL Fetch] No events found for round ${roundNum} using year ${year} and week ${roundNum}`);
          }

          return events.map((event: any) => {
            const competition = event.competitions?.[0];
            const homeCompetitor = competition?.competitors?.find((c: any) => c.homeAway === "home");
            const awayCompetitor = competition?.competitors?.find((c: any) => c.homeAway === "away");
            const stateStr = competition?.status?.type?.state;
            const status = mapEspnStatus(stateStr);
            const showScore = status === "live" || status === "halftime" || status === "finished";
            const homeScore = homeCompetitor?.score ? parseInt(homeCompetitor.score) : undefined;
            const awayScore = awayCompetitor?.score ? parseInt(awayCompetitor.score) : undefined;

            // Use the round parameter from the outer scope as a fallback
            let finalRoundNumber = roundNum;
            
            // Try to parse round number from event data if available
            const eventRound = event.competitions?.[0]?.round;
            if (eventRound) {
                finalRoundNumber = typeof eventRound === 'object' ? eventRound.number : eventRound;
            }

            let roundDisplay = `Round ${finalRoundNumber}`;
            if (finalRoundNumber === 0) roundDisplay = "Opening Round";
            
            // If ESPN calls it "Round X" but we want our own mapping, we trust our round number
            if (event.season?.slug !== "regular-season") {
              roundDisplay = event.season?.slug || roundDisplay;
            }

            console.log(`[AFL Fetch] Event: ${event.id}, Round: ${finalRoundNumber}, Display: ${roundDisplay}`);

            return {
              id: `afl_${event.id}`,
              externalId: String(event.id),
              sport: "afl" as SportType,
              league: aflLeague,
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
              venue: competition?.venue?.fullName || competition?.venue?.displayName,
              round: roundDisplay,
              roundNumber: finalRoundNumber,
              messageCount: 0,
              activeUsers: 0,
            } as Game;
          });
        } catch (e) {
          return [];
        }
      });
      
      allPromises.push(...roundPromises);
    }

    const results = await Promise.all(allPromises);
    const allGames = results.flat();

    // Deduplicate by externalId
    // If we have a game from the full season fetch and the today's fetch, 
    // prioritize the one with a roundNumber (usually from the season fetch).
    const uniqueGamesMap = new Map<string, Game>();
    for (const g of allGames) {
      const existing = uniqueGamesMap.get(g.externalId);
      if (!existing || (g.roundNumber !== undefined && existing.roundNumber === undefined)) {
        uniqueGamesMap.set(g.externalId, g);
      }
    }
    const uniqueGames = Array.from(uniqueGamesMap.values());

    return uniqueGames.map((game) => {
      // For AFL games from fetchEspnGames, ensure roundNumber is set
      if (game.sport === "afl" && game.roundNumber === undefined) {
        // We can try to extract it from the 'round' string if it exists
        if (game.round && game.round.startsWith("Round ")) {
          const num = parseInt(game.round.replace("Round ", ""));
          if (!isNaN(num)) game.roundNumber = num;
        } else if (game.round === "Opening Round") {
          game.roundNumber = 0;
        }
      }
      return game;
    }).sort((a, b) => {
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
      console.log(`[Stats Action] Fetching ESPN Summary URL: ${url}`);
      const response = await fetch(url);
      const data = await response.json();

      const boxscore = data?.boxscore;
      let players = boxscore?.players || [];

      if (players.length > 0) {
        console.log(`[Stats Action] Player stats sample for team 0: ${JSON.stringify(players[0].statistics?.[0]?.keys || players[0].statistics?.[0]?.labels)}`);
      }

      // Fetch SuperCoach scores for AFL
      if (args.leagueId === "afl") {
        try {
          const game = data.header?.competitions?.[0];
          const homeTeam = game?.competitors?.find((c: any) => c.homeAway === "home")?.team?.displayName;
          const awayTeam = game?.competitors?.find((c: any) => c.homeAway === "away")?.team?.displayName;
          const startTime = data.header?.competitions?.[0]?.date;
          const roundNumber = data.header?.week;

          if (homeTeam && awayTeam && startTime) {
            const scScores = (await ctx.runAction(internal.footyinfo.fetchSuperCoachScores, {
              homeTeam,
              awayTeam,
              date: startTime,
              roundNumber,
            })) as Record<string, { sc: number; guernsey: string }> | null;

            if (scScores) {
              console.log(`[Stats Action] Injecting SC scores for ${Object.keys(scScores).length} players`);
              
              // Normalize the keys in scScores once
              const normalizeForMatch = (s: string) => s.replace(/[,.]/g, "").toLowerCase().trim();
              const normalizedScScores: Record<string, any> = {};
              Object.entries(scScores).forEach(([k, v]) => {
                normalizedScScores[normalizeForMatch(k)] = v;
              });

              // Inject SuperCoach scores and guernsey into players data
              players = players.map((teamData: any) => ({
                ...teamData,
                statistics: (teamData.statistics || []).map((category: any) => ({
                  ...category,
                  athletes: (category.athletes || []).map((athleteData: any) => {
                    const ath = { ...athleteData };
                    if (ath.athlete && ath.athlete.displayName) {
                      const name = ath.athlete.displayName.toLowerCase();
                      const parts = name.split(" ");
                      const firstName = parts[0];
                      const initial = firstName.charAt(0);
                      const fullLastName = parts.slice(1).join(" ");
                      
                      const nameNorm = normalizeForMatch(name);
                      const reversedNorm = parts.length > 1 ? normalizeForMatch(`${fullLastName} ${firstName}`) : nameNorm;
                      const shortNameNorm = parts.length > 1 ? normalizeForMatch(`${initial} ${fullLastName}`) : nameNorm;
                      
                      const data = normalizedScScores[reversedNorm] ||
                                   normalizedScScores[shortNameNorm] ||
                                   normalizedScScores[nameNorm] ||
                                   (parts.length > 2 ? normalizedScScores[normalizeForMatch(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`)] : undefined);

                      if (data) {
                        return {
                          ...ath,
                          supercoach: data.sc,
                          guernsey: data.guernsey || ath.guernsey,
                          mappedStats: {
                            ...(ath.mappedStats || {}),
                            sc: data.sc,
                            guernsey: data.guernsey || ath.guernsey
                          }
                        };
                      }
                    }
                    return ath;
                  })
                }))
              }));
            }
          }
        } catch (scError) {
          console.error("[Stats Action] FootyInfo error:", scError);
        }
      }

      // Save player stats
      await ctx.runMutation(internal.stats.savePlayerStats, {
        externalId: args.externalId,
        stats: players,
      });

      const teams: any[] = boxscore?.teams || [];

      console.log(`[Stats Action] Teams from ESPN boxscore: ${JSON.stringify(teams.map(t => ({
        name: t.team?.displayName,
        statsCount: t.statistics?.length,
        statNames: t.statistics?.map((s: any) => s.name)
      })))}`);

      const homeTeam = teams.find((t: any) => t.homeAway === "home");
      const awayTeam = teams.find((t: any) => t.homeAway === "away");

      if (!homeTeam || !awayTeam) return cached?.stats || null;

      const homeMap: Record<string, string> = {};
      const awayMap: Record<string, string> = {};

      console.log(`[Stats Action] Mapping stats for ${args.leagueId}. Home stats count: ${homeTeam.statistics?.length}`);

      (homeTeam.statistics || []).forEach((s: any) => {
        if (s.name && s.displayValue !== undefined) {
          homeMap[s.name] = String(s.displayValue);
          console.log(`[Stats Action] Stat: ${s.name} = ${s.displayValue} (${s.label})`);
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

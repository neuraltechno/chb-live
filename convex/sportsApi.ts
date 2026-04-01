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

// ---------- AFL Specific Fetchers ----------

async function fetchAflGamesByRound(aflLeague: League, roundNum: number | undefined = undefined): Promise<Game[]> {
  const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/australian-football/afl/scoreboard`;
  const year = new Date().getFullYear();
  
  // Note: For historical data (past rounds), ESPN sometimes requires the date range
  // or a different week parameter. However, ?dates=YEAR&week=N is standard.
  // Let's try removing dates if we have a week, or using a broader range.
  let url = `${baseUrl}?limit=100`;
  if (roundNum !== undefined) {
    // If it's a number, it's a specific week.
    url += `&week=${roundNum}`;
    // Explicitly add the year for AFL - use 2026 for now as we know that's the season
    url = `https://site.api.espn.com/apis/site/v2/sports/australian-football/afl/scoreboard?dates=2026&week=${roundNum}&limit=100`;
    console.log(`[AFL Fetch Debug] Using URL: ${url}`);
  } else {
    url = `${baseUrl}?limit=50`;
  }

  try {
    console.log(`[AFL Fetch] Fetching URL: ${url}`);
    const res = await fetch(url);
    const resData = await res.json();
    const events = resData?.events || [];

    return events.map((event: any) => {
      const competition = event.competitions?.[0];
      const homeCompetitor = competition?.competitors?.find((c: any) => c.homeAway === "home");
      const awayCompetitor = competition?.competitors?.find((c: any) => c.homeAway === "away");
      const stateStr = competition?.status?.type?.state;
      const status = mapEspnStatus(stateStr);
      const showScore = status === "live" || status === "halftime" || status === "finished";
      const homeScore = homeCompetitor?.score ? parseInt(homeCompetitor.score) : undefined;
      const awayScore = awayCompetitor?.score ? parseInt(awayCompetitor.score) : undefined;

      let finalRoundNumber = roundNum;
      const eventRound = event.competitions?.[0]?.round;
      if (eventRound) {
          finalRoundNumber = typeof eventRound === 'object' ? eventRound.number : eventRound;
      }

      // If the event doesn't have a round number but we are in a round loop,
      // we should trust the loop's roundNum as the authoritative source.
      if (finalRoundNumber === undefined && roundNum !== undefined) {
          finalRoundNumber = roundNum;
      }
      console.log(`[AFL Fetch Debug] Event: ${event.id}, Final round number: ${finalRoundNumber}`);

      let roundDisplay = `Round ${finalRoundNumber}`;
      if (finalRoundNumber === 0) roundDisplay = "Opening Round";
      
      if (event.season?.slug && event.season?.slug !== "regular-season") {
        roundDisplay = event.season?.slug || roundDisplay;
      }
      
      if (competition?.series?.title) {
        roundDisplay = competition.series.title;
      } else if (competition?.notes?.[0]?.headline && competition.notes[0].headline.includes("Round")) {
        roundDisplay = competition.notes[0].headline;
      }

      // If we still have a generic round display, and we know the roundNum from the loop, use it
      if (roundNum !== undefined && (!roundDisplay || roundDisplay === "undefined" || roundDisplay === "Round undefined")) {
          roundDisplay = roundNum === 0 ? "Opening Round" : `Round ${roundNum}`;
      }

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
  } catch (e: any) {
    console.error(`[AFL Fetch] Error fetching AFL games for round ${roundNum}:`, e?.message || e);
    return [];
  }
}

async function fetchEspnAflCurrentRoundGames(aflLeague: League): Promise<Game[]> {
  const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/australian-football/afl/scoreboard`;
  try {
    const response = await fetch(`${baseUrl}?limit=1`);
    const data = await response.json();
    const currentWeek = data?.week?.number;

    if (currentWeek !== undefined) {
      console.log(`[AFL Fetch] Detected current week: ${currentWeek}`);
      return fetchAflGamesByRound(aflLeague, currentWeek);
    }
  } catch (e: any) {
    console.error(`[AFL Fetch] Error detecting current week:`, e?.message || e);
  }
  return fetchAflGamesByRound(aflLeague, undefined);
}

// ---------- Public Actions ----------

export const fetchAllGames = action({
  args: {
    leagueFilter: v.optional(v.array(v.string())),
    deep: v.optional(v.boolean()), // If true, fetch all rounds for relevant leagues (e.g. AFL)
    round: v.optional(v.number()), // If provided, fetch a specific round (e.g. for AFL)
  },
  handler: async (ctx, args) => {
    const soccerLeagueIds = args.leagueFilter
      ? SOCCER_LEAGUES.filter((l) => args.leagueFilter!.includes(l.id)).map((l) => l.id)
      : [];

    const ncaaLeagueIds = args.leagueFilter
      ? NCAA_LEAGUES.filter((l) => args.leagueFilter!.includes(l.id)).map((l) => l.id)
      : [];

    const aflLeagueIds = args.leagueFilter
      ? AFL_LEAGUES.filter((l) => args.leagueFilter!.includes(l.id)).map((l) => l.id)
      : AFL_LEAGUES.map((l) => l.id);

    const allPromises: Promise<Game[]>[] = [
      ...soccerLeagueIds.map((id) => {
        const league = SOCCER_LEAGUES.find((l) => l.id === id)!;
        return fetchEspnGames(id, league, "soccer");
      }),
      ...ncaaLeagueIds.map((id) => {
        const league = NCAA_LEAGUES.find((l) => l.id === id)!;
        return fetchEspnGames(id, league, league.sport);
      }),
    ];

    if (aflLeagueIds.includes("afl")) {
      const aflLeague = AFL_LEAGUES.find((l) => l.id === "afl")!;
      if (args.round !== undefined) {
        // If a specific round is requested, fetch just that round
        allPromises.push(fetchAflGamesByRound(aflLeague, args.round));
      } else if (args.deep) {
        // If deep sync is requested, fetch all rounds
        const rounds = Array.from({ length: 25 }, (_, i) => i);
        const roundPromises = rounds.map(async (roundNum) => fetchAflGamesByRound(aflLeague, roundNum));
        allPromises.push(...roundPromises);
      } else {
        // Default to current round
        allPromises.push(fetchEspnAflCurrentRoundGames(aflLeague));
      }
    }

    const results = await Promise.all(allPromises);
    const allGames = results.flat();

    const uniqueGamesMap = new Map<string, Game>();
    for (const g of allGames) {
      const existing = uniqueGamesMap.get(g.externalId);
      if (!existing || (g.roundNumber !== undefined && existing.roundNumber === undefined)) {
        uniqueGamesMap.set(g.externalId, g);
      }
    }
    const uniqueGames = Array.from(uniqueGamesMap.values());

    return uniqueGames.sort((a, b) => {
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

    // Check game status to see if it's finished
    const game = (await ctx.runQuery(api.games.get, { id: args.gameId })) as Game | null;
    const isFinished = game?.status === "finished";

    // If cache exists and game is finished, always return it
    if (cached && isFinished) {
      // If we have match stats but player stats are missing from their dedicated table,
      // populate the player stats table from the cached match stats.
      const playerStats = (await ctx.runQuery(api.stats.getPlayerStats, {
        externalId: args.externalId,
      })) as any;

      if (!playerStats && cached.stats?.boxscore?.players) {
        await ctx.runMutation(internal.stats.savePlayerStats, {
          externalId: args.externalId,
          stats: cached.stats.boxscore.players,
        });
      }
      return cached.stats;
    }

    // If cache is fresh (less than 60 seconds old for live, or exists for scheduled), return it
    if (cached && Date.now() - cached.lastFetched < 60_000) {
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

      // Extract team statistics for the match stats component
      const homeStats: Record<string, string> = {};
      const awayStats: Record<string, string> = {};
      
      if (boxscore?.teams) {
        boxscore.teams.forEach((team: any) => {
          const side = team.homeAway === "home" ? homeStats : (team.homeAway === "away" ? awayStats : null);
          if (side) {
            side.teamId = String(team.team?.id || "");
            team.statistics?.forEach((stat: any) => {
              side[stat.name] = stat.displayValue;
            });
          }
        });
      }

      // Fetch SuperCoach scores for AFL
      if (args.leagueId === "afl") {
        try {
          const competition = data.header?.competitions?.[0];
          const homeTeamInfo = competition?.competitors?.find((c: any) => c.homeAway === "home");
          const awayTeamInfo = competition?.competitors?.find((c: any) => c.homeAway === "away");
          const homeTeamName = homeTeamInfo?.team?.displayName;
          const awayTeamName = awayTeamInfo?.team?.displayName;
          const startTime = competition?.date;
          const roundData = data.header?.week;
          const roundNumber = typeof roundData === "object" ? roundData.number : roundData;

          if (homeTeamName && awayTeamName && startTime) {
            const scScores = (await ctx.runAction(internal.footyinfo.fetchSuperCoachScores, {
              homeTeam: homeTeamName,
              awayTeam: awayTeamName,
              date: startTime,
              roundNumber,
            })) as Record<string, { sc: number; guernsey: string }> | null;

            if (scScores) {
              console.log(`[Stats Action] Injecting SC scores for ${Object.keys(scScores).length} players`);
              
              // Normalize the keys in scScores once
              const normalizeForMatch = (s: string) => s.replace(/[,.]/g, "").toLowerCase().trim();
              const normalizedScScores: Record<string, { sc: number; guernsey: string }> = {};
              Object.entries(scScores).forEach(([k, v]) => {
                normalizedScScores[normalizeForMatch(k)] = v;
              });

              const flatScoresToUpsert: any[] = [];

              // Inject SuperCoach scores and guernsey into players data
              players = players.map((teamData: any) => {
                const teamId = String(teamData.team?.id || "");
                const teamName = teamData.team?.displayName || "";
                const isHome = teamId === String(homeTeamInfo?.team?.id);
                const opponentInfo = isHome ? awayTeamInfo : homeTeamInfo;

                return {
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
                        
                        const scData = normalizedScScores[reversedNorm] ||
                                     normalizedScScores[shortNameNorm] ||
                                     normalizedScScores[nameNorm] ||
                                     (parts.length > 2 ? normalizedScScores[normalizeForMatch(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`)] : undefined);

                        if (scData) {
                          // Collect for bulk upsert
                          flatScoresToUpsert.push({
                            playerId: String(ath.athlete.id),
                            playerName: ath.athlete.displayName,
                            playerImage: ath.athlete.headshot?.href || ath.athlete.headshot,
                            externalMatchId: args.externalId,
                            gameId: args.gameId,
                            score: scData.sc,
                            round: roundNumber,
                            roundName: data.header?.season?.name,
                            teamId,
                            teamName,
                            opponentId: String(opponentInfo?.team?.id || ""),
                            opponentName: opponentInfo?.team?.displayName || "",
                          });

                          return {
                            ...ath,
                            supercoach: scData.sc,
                            guernsey: scData.guernsey || ath.guernsey,
                            mappedStats: {
                              ...(ath.mappedStats || {}),
                              sc: scData.sc,
                              guernsey: scData.guernsey || ath.guernsey
                            }
                          };
                        }
                      }
                      return ath;
                    }),
                  })),
                };
              });

              // Bulk upsert to supercoachScores table
              if (flatScoresToUpsert.length > 0) {
                await ctx.runMutation(internal.stats.upsertSupercoachScores, {
                  scores: flatScoresToUpsert,
                });
              }
            }
          }
        } catch (scError: any) {
          console.error(`[Stats Action] SuperCoach scoring error:`, scError?.message || scError);
        }
      }

      const result = {
        home: homeStats,
        away: awayStats,
        boxscore: {
          ...boxscore,
          players,
        },
        header: data?.header,
        pickcenter: data?.pickcenter,
        againstTheSpread: data?.againstTheSpread,
        odds: data?.odds,
        predictive: data?.predictive,
        winprobability: data?.winprobability,
        predictor: data?.predictor,
        standings: data?.standings,
      };

      // 2. Cache the result
      await ctx.runMutation(internal.stats.saveStatsAndDetectChanges, {
        externalId: args.externalId,
        stats: result,
        gameId: args.gameId,
      });

      // 3. Cache player stats separately for the PlayerStats component
      if (players && players.length > 0) {
        await ctx.runMutation(internal.stats.savePlayerStats, {
          externalId: args.externalId,
          stats: players,
        });
      }

      return result;
    } catch (error: any) {
      console.error(`[Stats Action] Error:`, error?.message || error);
      return null;
    }
  },
});

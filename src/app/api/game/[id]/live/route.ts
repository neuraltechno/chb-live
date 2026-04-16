import { NextRequest, NextResponse } from 'next/server';
import { gameCache } from '@/lib/cache';
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../../../../../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error('[Live API] NEXT_PUBLIC_CONVEX_URL not set');
}
const convex = new ConvexHttpClient(convexUrl || 'dummy');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ESPN_SPORT_SLUGS: Record<string, string> = {
  pl: "soccer/eng.1",
  laliga: "soccer/esp.1",
  bundesliga: "soccer/ger.1",
  seriea: "soccer/ita.1",
  ligue1: "soccer/fra.1",
  ucl: "soccer/uefa.champions",
  ncaa_football: "football/college-football",
  ncaa_basketball: "basketball/mens-college-basketball",
  afl: "australian-football/afl",
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`[Live API] Starting request for gameId: ${params.id}`);
  const gameId = params.id;

  // gameId format: sport_externalId (e.g., afl_401646704)
  const parts = gameId.split('_');
  const sportPrefix = parts[0];
  const externalId = parts[parts.length - 1];
  console.log(`[Live API] Parsed sportPrefix: ${sportPrefix}, externalId: ${externalId}`);

  // Try cache first
  const cacheKey = `live_stats_${gameId}`;
  const cachedData = gameCache.get(cacheKey);
  if (cachedData) {
    console.log(`[Live API] Returning cached data for ${gameId}`);
    return NextResponse.json(cachedData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  }

  const leagueId = sportPrefix;
  const slug = ESPN_SPORT_SLUGS[leagueId];
  if (!slug) {
    console.log(`[Live API] Unsupported sport: ${leagueId}`);
    return NextResponse.json({ error: 'Unsupported sport' }, { status: 400 });
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/summary?event=${externalId}`;
    console.log(`[Live API] Fetching: ${url}`);

    // Use a basic fetch
    let response;
    try {
      response = await fetch(url);
    } catch (fetchError) {
      console.error('[Live API] Fetch failed:', fetchError);
      throw fetchError;
    }

    console.log(`[Live API] ESPN response status: ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Live API] ESPN API Error: ${response.status} - ${errorText}`);
      return NextResponse.json({ error: `ESPN API returned ${response.status}` }, { status: 502 });
    }

    console.log(`[Live API] Parsing JSON response`);
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('[Live API] JSON parse failed:', jsonError);
      throw jsonError;
    }
    console.log(`[Live API] JSON parsed successfully`);

    if (!data) {
      console.log(`[Live API] No data returned from ESPN for ${externalId}`);
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    console.log(`[Live API] Starting data transformation`);
    let transformedData: any;
    try {
      // Basic transformation
      const boxscore = data?.boxscore;
      const homeStats: Record<string, string> = {};
      const awayStats: Record<string, string> = {};

      if (boxscore?.teams && Array.isArray(boxscore.teams)) {
        boxscore.teams.forEach((team: any) => {
          const side = team.homeAway === "home" ? homeStats : (team.homeAway === "away" ? awayStats : null);
          if (side) {
            side.teamId = String(team.team?.id || "");
            side.name = String(team.team?.displayName || "");
            side.abbreviation = String(team.team?.abbreviation || "");

            if (team.score !== undefined) {
              side.score = String(team.score);
            }

          if (team.statistics && Array.isArray(team.statistics)) {
            team.statistics.forEach((stat: any) => {
                if (stat.name && stat.displayValue !== undefined) {
                  const name = stat.name.toLowerCase();
                  side[name] = String(stat.displayValue);
                }
              });
            }
          }
        });
      }

      // Ensure goals and behinds are mapped for AFL even if ESPN uses different naming
      if (leagueId.includes('afl') || slug.includes('australian-football')) {
        [homeStats, awayStats].forEach(side => {
          if (side.goals === undefined && side.totalgoals !== undefined) side.goals = side.totalgoals;
          if (side.behinds === undefined && side.totalbehinds !== undefined) side.behinds = side.totalbehinds;
        });
      }

      transformedData = {
        home: homeStats,
        away: awayStats,
        boxscore: boxscore,
        header: data?.header,
        scoringPlays: [] as any[],
        statusDisplay: undefined as string | undefined,
        displayClock: data?.header?.competitions?.[0]?.status?.displayClock,
        period: data?.header?.competitions?.[0]?.status?.period,
        statusDescription: data?.header?.competitions?.[0]?.status?.type?.description,
        sts: data?.header?.competitions?.[0]?.status?.type?.shortDetail || data?.header?.competitions?.[0]?.status?.type?.description
      };

      // AFL specific formatting and scoring plays
      if (leagueId.includes('afl') || slug.includes('australian-football')) {
        const homeGoals = homeStats.goals || "0";
        const homeBehinds = homeStats.behinds || "0";
        const homeTotal = homeStats.score || "0";
        const awayGoals = awayStats.goals || "0";
        const awayBehinds = awayStats.behinds || "0";
        const awayTotal = awayStats.score || "0";

        if (homeTotal !== "0" || awayTotal !== "0") {
          transformedData.statusDisplay = `${homeGoals}.${homeBehinds}.${homeTotal} - ${awayGoals}.${awayBehinds}.${awayTotal}`;
        }

        // Try to get SuperCoach data but don't fail the whole request if it errors
        try {
          const scCacheKey = `sc_scores_${externalId}`;
          let scData = gameCache.get(scCacheKey);

          if (!scData) {
            // Trigger the Convex action
            const result = await convex.action(api.sportsApi.fetchGameStats, {
              externalId: externalId,
              leagueId: "afl",
              gameId: gameId
            });

            if (result && result.boxscore?.players) {
              scData = result.boxscore.players;
              gameCache.set(scCacheKey, scData, { ttl: 10 * 1000 });
            }
          }

          if (scData && transformedData.boxscore?.players) {
            const scMap = new Map();
            scData.forEach((teamData: any) => {
              teamData.statistics?.forEach((category: any) => {
                category.athletes?.forEach((athlete: any) => {
                  if (athlete.athlete?.id) {
                    scMap.set(String(athlete.athlete.id), {
                      sc: athlete.supercoach,
                      guernsey: athlete.guernsey
                    });
                  }
                });
              });
            });

            transformedData.boxscore.players = transformedData.boxscore.players.map((teamData: any) => ({
              ...teamData,
              statistics: (teamData.statistics || []).map((category: any) => ({
                ...category,
                athletes: (category.athletes || []).map((athlete: any) => {
                  const id = athlete.athlete?.id ? String(athlete.athlete.id) : null;
                  const extra = id ? scMap.get(id) : null;
                  return extra ? {
                    ...athlete,
                    supercoach: extra.sc,
                    guernsey: extra.guernsey
                  } : athlete;
                })
              }))
            }));
          }
        } catch (scError) {
          console.warn('[Live API] Non-fatal error fetching SC scores:', scError);
        }

        // Extract scoring plays
        const plays = data.plays || [];
        if (Array.isArray(plays) && plays.length > 0) {
          const competition = data.header?.competitions?.[0];
          const homeTeamInfo = competition?.competitors?.find((c: any) => c.homeAway === "home");
          const awayTeamInfo = competition?.competitors?.find((c: any) => c.homeAway === "away");
          const homeTeamName = homeTeamInfo?.team?.displayName;
          const awayTeamName = awayTeamInfo?.team?.displayName;

          transformedData.scoringPlays = plays
            .filter((play: any) => {
              const type = play.type?.type?.toLowerCase();
              const text = play.text?.toLowerCase();
              const typeText = play.type?.text?.toLowerCase();
              return (
                type === "goal" || 
                type === "behind" || 
                type === "rushed" || 
                typeText === "rushed" || 
                text?.includes("rushed")
              );
            })
            .map((play: any) => {
              const participant = play.participants?.[0]?.athlete;
              const type = play.type?.type?.toLowerCase();
              const text = play.text?.toLowerCase();
              const typeText = play.type?.text?.toLowerCase();
              const resolvedType = (type === "rushed" || typeText === "rushed" || text?.includes("rushed")) ? "behind" : type;

              return {
                id: String(play.id),
                seq: String(play.sequenceNumber),
                type: resolvedType,
                text: play.text,
                home: play.homeScore,
                away: play.awayScore,
                p: play.period?.number,
                clk: play.clock?.displayValue,
                tId: String(play.team?.id),
                tName: play.team?.id === homeTeamInfo?.team?.id ? homeTeamName : (play.team?.id === awayTeamInfo?.team?.id ? awayTeamName : undefined),
                pId: participant ? String(participant.id) : undefined,
                pName: participant ? participant.displayName : undefined,
                pShort: participant ? participant.shortName : undefined,
              };
            });
        }
      }
      console.log(`[Live API] Transformation completed successfully`);
    } catch (transformError) {
      console.error('[Live API] Error during data transformation:', transformError);
      throw transformError;
    }

    // Store in cache
    gameCache.set(cacheKey, transformedData, { ttl: 2000 });
    console.log(`[Live API] Cached data for ${gameId}`);

    // Finalize if finished
    const state = transformedData.header?.competitions?.[0]?.status?.type?.state;
    if (transformedData.statusDescription?.toLowerCase() === 'final' || state === 'post') {
      try {
        const deployKey = process.env.CONVEX_DEPLOYMENT_KEY;
        if (deployKey) {
          await convex.setAuth(async () => deployKey);
          await convex.mutation(internal.stats.finalizeGameResults, {
            externalId: externalId,
            stats: transformedData,
            scoringPlays: transformedData.scoringPlays,
          });
          console.log(`[Live API] Finalized stats for game ${gameId}`);
        }
      } catch (convError) {
        console.error('[Live API] Error finalizing stats to Convex:', convError);
      }
    }

    console.log(`[Live API] Returning transformed data for ${gameId}`);
    return NextResponse.json(transformedData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('[Live API] Fatal error fetching live stats:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { gameCache } from '@/lib/cache';
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ESPN_SPORT_SLUGS: Record<string, string> = {
  pl: "soccer/eng.1",
  laliga: "soccer/esp.1",
  bundesliga: "soccer/ger.1",
  seriea: "soccer/ita.1",
  ligue1: "soccer/fra.1",
  ucl: "soccer/uefa.champions",
  ncaa_fb: "football/college-football",
  ncaa_bb: "basketball/mens-college-basketball",
  afl: "australian-football/afl",
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const gameId = params.id;
  
  // gameId format: sport_externalId (e.g., afl_401646704)
  const parts = gameId.split('_');
  const sportPrefix = parts[0];
  const externalId = parts[parts.length - 1];

  // Try cache first
  const cacheKey = `live_stats_${gameId}`;
  const cachedData = gameCache.get(cacheKey);
  if (cachedData) {
    return NextResponse.json(cachedData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  }

  // Determine leagueId and slug
  // For now, we map sportPrefix to a default leagueId if not ambiguous
  let leagueId = sportPrefix;
  if (sportPrefix === 'ncaa') {
    // Ambiguous, but let's assume football or check if we can differentiate
    // In a real scenario, we might need leagueId in the request
    leagueId = 'ncaa_fb'; 
  }
  
  const slug = ESPN_SPORT_SLUGS[leagueId];
  if (!slug) {
    return NextResponse.json({ error: 'Unsupported sport' }, { status: 400 });
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/summary?event=${externalId}`;
    const response = await fetch(url, { 
      next: { revalidate: 0 },
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    const data = await response.json();

    if (!data) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Basic transformation (mimicking convex/sportsApi.ts fetchGameStats)
    const boxscore = data?.boxscore;
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

    const transformedData = {
      home: homeStats,
      away: awayStats,
      boxscore: boxscore,
      header: data?.header,
      scoringPlays: undefined as any[] | undefined,
      statusDisplay: undefined as string | undefined,
      displayClock: data?.header?.competitions?.[0]?.status?.displayClock,
      period: data?.header?.competitions?.[0]?.status?.period,
      statusDescription: data?.header?.competitions?.[0]?.status?.type?.description,
    };

    // AFL specific formatting and scoring plays
    if (leagueId === "afl") {
      // 1. Fetch SuperCoach scores from Convex if it's an AFL game
      // We do this every 60 seconds to avoid overloading FootyInfo
      const scCacheKey = `sc_scores_${externalId}`;
      let scData = gameCache.get(scCacheKey);
      
      if (!scData) {
        try {
          // Trigger the Convex action which handles FootyInfo fetching and caching
          // We pass gameId so it can associate scores with the correct game
          const result = await convex.action(api.sportsApi.fetchGameStats, {
            externalId: externalId,
            leagueId: "afl",
            gameId: gameId
          });
          
          if (result && result.boxscore?.players) {
            scData = result.boxscore.players;
            // Cache SC data for 60 seconds
            gameCache.set(scCacheKey, scData, 60 * 1000);
          }
        } catch (scError) {
          console.error('[Live API] Error fetching SC scores:', scError);
        }
      }

      // 2. Merge SC data into the transformedData
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
              if (extra) {
                return {
                  ...athlete,
                  supercoach: extra.sc,
                  guernsey: extra.guernsey
                };
              }
              return athlete;
            })
          }))
        }));
      }

      const homeGoals = homeStats.goals || "0";
      const homeBehinds = homeStats.behinds || "0";
      const homeTotal = homeStats.score || "0";
      const awayGoals = awayStats.goals || "0";
      const awayBehinds = awayStats.behinds || "0";
      const awayTotal = awayStats.score || "0";

      if (homeTotal !== "0" || awayTotal !== "0") {
        transformedData.statusDisplay = `${homeGoals}.${homeBehinds}.${homeTotal} - ${awayGoals}.${awayBehinds}.${awayTotal}`;
      }

      // Extract scoring plays for AFL
      const plays = data.plays || [];
      if (plays.length > 0) {
        const competition = data.header?.competitions?.[0];
        const homeTeamInfo = competition?.competitors?.find((c: any) => c.homeAway === "home");
        const awayTeamInfo = competition?.competitors?.find((c: any) => c.homeAway === "away");
        const homeTeamName = homeTeamInfo?.team?.displayName;
        const awayTeamName = awayTeamInfo?.team?.displayName;

        transformedData.scoringPlays = plays
          .filter((play: any) => {
            const type = play.type?.type?.toLowerCase();
            const text = play.type?.text?.toLowerCase();
            return type === "goal" || type === "behind" || type === "rushed" || text === "rushed";
          })
          .map((play: any) => {
            const participant = play.participants?.[0]?.athlete;
            const type = play.type?.type?.toLowerCase();
            const text = play.type?.text?.toLowerCase();
            const resolvedType = (type === "rushed" || text === "rushed") ? "behind" : type;
            
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

    // Store in cache
    gameCache.set(cacheKey, transformedData);

    // If game is finished, save to Convex to ensure final stats are persisted
    if (transformedData.statusDescription?.toLowerCase() === 'final' || 
        transformedData.header?.competitions?.[0]?.status?.type?.state === 'post') {
      try {
        await convex.setAuth(async () => process.env.CONVEX_DEPLOYMENT_KEY || "");
        await convex.mutation(internal.stats.finalizeGameResults, {
          externalId: externalId,
          stats: transformedData,
          scoringPlays: transformedData.scoringPlays,
        });
        console.log(`[Live API] Finalized stats for game ${gameId}`);
      } catch (convError) {
        console.error('[Live API] Error finalizing stats to Convex:', convError);
      }
    }

    return NextResponse.json(transformedData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error fetching live stats:', error);
    return NextResponse.json({ error: 'Failed to fetch live stats' }, { status: 500 });
  }
}


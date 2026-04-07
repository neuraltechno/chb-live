import { NextRequest, NextResponse } from 'next/server';
import { gameCache } from '@/lib/cache';

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
    return NextResponse.json(cachedData);
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
    const response = await fetch(url, { next: { revalidate: 15 } });
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
      statusDisplay: undefined as string | undefined,
      displayClock: data?.header?.competitions?.[0]?.status?.displayClock,
      period: data?.header?.competitions?.[0]?.status?.period,
      statusDescription: data?.header?.competitions?.[0]?.status?.type?.description,
    };

    // AFL specific formatting
    if (leagueId === "afl") {
      const homeGoals = homeStats.goals || "0";
      const homeBehinds = homeStats.behinds || "0";
      const homeTotal = homeStats.score || "0";
      const awayGoals = awayStats.goals || "0";
      const awayBehinds = awayStats.behinds || "0";
      const awayTotal = awayStats.score || "0";

      if (homeTotal !== "0" || awayTotal !== "0") {
        transformedData.statusDisplay = `${homeGoals}.${homeBehinds}.${homeTotal} - ${awayGoals}.${awayBehinds}.${awayTotal}`;
      }
    }

    // Store in cache
    gameCache.set(cacheKey, transformedData);

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error fetching live stats:', error);
    return NextResponse.json({ error: 'Failed to fetch live stats' }, { status: 500 });
  }
}

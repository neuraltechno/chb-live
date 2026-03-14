import { NextRequest, NextResponse } from "next/server";
import { fetchAllGames } from "@/lib/sports-api";

export const dynamic = "force-dynamic";

type CachedEntry = { data: any; timestamp: number };

// Cache responses in memory by league filter key
const responseCache = new Map<string, CachedEntry>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(leagues?: string[]) {
  if (!leagues || leagues.length === 0) return "all";
  return `leagues:${[...leagues].sort().join(",")}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagues = searchParams.get("leagues")?.split(",").filter(Boolean);
    const cacheKey = getCacheKey(leagues);

    const now = Date.now();

    // Check cache for filtered + unfiltered requests
    const cached = responseCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        data: {
          games: cached.data,
          lastUpdated: new Date(cached.timestamp).toISOString(),
          cached: true,
        },
      });
    }

    // Deduplicate concurrent requests for the same cache key
    let requestPromise = inFlightRequests.get(cacheKey);
    if (!requestPromise) {
      requestPromise = fetchAllGames(leagues || undefined);
      inFlightRequests.set(cacheKey, requestPromise);
    }

    const games = await requestPromise;
    inFlightRequests.delete(cacheKey);

    // Update cache for this key
    responseCache.set(cacheKey, { data: games, timestamp: now });

    return NextResponse.json({
      success: true,
      data: {
        games,
        lastUpdated: new Date().toISOString(),
        cached: false,
      },
    });
  } catch (error) {
    const { searchParams } = new URL(request.url);
    const leagues = searchParams.get("leagues")?.split(",").filter(Boolean);
    inFlightRequests.delete(getCacheKey(leagues));

    console.error("Error in /api/games:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}

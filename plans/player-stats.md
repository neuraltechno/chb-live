# Player Stats Implementation Plan

This plan outlines the steps to add player statistics to the Convex backend, following the existing pattern for team stats.

## Overview

The ESPN API summary endpoint provides both team and player statistics. We will update the `fetchGameStats` action to extract player stats and store them in a new `cachedPlayerStats` table.

## 1. Schema Update

Update [`convex/schema.ts`](convex/schema.ts) to include the `cachedPlayerStats` table.

```typescript
  cachedPlayerStats: defineTable({
    externalId: v.string(), // ESPN Event ID
    stats: v.any(),        // Raw or structured player stats
    lastFetched: v.number(),
  }).index("by_externalId", ["externalId"]),
```

## 2. API Update

Update [`convex/sportsApi.ts`](convex/sportsApi.ts) with the following:

- **`getCachedPlayerStats` (internalQuery)**: Retrieve cached player stats by `externalId`.
- **`savePlayerStats` (internalMutation)**: Save or update player stats in the `cachedPlayerStats` table.
- **`fetchGameStats` (action)**: 
    - Fetch the summary from ESPN.
    - Extract `boxscore.players`.
    - Call `savePlayerStats` to update the cache.

## 3. Data Structure

The ESPN player stats structure is typically an array of team-based statistics groups.

Example of what will be stored in `cachedPlayerStats.stats`:
```json
[
  {
    "team": { "id": "1", "displayName": "Team A" },
    "statistics": [
      {
        "name": "passing",
        "keys": ["c/att", "yds", "td"],
        "athletes": [
          {
            "athlete": { "id": "101", "displayName": "Player One" },
            "stats": ["15/20", "200", "2"]
          }
        ]
      }
    ]
  }
]
```

## Next Steps

1.  Apply schema changes.
2.  Implement query and mutation in `convex/sportsApi.ts`.
3.  Update action logic to handle player stats extraction.
4.  Test by opening a match page and checking the Convex dashboard.

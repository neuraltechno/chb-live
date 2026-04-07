# Live Game Stats Migration Plan

## Overview
To reduce Convex database bandwidth and costs, this plan outlines the migration of live game statistics from real-time Convex subscriptions to a cached REST API polling architecture.

## Phase 1: API Layer Implementation
- [ ] Create `app/api/game/[id]/live/route.ts`.
- [ ] Implement a server-side memory cache (e.g., using `lru-cache` or a simple global map) with a 15–30 second TTL.
- [ ] Logic to fetch raw game data from the upstream source.
- [ ] Data transformation to match existing frontend expectations.

## Phase 2: Frontend Hook Development
- [ ] Create `hooks/use-game-live-stats.ts`.
- [ ] Implement polling using `useSWR` or `react-query` targeting the new API endpoint.
- [ ] Ensure the hook handles loading and error states gracefully.

## Phase 3: Convex Refactoring
- [ ] Update `convex/games.ts` (or relevant file) to remove high-frequency update mutations.
- [ ] Add a mutation `finalizeGameResults` to save the final game snapshot upon match conclusion.
- [ ] Update the schema if necessary to differentiate between live transient state and historical snapshots.

## Phase 4: UI Integration
- [ ] Replace `useQuery(api.games.getLiveStats, ...)` with `useGameLiveStats(...)` in game dashboard components.
- [ ] Verify that interactive components (e.g., Live Chat) still utilize Convex subscriptions.
- [ ] Implement lazy loading for detailed player stats sections to further reduce payload size.

## Phase 5: Optimization & Testing
- [ ] Monitor Convex dashboard for bandwidth reduction.
- [ ] Verify cache hit rates on the new API route.
- [ ] Load test the polling mechanism with multiple concurrent users.
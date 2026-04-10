# MatchBot Implementation Plan

This document outlines the strategy for implementing the **MatchBot** feature, which provides automated chat commentary based on live sports statistics and momentum changes.

## Goals
- Detect significant individual performances (e.g., "Nick Daicos has scored 15 points in the last 5 minutes").
- Track team momentum (e.g., "Geelong has kicked the last 6 goals").
- Optimize for database bandwidth by using partial snapshots and dirty-checking.

## 1. Schema Extensions (`convex/schema.ts`)

To support velocity detection without storing full history, we introduce two specialized tables:

### `statSnapshots`
Stores lightweight periodic records of player/team stats for delta calculations.
- `gameId`: string
- `timestamp`: number (for time-windowing)
- `topPerformers`: array of `{ pId, sc }` (Top 10 only to save bandwidth)
- `teamScores`: array of `{ teamId, score }`

### `gameMomentum`
Tracks short-term trends to avoid repeated calculations in every poll.
- `gameId`: string
- `lastScoringTeamId`: string
- `consecutiveScores`: number
- `recentAlerts`: array of strings (prevent bot spamming for the same event)

## 2. Detection Logic

### Velocity (Individual)
1. When new stats are saved, fetch the closest `statSnapshot` from 5 minutes ago.
2. Compare the current SuperCoach (SC) score with the snapshot score.
3. If `currentSC - snapshotSC > threshold` (e.g., 15 points), trigger MatchBot message.

### Momentum (Team)
1. Monitor `scoringPlays` array.
2. If the last $N$ scoring plays belong to the same team, trigger: *"🔥 Momentum Alert: [Team] has scored the last [N] times!"*

## 3. Optimization Strategy

### Write Optimization
- **Dirty Checking:** In the live API route (`/api/game/[id]/live`), compare the new data hash with the local cache. If no relevant score/play changes occurred, skip the Convex mutation.
- **Throttling:** Only create a new `statSnapshot` record every 5 minutes.

### Read Optimization
- MatchBot messages are inserted directly into the `messages` table with a `userId` belonging to a "System/Bot" user.
- Clients receive these via their existing message subscriptions.

## 4. Implementation Steps

1. **Schema Update:** Add `statSnapshots` and `gameMomentum` tables.
2. **Mutation Logic:** Update `saveStatsAndDetectChanges` in `convex/stats.ts` to:
   - Fetch previous snapshot.
   - Run comparison logic.
   - Insert MatchBot message if thresholds are met.
   - Create new snapshot if >5 mins since last.
3. **Bot Identity:** Create a system user in the `users` table for MatchBot.
4. **UI Enhancement:** Update `ChatWindow.tsx` to style MatchBot messages differently (e.g., distinct background or icon).

# SuperCoach Scores Integration Plan

## Overview
Currently, AFL player stats are fetched from the ESPN API. However, ESPN does not provide SuperCoach (SC) scores. We have identified `api.footyinfo.com` as a reliable source for these scores.

## Findings
- **Base API URL:** `https://api.footyinfo.com/api/`
- **Match Stats Endpoint:** `match/{slug}/player_stats`
- **Round Summary Endpoint:** `round_summary` or `round_summary?round_id={id}`
- **Team Info Endpoint:** `teams?competition_ids[]=166` (166 is AFL)
- **Data Format:** Match stats JSON contains a list of players with a `supercoach` field.
- **Example:** `supercoach: { value: 150 }`

## Implementation Strategy

### 1. Data Mapping
We can link an ESPN Game ID (e.g., `afl_401655025`) to a FootyInfo match `slug` using the `round_summary` API.
1. Fetch `https://api.footyinfo.com/api/round_summary` to get all matches for the current round.
2. For each FootyInfo match, find the corresponding ESPN game by matching:
    - **Team Names:** Match `home_team_full` and `away_team_full` (using a mapping or fuzzy match).
    - **Date:** Match `match_date` (allowing for slight timezone differences).
3. Store this mapping in a Convex table (e.g., `aflGameMapping`).

### 2. Convex Backend (stats.ts)
- Modify `fetchGameStats` in `convex/sportsApi.ts` to also fetch FootyInfo data if the sport is `afl`.
- The process for AFL games will be:
    1. Fetch ESPN summary (already implemented).
    2. Resolve the FootyInfo `slug` for the game.
    3. Fetch `https://api.footyinfo.com/api/match/{slug}/player_stats`.
    4. Extract `supercoach` scores.
    5. Merge the `supercoach` score into the athlete stats saved to `cachedPlayerStats`.

### 3. Player Matching Logic
Players will be matched between ESPN and FootyInfo within each team by:
- **Primary:** Full Name (e.g., "Nick Daicos" vs "N Daicos" — might need normalization).
- **Secondary:** Team Name + Initial + Surname.
- **Note:** Both APIs provide team context, which narrows down the search space significantly.

### 4. Frontend (PlayerStats.tsx)
- Add a new column for SuperCoach (`SC`) in the `PlayerStats` component when the sport is `afl`.
- Map the merged `sc` or `supercoach` key to the display table.

## Proposed Todo List
1. [x] Analyze FootyInfo API and match listing (Found `round_summary` API).
2. [ ] Create mapping system between ESPN and FootyInfo games in Convex.
3. [ ] Implement `fetchFootyInfoStats` action in `convex/sportsApi.ts`.
4. [ ] Update `savePlayerStats` to merge FootyInfo data into the existing player stats.
5. [ ] Update `src/components/PlayerStats.tsx` to display the "SC" column for AFL games.

## Considerations
- **Caching:** Continue using the 30-second cache window to avoid excessive API calls.
- **Robustness:** If FootyInfo is unavailable or fails to match a game/player, the system should fall back to showing only ESPN stats without breaking.

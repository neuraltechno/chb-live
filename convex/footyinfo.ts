import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const fetchSuperCoachScores = internalAction({
  args: {
    homeTeam: v.string(),
    awayTeam: v.string(),
    date: v.string(), // ISO date
  },
  handler: async (ctx, { homeTeam, awayTeam, date }) => {
    console.log(`[FootyInfo] Fetching SC scores for ${homeTeam} vs ${awayTeam} on ${date}`);
    try {
      // 1. Fetch round summary to find the match slug
      console.log(`[FootyInfo] Fetching round summary...`);
      const summaryRes = await fetch("https://api.footyinfo.com/api/round_summary");
      const summaryData = await summaryRes.json();
      const matches = summaryData.matches || [];

      // Normalize names for better matching
      const normalize = (name: string) => 
        name.toLowerCase()
          .replace(/sydney swans/g, "sydney")
          .replace(/geelong cats/g, "geelong")
          .replace(/adelaide crows/g, "adelaide")
          .replace(/brisbane lions/g, "brisbane")
          .replace(/gold coast suns/g, "gold coast")
          .replace(/gws giants/g, "gws")
          .replace(/fremantle dockers/g, "fremantle")
          .replace(/west coast eagles/g, "west coast")
          .trim();

      const targetHome = normalize(homeTeam);
      const targetAway = normalize(awayTeam);
      const targetDate = date.split("T")[0];

      // 2. Find matching match
      const match = matches.find((m: any) => {
        const mHome = normalize(m.home_team_full || m.home_team || "");
        const mAway = normalize(m.away_team_full || m.away_team || "");
        const mDate = m.match_date;

        // Match by teams and date (allowing for slight date mismatch due to timezones)
        return (mHome === targetHome && mAway === targetAway) || 
               (mHome === targetAway && mAway === targetHome);
      });

      if (!match || !match.slug) {
        console.log(`[FootyInfo] No match found for ${homeTeam} vs ${awayTeam} on ${date}`);
        return null;
      }

      // 3. Fetch player stats for the match
      console.log(`[FootyInfo] Fetching stats for slug: ${match.slug}`);
      const statsUrl = `https://api.footyinfo.com/api/match/${match.slug}/player_stats`;
      const statsRes = await fetch(statsUrl);
      const statsData = await statsRes.json();

      // 4. Extract SuperCoach scores and guernsey
      // FootyInfo returns: { home: { rows: [...] }, away: { rows: [...] } }
      const scScores: Record<string, { sc: number; guernsey: string }> = {};

      const processRows = (rows: any[]) => {
        rows.forEach((row: any) => {
          const shortName = row.player_short?.value;
          const sortName = row.player_sort_name?.value;
          const score = row.supercoach?.value;
          const guernsey = row.guernsey?.value;
          
          if (score !== undefined || guernsey !== undefined) {
            const data = { sc: score || 0, guernsey: String(guernsey || "") };
            if (shortName) scScores[shortName.toLowerCase()] = data;
            if (sortName) scScores[sortName.toLowerCase()] = data;
          }
        });
      };

      if (statsData.home?.rows) processRows(statsData.home.rows);
      if (statsData.away?.rows) processRows(statsData.away.rows);

      return scScores;
    } catch (error) {
      console.error("[FootyInfo] Error fetching SuperCoach scores:", error);
      return null;
    }
  },
});

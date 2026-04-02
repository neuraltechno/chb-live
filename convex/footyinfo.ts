import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const fetchSuperCoachScores = internalAction({
  args: {
    homeTeam: v.string(),
    awayTeam: v.string(),
    date: v.string(), // ISO date
    roundNumber: v.optional(v.number()),
  },
  handler: async (ctx, { homeTeam, awayTeam, date, roundNumber }) => {
    console.log(`[FootyInfo] Fetching SC scores for ${homeTeam} vs ${awayTeam} on ${date} (Round ${roundNumber ?? 'current'})`);
    try {
      // 1. Fetch round summary to find the match slug
      console.log(`[FootyInfo] Fetching round summary...`);
      let summaryRes = await fetch("https://api.footyinfo.com/api/round_summary");
      let summaryData = await summaryRes.json();
      let matches = summaryData.matches || [];

      // If we have a roundNumber, and it's not the current round, fetch that specific round
      if (roundNumber !== undefined && summaryData.round_short_name !== String(roundNumber)) {
        console.log(`[FootyInfo] Target round ${roundNumber} differs from current round ${summaryData.round_short_name}`);
        const targetRound = (summaryData.rounds || []).find((r: any) => 
          r.short_name === String(roundNumber) || 
          (roundNumber === 0 && r.name === "Opening Round")
        );

        if (targetRound) {
          console.log(`[FootyInfo] Switching to round: ${targetRound.name} (ID: ${targetRound.id})`);
          summaryRes = await fetch(`https://api.footyinfo.com/api/round_summary?round_id=${targetRound.id}`);
          summaryData = await summaryRes.json();
          matches = summaryData.matches || [];
        } else {
          console.log(`[FootyInfo] Could not find round ${roundNumber} in rounds list: ${summaryData.rounds?.map((r: any) => r.short_name).join(', ')}`);
        }
      }

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
          .replace(/richmond tigers/g, "richmond")
          .replace(/collingwood magpies/g, "collingwood")
          .replace(/essendon bombers/g, "essendon")
          .replace(/st kilda saints/g, "st kilda")
          .replace(/melbourne demons/g, "melbourne")
          .replace(/north melbourne kangaroos/g, "north melbourne")
          .replace(/port adelaide power/g, "port adelaide")
          .replace(/hawthorn hawks/g, "hawthorn")
          .replace(/carlton blues/g, "carlton")
          .trim();

      const targetHome = normalize(homeTeam);
      const targetAway = normalize(awayTeam);
      const targetDate = date.split("T")[0];

      console.log(`[FootyInfo] Target teams normalized: ${targetHome} vs ${targetAway}`);

      // 2. Find matching match
      const match = matches.find((m: any) => {
        const mHome = normalize(m.home_team_full || m.home_team || "");
        const mAway = normalize(m.away_team_full || m.away_team || "");
        
        // Match by teams (allowing for swapped home/away)
        const teamMatch = (mHome === targetHome && mAway === targetAway) || 
                         (mHome === targetAway && mAway === targetHome);
        
        if (teamMatch) {
          console.log(`[FootyInfo] Found match by teams: ${mHome} vs ${mAway}`);
        }
        
        return teamMatch;
      });

      if (!match || !match.slug) {
        console.log(`[FootyInfo] No match found for ${homeTeam} vs ${awayTeam} in round summary`);
        console.log(`[FootyInfo] Available matches in this round: ${matches.map((m: any) => `${m.home_team_full || m.home_team} vs ${m.away_team_full || m.away_team}`).join(', ')}`);
        return null;
      }

      // 3. Fetch player stats for the match
      console.log(`[FootyInfo] Found match in summary:`, JSON.stringify(match));
      console.log(`[FootyInfo] Fetching stats for slug: ${match.slug}`);
      const statsUrl = `https://api.footyinfo.com/api/match/${match.slug}/player_stats`;
      const statsRes = await fetch(statsUrl);
      const statsData = await statsRes.json();

      // 4. Extract SuperCoach scores and guernsey
      const scScores: Record<string, { sc: number; guernsey: string }> = {};

      console.log(`[FootyInfo] Extracting status for match slug: ${match.slug}. Summary sts: ${match.sts}`);
      
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

      console.log(`[FootyInfo] Successfully extracted ${Object.keys(scScores).length} player scores`);
      const sts = (match.sts && match.sts !== "undefined") ? match.sts : null;
      console.log(`[FootyInfo] Returning sts: ${sts}`);
      return {
        scores: scScores,
        sts: sts,
      };
    } catch (error) {
      console.error("[FootyInfo] Error fetching SuperCoach scores:", error);
      return null;
    }
  },
});

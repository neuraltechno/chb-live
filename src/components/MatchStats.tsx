"use client";

import { useEffect, useState } from "react";
import { Game, SportType } from "@/types";
import { BarChart2, Loader2, Plus, Minus } from "lucide-react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

// ─── Internal Types ────────────────────────────────────────────────────────────

interface RawStats {
  home: Record<string, string>;
  away: Record<string, string>;
}

interface StatRow {
  label: string;
  home: string;
  away: string;
  homeNum: number;
  awayNum: number;
}

interface StatGroup {
  name: string;
  stats: StatRow[];
}

// ─── Sport-Specific Stat Group Definitions ────────────────────────────────────

type StatKeyDef = { key: string; label: string };
type GroupDef = { name: string; keys: StatKeyDef[] };

const SOCCER_GROUPS: GroupDef[] = [
  {
    name: "Attack",
    keys: [
      { key: "shotsTotal", label: "Total Shots" },
      { key: "shotsOnTarget", label: "Shots on Target" },
      { key: "shotsOffTarget", label: "Shots off Target" },
      { key: "blockedShots", label: "Blocked Shots" },
      { key: "dangerousAttacks", label: "Dangerous Attacks" },
      { key: "attacks", label: "Attacks" },
    ],
  },
  {
    name: "Goalkeeping",
    keys: [{ key: "saves", label: "Goalkeeper Saves" }],
  },
  {
    name: "Passing",
    keys: [
      { key: "passingAccuracy", label: "Pass Accuracy (%)" },
      { key: "totalPasses", label: "Total Passes" },
    ],
  },
  {
    name: "Defending",
    keys: [
      { key: "tackles", label: "Tackles" },
      { key: "interceptions", label: "Interceptions" },
      { key: "clearances", label: "Clearances" },
    ],
  },
  {
    name: "Set Pieces",
    keys: [
      { key: "cornerKicks", label: "Corner Kicks" },
      { key: "offsides", label: "Offsides" },
      { key: "freeKicksTotal", label: "Free Kicks" },
    ],
  },
  {
    name: "Discipline",
    keys: [
      { key: "fouls", label: "Fouls" },
      { key: "yellowCards", label: "Yellow Cards" },
      { key: "redCards", label: "Red Cards" },
    ],
  },
];

const BASKETBALL_GROUPS: GroupDef[] = [
  {
    name: "Shooting",
    keys: [
      { key: "fieldGoalPct", label: "Field Goal %" },
      { key: "threePointFieldGoalPct", label: "3-Point %" },
      { key: "freeThrowPct", label: "Free Throw %" },
      { key: "fieldGoalsMade", label: "Field Goals Made" },
      { key: "threePointFieldGoalsMade", label: "3-Pointers Made" },
      { key: "freeThrowsMade", label: "Free Throws Made" },
    ],
  },
  {
    name: "Rebounds",
    keys: [
      { key: "totalRebounds", label: "Total Rebounds" },
      { key: "offensiveRebounds", label: "Off. Rebounds" },
      { key: "defensiveRebounds", label: "Def. Rebounds" },
    ],
  },
  {
    name: "Playmaking",
    keys: [
      { key: "assists", label: "Assists" },
      { key: "steals", label: "Steals" },
      { key: "blocks", label: "Blocks" },
      { key: "turnovers", label: "Turnovers" },
    ],
  },
  {
    name: "Scoring",
    keys: [
      { key: "pointsInPaint", label: "Points in Paint" },
      { key: "fastBreakPoints", label: "Fast Break Points" },
      { key: "secondChancePoints", label: "2nd Chance Points" },
      { key: "benchPoints", label: "Bench Points" },
    ],
  },
  {
    name: "Discipline",
    keys: [
      { key: "fouls", label: "Fouls" },
      { key: "technicalFouls", label: "Technical Fouls" },
    ],
  },
];

const FOOTBALL_GROUPS: GroupDef[] = [
  {
    name: "Offense",
    keys: [
      { key: "totalYards", label: "Total Yards" },
      { key: "netPassingYards", label: "Passing Yards" },
      { key: "rushingYards", label: "Rushing Yards" },
      { key: "firstDowns", label: "First Downs" },
    ],
  },
  {
    name: "Efficiency",
    keys: [
      { key: "thirdDownEff", label: "3rd Down Conv." },
      { key: "fourthDownEff", label: "4th Down Conv." },
      { key: "possessionTime", label: "Time of Possession" },
    ],
  },
  {
    name: "Turnovers",
    keys: [
      { key: "turnovers", label: "Total Turnovers" },
      { key: "fumblesLost", label: "Fumbles Lost" },
      { key: "interceptions", label: "Interceptions Thrown" },
    ],
  },
  {
    name: "Penalties",
    keys: [
      { key: "penalties", label: "Penalties" },
      { key: "penaltyYards", label: "Penalty Yards" },
    ],
  },
];

const AFL_GROUPS: GroupDef[] = [
  {
    name: "Scoring & Attack",
    keys: [
      { key: "goals", label: "Goals" },
      { key: "behinds", label: "Behinds" },
      { key: "score", label: "Total Points" },
      { key: "goalAccuracy", label: "Goal Accuracy" },
      { key: "goalAssists", label: "Goal Assists" },
      { key: "inside50s", label: "Inside 50s" },
      { key: "marksInside50", label: "Marks Inside 50" },
    ],
  },
  {
    name: "Contest & Clearance",
    keys: [
      { key: "centreClearances", label: "Centre Clearances" },
      { key: "stoppageClearances", label: "Stoppage Clearances" },
      { key: "totalClearances", label: "Total Clearances" },
      { key: "contestedMarks", label: "Contested Marks" },
      { key: "uncontestedMarks", label: "Uncontested Marks" },
      { key: "contestedPossessions", label: "Contested Possessions" },
      { key: "uncontestedPossessions", label: "Uncontested Possessions" },
      { key: "hitouts", label: "Hitouts" },
    ],
  },
  {
    name: "Possession & Ball Movement",
    keys: [
      { key: "kicks", label: "Kicks" },
      { key: "handballs", label: "Handballs" },
      { key: "disposals", label: "Disposals" },
      { key: "disposalEfficiency", label: "Disposal Efficiency" },
      { key: "marks", label: "Marks" },
      { key: "bounces", label: "Bounces" },
      
      
    ],
  },
  {
    name: "Defence & Pressure",
    keys: [
      { key: "tackles", label: "Tackles" },
      { key: "tacklesInside50", label: "Tackles Inside 50" },
      { key: "onePercenters", label: "One Percenters" },
      { key: "rebound50s", label: "Rebound 50s" },
    ],
  },
  {
    name: "Discipline & Errors",
    keys: [
      { key: "clangers", label: "Clangers" },
      { key: "freesFor", label: "Frees For" },
    ],
  },
  {
    name: "Interchange",
    keys: [
      { key: "totalInterchangeCount", label: "Total Interchanges" },
    ],
  },
];

const SPORT_GROUPS: Record<SportType, GroupDef[]> = {
  soccer: SOCCER_GROUPS,
  ncaa_basketball: BASKETBALL_GROUPS,
  ncaa_football: FOOTBALL_GROUPS,
  afl: AFL_GROUPS,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace("%", "").trim();
  if (cleaned.includes("-")) {
    const [made, attempted] = cleaned.split("-").map(Number);
    if (!isNaN(made) && !isNaN(attempted) && attempted > 0) {
      return (made / attempted) * 100;
    }
    return made || 0;
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function buildGroups(raw: RawStats, sport: SportType): StatGroup[] {
  const groupDefs = SPORT_GROUPS[sport] ?? SOCCER_GROUPS;
  return groupDefs
    .map((group) => {
      const stats: StatRow[] = group.keys
        .filter(
          ({ key }) =>
            raw.home[key] !== undefined || raw.away[key] !== undefined
        )
        .map(({ key, label }) => ({
          label,
          home: raw.home[key] ?? "0",
          away: raw.away[key] ?? "0",
          homeNum: parseNum(raw.home[key]),
          awayNum: parseNum(raw.away[key]),
        }));
      return { name: group.name, stats };
    })
    .filter((g) => g.stats.length > 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBar({
  stat,
  homeColor,
  awayColor,
}: {
  stat: StatRow;
  homeColor: string;
  awayColor: string;
}) {
  const total = stat.homeNum + stat.awayNum;
  const homeWidth = total > 0 ? (stat.homeNum / total) * 100 : 50;
  const awayWidth = total > 0 ? (stat.awayNum / total) * 100 : 50;
  const homeLeads = stat.homeNum > stat.awayNum;
  const awayLeads = stat.awayNum > stat.homeNum;

  return (
    <div className="px-4 py-1.5">
      <div className="flex items-center gap-3">
        <span
          className={`text-[12px] font-bold tabular-nums w-8 text-left ${homeLeads ? "text-white" : "text-dark-400"}`}
        >
          {stat.home}
        </span>

        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[12px] font-medium text-dark-400 text-center truncate">
            {stat.label}
          </span>
          <div className="flex items-center gap-0.5 h-1">
            <div className="flex-1 flex justify-end overflow-hidden rounded-l-full">
              <div
                className={`h-full rounded-l-full transition-all duration-700 ease-out ${homeLeads ? homeColor : "bg-dark-600"}`}
                style={{ width: `${homeWidth}%` }}
              />
            </div>
            <div className="flex-1 overflow-hidden rounded-r-full">
              <div
                className={`h-full rounded-r-full transition-all duration-700 ease-out ${awayLeads ? awayColor : "bg-dark-600"}`}
                style={{ width: `${awayWidth}%` }}
              />
            </div>
          </div>
        </div>

        <span
          className={`text-[12px] font-bold tabular-nums w-8 text-right ${awayLeads ? "text-white" : "text-dark-400"}`}
        >
          {stat.away}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MatchStatsProps {
  game: Game;
}

export default function MatchStats({ game }: MatchStatsProps) {
  const fetchStatsAction = useAction(api.sportsApi.fetchGameStats);
  const [rawStats, setRawStats] = useState<RawStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  useEffect(() => {
    setIsLoading(true);
    setRawStats(null);
    setHasError(false);

    const fetchStats = async () => {
      try {
        const result = await fetchStatsAction({
          externalId: game.externalId,
          leagueId: game.league.id,
          gameId: game.id,
        });
        setRawStats(result as any);
        setHasError(false);
      } catch (e) {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    if (game.status === "live" || game.status === "halftime") {
      const interval = setInterval(fetchStats, 60_000);
      return () => clearInterval(interval);
    }
  }, [game.externalId, game.league.id, game.status, fetchStatsAction]);

  const isMatchActive =
    game.status === "live" ||
    game.status === "halftime" ||
    game.status === "finished";

  if (isLoading) {
    return (
      <div className="border-t border-dark-700/50 px-6 py-6 flex items-center gap-3">
        <BarChart2 className="w-4 h-4 text-dark-500" />
        <span className="text-xs text-dark-500 uppercase tracking-wider font-semibold">Match Statistics</span>
        <Loader2 className="w-3.5 h-3.5 text-dark-600 animate-spin ml-auto" />
      </div>
    );
  }

  if (!isMatchActive) {
    return (
      <div className="border-t border-dark-700/50 px-6 py-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-dark-500" />
          <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Match Statistics</h3>
        </div>
        <p className="text-xs text-dark-500 text-center py-3">Stats will be available once the match begins.</p>
      </div>
    );
  }

  if (hasError || !rawStats || !rawStats.home || !rawStats.away) return null;

  const homePosRaw = rawStats.home["possessionPct"] ?? rawStats.home["possession"];
  const awayPosRaw = rawStats.away["possessionPct"] ?? rawStats.away["possession"];
  const homePos = parseNum(homePosRaw);
  const awayPos = parseNum(awayPosRaw);
  const hasPossession = homePos > 0 || awayPos > 0;

  const groups = buildGroups(rawStats, game.sport);

  if (!hasPossession && groups.length === 0) return null;

  const homeColor = "bg-primary-500";
  const awayColor = "bg-amber-500";

  return (
    <div className="border-t border-dark-700/50">
      <div className="px-6 pt-5 pb-3 flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-primary-500" />
        <h3 className="text-xs font-semibold text-dark-300 uppercase tracking-wider">Match Statistics</h3>
      </div>

      <div className="px-4 pb-5 space-y-3">
        {hasPossession && (
          <div className="bg-dark-800/60 rounded-xl border border-dark-700/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                <span className="text-base font-bold text-white tabular-nums">{homePosRaw ?? "0"}%</span>
              </div>
              <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider">Possession</span>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-white tabular-nums">{awayPosRaw ?? "0"}%</span>
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              </div>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
              <div className={`bg-primary-500 transition-all duration-700 ease-out`} style={{ width: `${homePos}%` }} />
              <div className={`bg-amber-500 transition-all duration-700 ease-out`} style={{ width: `${awayPos}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-dark-500 truncate">{game.homeTeam.shortName}</span>
              <span className="text-[11px] text-dark-500 truncate">{game.awayTeam.shortName}</span>
            </div>
          </div>
        )}

        {groups.map((group) => {
          const isExpanded = expandedGroups[group.name] || false;
          return (
            <div key={group.name} className="bg-dark-800/60 rounded-xl border border-dark-700/30 overflow-hidden">
              <button
                onClick={() => toggleGroup(group.name)}
                className="w-full px-4 py-2.5 border-b border-dark-700/30 flex items-center justify-between hover:bg-dark-700/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <Minus className="w-3 h-3 text-dark-500" />
                  ) : (
                    <Plus className="w-3 h-3 text-dark-500" />
                  )}
                  <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest">{group.name}</span>
                </div>
              </button>
              {isExpanded && (
                <div className="divide-y divide-dark-700/20">
                  {group.stats.map((stat) => (
                    <StatBar key={stat.label} stat={stat} homeColor={homeColor} awayColor={awayColor} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

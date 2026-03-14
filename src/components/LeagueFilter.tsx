"use client";

import { SportType, ALL_LEAGUES, SOCCER_LEAGUES, NCAA_LEAGUES } from "@/types";
import { Trophy, Dribbble, GraduationCap, Filter, X } from "lucide-react";

interface LeagueFilterProps {
  selectedLeagues: string[];
  onToggleLeague: (leagueId: string) => void;
  onClearLeagues: () => void;
  selectedSport: SportType | "all";
  onChangeSport: (sport: SportType | "all") => void;
  rightSlot?: React.ReactNode;
}

const sportTabs: { id: SportType | "all"; label: string; icon: React.ReactNode }[] = [
  {
    id: "all",
    label: "All",
    icon: <Trophy className="w-4 h-4" />,
  },
  {
    id: "soccer",
    label: "Soccer",
    icon: <Dribbble className="w-4 h-4" />,
  },
  {
    id: "ncaa_football",
    label: "NCAAF",
    icon: <GraduationCap className="w-4 h-4" />,
  },
  {
    id: "ncaa_basketball",
    label: "NCAAB",
    icon: <GraduationCap className="w-4 h-4" />,
  },
];

export default function LeagueFilter({
  selectedLeagues,
  onToggleLeague,
  onClearLeagues,
  selectedSport,
  onChangeSport,
  rightSlot,
}: LeagueFilterProps) {
  const getVisibleLeagues = () => {
    switch (selectedSport) {
      case "soccer":
        return SOCCER_LEAGUES;
      case "ncaa_football":
      case "ncaa_basketball":
        return NCAA_LEAGUES.filter((l) => l.sport === selectedSport);
      default:
        return ALL_LEAGUES;
    }
  };

  const visibleLeagues = getVisibleLeagues();

  return (
    <div className="space-y-3">
      {/* Sport Tabs + Search Slot */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-dark-800/50 rounded-xl p-1 border border-dark-700/50 flex-1">
          {sportTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChangeSport(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedSport === tab.id
                  ? "bg-primary-600 text-white shadow-md shadow-primary-600/25"
                  : "text-dark-400 hover:text-dark-200 hover:bg-dark-700/50"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>

      {/* League Chips */}
      <div className="flex flex-wrap gap-2">
        {visibleLeagues.map((league) => {
          const isSelected = selectedLeagues.includes(league.id);
          return (
            <button
              key={league.id}
              onClick={() => onToggleLeague(league.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                isSelected
                  ? "bg-primary-600/20 border-primary-500/50 text-primary-300"
                  : "bg-dark-800/50 border-dark-700/50 text-dark-400 hover:text-dark-200 hover:border-dark-600/50"
              }`}
            >
              <span>{league.shortName}</span>
              {isSelected && <X className="w-3 h-3" />}
            </button>
          );
        })}
        {selectedLeagues.length > 0 && (
          <button
            onClick={onClearLeagues}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-dark-500 hover:text-dark-300 transition-colors"
          >
            <Filter className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

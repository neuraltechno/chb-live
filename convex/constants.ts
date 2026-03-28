import { SportType, League } from "../src/types";

export const SOCCER_LEAGUES: League[] = [
  {
    id: "pl",
    name: "Premier League",
    shortName: "PL",
    logo: "/leagues/premier-league.png",
    country: "England",
    sport: "soccer",
  },
  {
    id: "laliga",
    name: "La Liga",
    shortName: "LaLiga",
    logo: "/leagues/la-liga.png",
    country: "Spain",
    sport: "soccer",
  },
  {
    id: "bundesliga",
    name: "Bundesliga",
    shortName: "BL",
    logo: "/leagues/bundesliga.png",
    country: "Germany",
    sport: "soccer",
  },
  {
    id: "seriea",
    name: "Serie A",
    shortName: "SA",
    logo: "/leagues/serie-a.png",
    country: "Italy",
    sport: "soccer",
  },
  {
    id: "ligue1",
    name: "Ligue 1",
    shortName: "L1",
    logo: "/leagues/ligue-1.png",
    country: "France",
    sport: "soccer",
  },
  {
    id: "ucl",
    name: "UEFA Champions League",
    shortName: "UCL",
    logo: "/leagues/ucl.png",
    country: "Europe",
    sport: "soccer",
  },
];

export const NCAA_LEAGUES: League[] = [
  {
    id: "ncaa_fb",
    name: "NCAA Football",
    shortName: "NCAAF",
    logo: "/leagues/ncaa-football.png",
    country: "USA",
    sport: "ncaa_football",
  },
  {
    id: "ncaa_bb",
    name: "NCAA Basketball",
    shortName: "NCAAB",
    logo: "/leagues/ncaa-basketball.png",
    country: "USA",
    sport: "ncaa_basketball",
  },
];

export const AFL_LEAGUES: League[] = [
  {
    id: "afl",
    name: "AFL",
    shortName: "AFL",
    logo: "/leagues/afl.png",
    country: "Australia",
    sport: "afl",
  },
];

export const ALL_LEAGUES: League[] = [
  ...SOCCER_LEAGUES,
  ...NCAA_LEAGUES,
  ...AFL_LEAGUES,
];

export const ESPN_SPORT_SLUGS: Record<string, string> = {
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

export const SPORT_DATE_WINDOWS: Record<
  SportType,
  { pastDays: number; futureDays: number }
> = {
  soccer: { pastDays: 2, futureDays: 3 },
  ncaa_football: { pastDays: 1, futureDays: 2 },
  ncaa_basketball: { pastDays: 1, futureDays: 2 },
  afl: { pastDays: 2, futureDays: 4 },
};

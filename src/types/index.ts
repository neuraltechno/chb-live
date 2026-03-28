// =============================================
// Gamebloc - Core Type Definitions
// =============================================

// ---------- User ----------
export interface FavoriteTeam {
  teamId: string;
  name: string;
  shortName: string;
  logo: string;
  sport?: SportType;
}

export interface User {
  _id: string;
  username: string;
  email: string;
  password?: string;
  avatar?: string;
  bio?: string;
  provider: "credentials" | "google";
  favoriteTeams: FavoriteTeam[];
  hiddenActivityTeams: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserPublic {
  _id: string;
  username: string;
  avatar?: string;
  bio?: string;
  favoriteTeams?: FavoriteTeam[];
}

export interface TeamActivity {
  teamName: string;
  teamLogo: string;
  count: number;
  hidden: boolean;
}

export interface UserProfile {
  _id: string;
  username: string;
  email?: string; // only for own profile
  avatar?: string;
  bio?: string;
  provider?: string; // only for own profile
  favoriteTeams: FavoriteTeam[];
  hiddenActivityTeams: string[];
  teamActivity: TeamActivity[];
  joinedAt: string;
}

// ---------- Message / Chat ----------
export interface ReplyInfo {
  _id: string;
  content: string;
  username: string;
}

export interface Message {
  _id: string;
  gameId: string;
  user: UserPublic;
  content: string;
  type: "text" | "reaction";
  replyTo?: ReplyInfo;
  createdAt: string;
}

export interface ChatRoom {
  gameId: string;
  activeUsers: number;
  messages: Message[];
}

// ---------- Sports / Games ----------
export type SportType = "soccer" | "ncaa_football" | "ncaa_basketball" | "afl";

export type GameStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "cancelled";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  score?: number;
}

export interface Game {
  id: string;
  externalId: string;
  sport: SportType;
  league: League;
  homeTeam: Team;
  awayTeam: Team;
  status: GameStatus;
  startTime: string;
  minute?: number;
  venue?: string;
  round?: string; // e.g. "Knockout Round Playoffs", "Quarterfinals", "Semifinals", "Final"
  leg?: string; // e.g. "1st Leg", "2nd Leg"
  seriesNote?: string; // e.g. "1st Leg" or aggregate score
  messageCount: number;
  activeUsers: number;
}

export interface League {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  country: string;
  sport: SportType;
}

// ---------- Predefined Leagues ----------
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

// ---------- API Football League IDs (RapidAPI) ----------
export const API_FOOTBALL_LEAGUE_IDS: Record<string, number> = {
  pl: 39, // Premier League
  laliga: 140, // La Liga
  bundesliga: 78, // Bundesliga
  seriea: 135, // Serie A
  ligue1: 61, // Ligue 1
  ucl: 2, // Champions League
};

// ---------- ESPN Sport Slugs (used for all API calls) ----------
export const ESPN_SPORT_SLUGS: Record<string, string> = {
  // Soccer
  pl: "soccer/eng.1",
  laliga: "soccer/esp.1",
  bundesliga: "soccer/ger.1",
  seriea: "soccer/ita.1",
  ligue1: "soccer/fra.1",
  ucl: "soccer/uefa.champions",
  // NCAA
  ncaa_fb: "football/college-football",
  ncaa_bb: "basketball/mens-college-basketball",
  afl: "australian-football/afl",
};

// ---------- Socket Events ----------
export const SOCKET_EVENTS = {
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  SEND_MESSAGE: "send_message",
  NEW_MESSAGE: "new_message",
  ROOM_USERS: "room_users",
  USER_JOINED: "user_joined",
  USER_LEFT: "user_left",
  TYPING: "typing",
  STOP_TYPING: "stop_typing",
  USER_TYPING: "user_typing",
  GAME_UPDATE: "game_update",
  ERROR: "error",
} as const;

// ---------- Component Props ----------
export interface MatchCardProps {
  game: Game;
  onClick?: (game: Game) => void;
}

export interface ChatWindowProps {
  gameId: string;
  game: Game;
}

export interface LeagueFilterProps {
  selectedLeagues: string[];
  onToggleLeague: (leagueId: string) => void;
  selectedSport: SportType | "all";
  onChangeSport: (sport: SportType | "all") => void;
}

// ---------- Direct Messages ----------
export interface DMParticipant {
  _id: string;
  username: string;
  avatar?: string;
}

export interface DMMessage {
  _id: string;
  conversationId: string;
  sender: DMParticipant;
  content: string;
  replyTo?: ReplyInfo;
  createdAt: string;
  readBy: string[];
}

export interface DMConversation {
  _id: string;
  participants: DMParticipant[]; // other participants (not current user)
  lastMessage?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  unreadCount: number;
  createdAt: string;
}

// ---------- API Responses ----------
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface GamesResponse {
  games: Game[];
  lastUpdated: string;
}

export interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
  total: number;
}

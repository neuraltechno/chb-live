import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "Sync sports games from ESPN",
  { minutes: 1 },
  internal.sync.syncAllLeagues,
  { deep: false }
);

crons.daily(
  "Full deep sync of all rounds",
  { hourUTC: 18, minuteUTC: 0 }, // 18:00 UTC = 4:00 AM AEST / 5:00 AM AEDT
  internal.sync.syncAllLeagues,
  { deep: true }
);

export default crons;

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "Sync sports games from ESPN",
  { minutes: 1 },
  internal.sync.syncAllLeagues
);

export default crons;

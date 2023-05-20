import { CronJob } from "cron"
import { main as runCalendar } from "./src/index.ts"
import { log } from "./src/logger.ts"

log.info("Starting cron daemon")
new CronJob(
  "*/15 * * * *",
  runCalendar,
  null,
  true,
  "Europe/Berlin",
  this,
  true
)

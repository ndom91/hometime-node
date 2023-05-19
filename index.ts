import { CronJob } from "cron"
import { main as runCalendar } from "./src/index.ts"

console.log("Start cron daemon")
new CronJob(
  "*/15 * * * * *",
  runCalendar,
  null,
  true,
  "Europe/Berlin",
  this,
  true
)

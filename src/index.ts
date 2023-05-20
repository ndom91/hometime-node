await import("dotenv/config")
import { log } from "./logger.ts"
import { GoogleAuth } from "google-auth-library"
import { google, calendar_v3 } from "googleapis"
import { WLEDClient, WLEDClientSegment } from "wled-client"
import {
  differenceInMinutes,
  formatISO,
  isToday,
  set,
  startOfToday,
} from "date-fns"

import {
  insertNewEventAtTime,
  convertToTimezoneISOString,
  // getEndOfToday,
  // getStartOfToday,
} from "./helpers.ts"

import type { EventsToday } from "./types.ts"
import { JSONClient } from "google-auth-library/build/src/auth/googleauth.js"

if (process.env.DEBUG) {
  log.enableAll()
} else {
  log.setLevel("INFO")
}

// ***********************
// *      VARIABLES
// ***********************

const brightnessMultiplier = 1.0 // between 0.0-1.0
const dryRun = false
const wledCount = 100

// const ledStartTime = getStartOfToday() // 00:00
const ledStartTime = set(new Date(), { hours: 10, minutes: 0 })

// const ledEndTime = getEndOfToday()  // 23:59
const ledEndTime = set(new Date(), { hours: 22, minutes: 0 })

log.debug("DAY START", ledStartTime)
log.debug("DAY END", ledEndTime)

const startOfWorkDay = set(new Date(), { hours: 11, minutes: 0 })
const endOfWorkDay = set(new Date(), { hours: 19, minutes: 30 })

// 1 LED = ${resolution} minutes
const resolution = Math.ceil(
  (ledEndTime.getTime() - ledStartTime.getTime()) / 1000 / 60 / wledCount
)
log.debug(
  "MINS IN RANGE",
  (ledEndTime.getTime() - ledStartTime.getTime()) / 1000 / 60
)
log.debug("MINS RESOLUTION", resolution)

// ***********************
// *   END OF VARIABLES
// ***********************

const useWled = async (host?: string) => {
  if (!host && !process.env.WLED_HOST) {
    log.error("No host defined, exiting")
    process.exit(0)
  }
  const wled = new WLEDClient(host ?? process.env.WLED_HOST ?? "")
  await wled.init()
  log.debug("** WLED State: ", JSON.stringify(wled.state, null, 2))

  return {
    state: wled.state,
    info: wled.info,
    clear: async () => {
      await wled.clearSegments()
    },
    updateSegments: async (segments: WLEDClientSegment[]) => {
      log.debug("Setting segments:", segments)
      wled.updateState({
        on: true,
        brightness: brightnessMultiplier * 100,
        mainSegmentId: 0,
        segments,
      })
    },
    updateRaw: async (state: WLEDClientSegment) => {
      log.debug("** Setting state:", JSON.stringify(state, null, 2))
      wled.updateState(state)
    },
  }
}

const useCalendar = async () => {
  const auth = new GoogleAuth({
    keyFilename: "pufendorf-hometime-d41200cb0df3.json",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  })

  // @ts-expect-error
  const client: GoogleAuth<JSONClient> = await auth.getClient()
  return google.calendar({ version: "v3", auth: client })
}

interface ValidDate extends calendar_v3.Schema$Event {
  summary: string
  start: {
    dateTime: string
  }
  end: {
    dateTime: string
  }
}

const getEventsToday = (list: calendar_v3.Schema$Events): EventsToday[] => {
  if (!list.items) throw new Error("GCal returned no items")

  return list.items
    .filter(
      (event): event is ValidDate =>
        !!event.end &&
        !!event.start &&
        !!event.start.dateTime &&
        isToday(new Date(event.start.dateTime))
    )
    .map((event) => {
      return {
        name: event.summary,
        startTime: convertToTimezoneISOString(new Date(event.start.dateTime)),
        endTime: convertToTimezoneISOString(new Date(event.end.dateTime)),
      }
    })
}

const constructSegments = (
  eventsToday: EventsToday[],
  maxCount: number
): WLEDClientSegment[] => {
  const nonEventSegment: WLEDClientSegment = {
    start: 0,
    effectId: 65, // 12
    effectSpeed: 150, // 0-255
    effectIntensity: 1, // 0-255
    paletteId: 45, // 28
    brightness: brightnessMultiplier * 40,
  }

  // SPECIAL SEGMENTS
  // https://kno.wled.ge/features/effects/
  let allEventsToday

  // 1. NOW segment
  allEventsToday = insertNewEventAtTime({
    resolution,
    events: eventsToday,
    start: new Date(),
    color: [
      [120, 0, 0],
      [0, 120, 0],
    ],
    brightness: brightnessMultiplier * 255,
    // color: [[120, 0, 0], [0, 0, 120]],
    effectId: 12,
    //   effectSpeed: 26,
    //   effectIntensity: 156,
    //   // paletteId: 11
  })

  // 2. START OF WORK DAY
  allEventsToday = insertNewEventAtTime({
    resolution,
    events: allEventsToday,
    start: startOfWorkDay,
    brightness: brightnessMultiplier * 255,
    // color: [[175, 175, 90]]
    color: [[120, 0, 0]],
  })

  // 3. END OF WORK DAY
  allEventsToday = insertNewEventAtTime({
    resolution,
    events: allEventsToday,
    start: endOfWorkDay,
    brightness: brightnessMultiplier * 255,
    // color: [[175, 175, 90]]
    color: [[120, 0, 0]],
  })

  log.debug("RAW EVENTS TODAY: ", allEventsToday)

  const eventsTodaySegments: WLEDClientSegment[] = allEventsToday.map(
    (event) => {
      const ledsToStartTime =
        differenceInMinutes(new Date(event.startTime), ledStartTime, {
          roundingMethod: "ceil",
        }) / resolution
      const ledsLength =
        differenceInMinutes(
          new Date(event.endTime),
          new Date(event.startTime),
          { roundingMethod: "ceil" }
        ) / resolution
      return {
        start: Math.floor(ledsToStartTime),
        stop: Math.floor(ledsToStartTime + ledsLength + 1),
        colors: event.color ?? [[200, 30, 30]],
        effectId: event.effectId ?? 0,
        effectSpeed: event.effectSpeed ?? 0,
        effectIntensity: event.effectIntensity ?? 0,
        paletteId: event.paletteId ?? 0,
      }
    }
  )

  // Interleave events array with "empty color" segments
  return eventsTodaySegments
    .reduce(
      (result, element, index, array) => {
        result.push(element)
        if (index < array.length - 1) {
          result.push(structuredClone(nonEventSegment))
        }
        if (index === array.length - 1) {
          result.push(structuredClone(nonEventSegment))
        }
        return result
      },
      [structuredClone(nonEventSegment)]
    )
    .map((element, index, array) => {
      if (element.start === 0) {
        if (index === 0) {
          // First element in array
          element.stop = array[index + 1].start
        } else if (index === array.length - 1) {
          // Last element in array
          element.start = array[index - 1].stop || 0
          element.stop = maxCount
        } else {
          // Rest of elements
          element.start = array[index - 1]?.stop || 0
          element.stop = array[index + 1].start
        }
      }
      return element
    })
}

const main = async (): Promise<void> => {
  try {
    const wled = await useWled()
    const calendar: calendar_v3.Calendar = await useCalendar()

    const list = await calendar.events.list({
      calendarId: "primary",
      timeMin: formatISO(startOfToday()),
      maxResults: 15,
      singleEvents: true,
      orderBy: "startTime",
    })

    const eventsToday = getEventsToday(list.data)
    log.debug("Events Today", eventsToday)

    const segments = constructSegments(eventsToday, wled.info.leds.count ?? 100)

    log.info("Updating WLED segments", new Date().toISOString())
    !dryRun && (await wled.updateSegments(segments))
  } catch (error) {
    log.error(error)
  }
}

if (process.argv.includes("main")) {
  main()
}

export { main }

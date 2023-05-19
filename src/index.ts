await import("dotenv/config")
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
import { insertNewEventAtTime, convertToTimezoneISOString } from "./helpers.ts"

import type { EventsToday } from "./types.ts"
import { JSONClient } from "google-auth-library/build/src/auth/googleauth.js"

const isProd = process.env.NODE_ENV === "production"
const brightnessMultiplier = 1.0 // between 0.0 - 1.0

const useWled = async (host?: string) => {
  if (!host && !process.env.WLED_HOST) {
    console.error("No host defined, exiting")
    process.exit(0)
  }
  const wled = new WLEDClient(host ?? process.env.WLED_HOST ?? "")
  await wled.init()
  !isProd &&
    console.debug("** WLED State: ", JSON.stringify(wled.state, null, 2))

  return {
    state: wled.state,
    info: wled.info,
    clear: async () => {
      await wled.clearSegments()
    },
    updateSegments: async (segments: WLEDClientSegment[]) => {
      !isProd && console.debug("** Setting segments:", segments)
      wled.updateState({
        on: true,
        // brightness: brightnessMultiplier * 100,
        // mainSegmentId: 0,
        segments,
      })
    },
    updateRaw: async (state: WLEDClientSegment) => {
      !isProd &&
        console.debug("** Setting state:", JSON.stringify(state, null, 2))
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
    effectSpeed: 150, // 0 - 255
    effectIntensity: 1, // 0 - 255
    paletteId: 45, // 28
    brightness: brightnessMultiplier * 40,
  }

  // SPECIAL SEGMENTS
  // https://kno.wled.ge/features/effects/
  let allEventsToday

  // 1. NOW segment
  allEventsToday = insertNewEventAtTime({
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
    events: allEventsToday,
    start: set(new Date(), { hours: 09, minutes: 0 }),
    brightness: brightnessMultiplier * 255,
    // color: [[175, 175, 90]]
    color: [[120, 0, 0]],
  })

  // 3. END OF WORK DAY
  allEventsToday = insertNewEventAtTime({
    events: allEventsToday,
    start: set(new Date(), { hours: 19, minutes: 30 }),
    brightness: brightnessMultiplier * 255,
    // color: [[175, 175, 90]]
    color: [[120, 0, 0]],
  })

  !isProd && console.debug("** ALL RAW EVENTS TODAY: ", allEventsToday)

  const eventsTodaySegments: WLEDClientSegment[] = allEventsToday.map(
    (event) => {
      const ledsToStartTime =
        differenceInMinutes(new Date(event.startTime), startOfToday(), {
          roundingMethod: "ceil",
        }) / 15
      const ledsLength =
        differenceInMinutes(
          new Date(event.endTime),
          new Date(event.startTime),
          { roundingMethod: "ceil" }
        ) / 15
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
    const segments = constructSegments(eventsToday, wled.info.leds.count ?? 100)

    console.log("Updating WLED segments", new Date().toISOString())
    await wled.updateSegments(segments)
  } catch (error) {
    console.error(`[ERR] ${error}`)
  }
}

export { main }

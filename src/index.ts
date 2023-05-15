await import("dotenv/config")
// eslint-disable-next-line
// @ts-expect-error
import { authorize } from "./calendar.cjs"
import { differenceInMinutes, formatISO, isToday, set, startOfToday } from 'date-fns'
import { WLEDClient, WLEDClientSegment } from 'wled-client'
import { Auth, google, calendar_v3 } from "googleapis"
import { insertNewEventAtTime, convertToTimezoneISOString } from './helpers.ts'
import type { EventsToday } from './types.ts'

const brightnessMultiplier = 1.0 // between 0.0 - 1.0

const useWled = async (host?: string) => {
  if (!host && !process.env.WLED_HOST) {
    console.error('No host defined, exiting')
    process.exit(0)
  }
  const wled = new WLEDClient(host ?? process.env.WLED_HOST ?? '')
  await wled.init()
  // console.log("WLED STATE", JSON.stringify(wled.state, null, 2))

  const methods = {
    state: wled.state,
    info: wled.info,
    clear: async () => {
      await wled.clearSegments()
    },
    updateSegments: async (segments: WLEDClientSegment[]) => {
      console.debug('Setting segments:', segments)
      wled.updateState({
        on: true,
        // brightness: brightnessMultiplier * 100,
        // mainSegmentId: 0,
        segments
      })
    },
    updateRaw: async (state: WLEDClientSegment) => {
      // console.debug('Setting state:', JSON.stringify(state, null, 2))
      wled.updateState(state)
    }
  }
  return methods
}

const useCalendar = async () => {
  const auth: Auth.OAuth2Client = await authorize()
  return google.calendar({ version: 'v3', auth });
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
  if (!list.items) throw new Error('GCal returned now items')

  return list.items.filter((event): event is ValidDate =>
    !!event.end &&
    !!event.start &&
    !!event.start.dateTime && isToday(new Date(event.start.dateTime))
  ).map((event) => {
    return {
      name: event.summary,
      startTime: convertToTimezoneISOString(new Date(event.start.dateTime)),
      endTime: convertToTimezoneISOString(new Date(event.end.dateTime))
    }
  })
}

const constructSegments = (eventsToday: EventsToday[], maxCount: number): WLEDClientSegment[] => {
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

  // 1. NOW segment
  const events1 = insertNewEventAtTime({
    events: eventsToday,
    dateTime: new Date(),
    color: [[120, 0, 0], [0, 120, 0]],
    brightness: brightnessMultiplier * 255,
    // color: [[120, 0, 0], [0, 0, 120]],
    effect: {
      effectId: 12,
      //   effectSpeed: 26,
      //   effectIntensity: 156,
      //   // paletteId: 11
    }
  })

  // 2. START OF WORK DAY
  const events2 = insertNewEventAtTime({
    events: events1,
    dateTime: set(new Date(), { hours: 09, minutes: 0 }),
    brightness: brightnessMultiplier * 255,
    // color: [[175, 175, 90]]
    color: [[120, 0, 0]],
  })

  // 3. END OF WORK DAY
  const allEventsToday = insertNewEventAtTime({
    events: events2,
    dateTime: set(new Date(), { hours: 19, minutes: 30 }),
    brightness: brightnessMultiplier * 255,
    // color: [[175, 175, 90]]
    color: [[120, 0, 0]],
  })

  console.debug('ALL EVENTS TODAY', allEventsToday)

  const eventsTodaySegments: WLEDClientSegment[] = allEventsToday.map(event => {
    const ledsToStartTime = differenceInMinutes(new Date(event.startTime), startOfToday(), { roundingMethod: 'ceil' }) / 15
    const ledsLength = differenceInMinutes(new Date(event.endTime), new Date(event.startTime), { roundingMethod: 'ceil' }) / 15
    return {
      start: Math.floor(ledsToStartTime),
      stop: Math.floor(ledsToStartTime + ledsLength + 1),
      colors: event.color ?? [[200, 30, 30]],
      effectId: event.effectId ?? 0,
      effectSpeed: event.effectSpeed ?? 0,
      effectIntensity: event.effectIntensity ?? 0,
      paletteId: event.paletteId ?? 0,
    }
  })

  // Interleave events array with "empty color" segments
  return eventsTodaySegments
    .reduce((result, element, index, array) => {
      result.push(element);
      if (index < array.length - 1) {
        result.push(structuredClone(nonEventSegment))
      }
      if (index === array.length - 1) {
        result.push(structuredClone(nonEventSegment))
      }
      return result;
    }, [structuredClone(nonEventSegment)])
    .map((element, index, array) => {
      if (element.start === 0) {
        if (index === 0) {
          // First element in array
          element.stop = array[index + 1].start
        } else if (index === array.length - 1) {
          // Last element in array
          element.start = (array[index - 1].stop || 0)
          element.stop = maxCount
        } else {
          // Rest of elements
          element.start = (array[index - 1]?.stop || 0)
          element.stop = array[index + 1].start
        }
      }
      return element
    })

}

try {
  const wled = await useWled()
  const calendar: calendar_v3.Calendar = await useCalendar()

  const list = await calendar.events.list({
    calendarId: 'primary',
    timeMin: formatISO(startOfToday()),
    maxResults: 15,
    singleEvents: true,
    orderBy: 'startTime',
  })

  const eventsToday = getEventsToday(list.data)
  const segments = constructSegments(eventsToday, wled.info.leds.count ?? 100)

  await wled.updateSegments(segments)
} catch (error) {
  console.error(`[ERR] ${error}`)
}

await import("dotenv/config")
import { differenceInMinutes, formatISO, isToday, startOfToday } from 'date-fns'
import { RGBColor, WLEDClient, WLEDClientSegment } from 'wled-client'
import { Auth, google, calendar_v3 } from "googleapis"
// eslint-disable-next-line
// @ts-expect-error
import { authorize } from "./calendar.cjs"
import { useSegments } from './segment-constants.ts'

import type { EventsToday } from './types.ts'

const useWled = async (host?: string) => {
  if (!host && !process.env.WLED_HOST) {
    console.error('No host defined, exiting')
    process.exit(0)
  }
  const wled = new WLEDClient(host ?? process.env.WLED_HOST ?? '')
  await wled.init()

  const methods = {
    clear: async () => {
      await wled.clearSegments()
    },

    state: wled.state,
    info: wled.info,

    updateRaw: async (state: WLEDClientSegment) => {
      console.debug('Setting state:', JSON.stringify(state, null, 2))
      wled.updateState(state)

      // wled.updateState({
      //   on: true,
      //   brightness: 255,
      //   mainSegmentId: 0,
      //   segments: [
      //     {
      //       effectId: 0,
      //       colors: [[255, 255, 255]],
      //       start: 0,
      //       stop: wled.info.leds.count
      //     }
      //   ]
      // })
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
      startTime: event.start.dateTime,
      endTime: event.end.dateTime
    }
  })
}

const constructSegments = (eventsToday: EventsToday[]): WLEDClientSegment[] => {
  const nonEventSegment: WLEDClientSegment = {
    start: 0,
    offset: 0,
    colors: [[196, 182, 112]],
  }

  const eventsTodaySegments: WLEDClientSegment[] = eventsToday.map(event => {
    const ledsToStartTime = differenceInMinutes(new Date(event.startTime), startOfToday()) / 15
    const ledsLength = differenceInMinutes(new Date(event.endTime), new Date(event.startTime)) / 15
    return {
      start: ledsToStartTime,
      stop: ledsToStartTime + ledsLength + 1, // Stop is non-inclusive
      colors: [[39, 62, 163]],
    }
  })

  console.log('eventsTodaySegments', eventsTodaySegments)

  // Interleave events array with "empty color" segments
  return eventsTodaySegments.reduce((result, element, index, array) => {
    result.push(element);
    if (index < array.length - 1) {
      result.push(nonEventSegment);
    }
    if (index === array.length - 1) {
      result.push(nonEventSegment);
    }
    if (index !== 0) {
      // result.start = 0
    }
    return result;
  }, [nonEventSegment])

}

try {
  const wled = await useWled()
  const calendar: calendar_v3.Calendar = await useCalendar()
  // const { TRACE_FULL } = useSegments(wled.info) // DEBUGGING TRACER EFFECT

  // console.log("WLED STATE", JSON.stringify(wled.state, null, 2))

  const list = await calendar.events.list({
    calendarId: 'primary',
    timeMin: formatISO(startOfToday()),
    maxResults: 15,
    singleEvents: true,
    orderBy: 'startTime',
  })

  const eventsToday = getEventsToday(list.data)

  // console.log('EVENTSTODAY', eventsToday)

  const segments = constructSegments(eventsToday)
  console.log('SEGMENTS', segments)

  // await wled.updateRaw({
  //   start: 0,
  //   brightness: 32
  // })
} catch (error) {
  console.error(`[ERR] ${error}`)
}

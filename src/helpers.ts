import { formatISO, subMinutes, roundToNearestMinutes } from 'date-fns'
import type { EventsToday, InsertEventArgs } from './types.ts'

export const sleep = (timeout: number) => new Promise(res => setTimeout(res, timeout))

export const convertToTimezoneISOString = (date: Date) => {
  const timeZone = 'Europe/Berlin'
  const options = { timeZone };
  const localizedDateString = date.toLocaleString('en-US', options);
  const convertedDate = new Date(localizedDateString);
  const out = formatISO(convertedDate)
  return out
}

export function insertNewEventAtTime({ events, dateTime, color, brightness, effectId, effectSpeed, effectIntensity, paletteId }: InsertEventArgs): EventsToday[] {
  const newEvent = {
    color: color ?? [[120, 0, 0]],
    startTime: convertToTimezoneISOString(new Date(roundToNearestMinutes(dateTime, { roundingMethod: 'trunc', nearestTo: 15 }))),
    endTime: convertToTimezoneISOString(new Date(subMinutes(roundToNearestMinutes(dateTime, { roundingMethod: 'ceil', nearestTo: 15 }), 10))),
    brightness: brightness ?? 50,
    effectId,
    effectIntensity,
    effectSpeed,
    paletteId
  } as EventsToday;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (dateTime >= new Date(event.startTime) && dateTime <= new Date(event.endTime)) {
      // The current time falls within an existing event, so we don't need to insert a new event.
      return events;
    }

    if (dateTime < new Date(event.startTime)) {
      // The current time is before the current event, so we insert the new event at this position.
      events.splice(i, 0, newEvent);
      return events;
    }
  }
  // The current time is after all existing events, so we append the new event to the end of the array.
  events.push(newEvent);

  return events;
}

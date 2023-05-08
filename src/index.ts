import type { RgbColor, WledState } from './types'
import { WLEDClient } from 'wled-client'
// import { calendar } from "@googleapis/calendar"
import { google } from "googleapis"
import { authorize } from "./calendar.cjs"

const useWled = () => {
  const wled = new WLEDClient(process.env.WLED_DEVICE_HOST!)

  const init = async () => {
    await wled.init()
  }

  const clear = async () => {
    await wled.clearSegments()
  }

  const update = async (state: WledState) => {
    console.log('STATE', state)
    wled.updateState({
      on: true,
      brightness: 255,
      mainSegmentId: 0,
      segments: [
        {
          effectId: 0,
          colors: [[255, 255, 255]],
          start: 0,
          stop: wled.info.leds.count
        }
      ]
    })
  }

  return {
    init,
    clear,
    update
  }
}

const useCalendar = async () => {
  // const auth = new google.auth.GoogleAuth({
  //   keyFile: './google_oauth_client.json',
  //   scopes: ['https://www.googleapis.com/auth/calendar'],
  // });

  const client = authorize()
  const cal = google.calendar({ version: 'v3', auth: client });
  return cal
  // const res = await calendar.events.list({

  // return google.calendar({ version: 'v3', auth });
}

// const wled = useWled()
// console.log('WLED', wled)

const calendar = await useCalendar()
// console.log('CAL', calendar)

const list = await calendar.events.list({
  calendarId: 'primary',
})
console.log('LIST', list)

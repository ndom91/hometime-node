import type { RgbColor } from './types'
import { WLEDClient } from 'wled-client'
import { google } from 'googleapis'

const calendar = google.calendar('v3');

async function init() {
  const wled = new WLEDClient('192.168.0.123')
  await wled.init()

  console.log(wled.info.version) // 0.12.0
  return wled
}

const barcolor = [100, 0, 150] as RgbColor       // RGB for bar color
const eventcolor = [235, 121, 14] as RgbColor   // RGB for event color
let flip = false                   // Flip display(set to True if the strip runs from right to left)
const googlecalbool = true           // Boolean for whether to check google calendar page
// const led = machine.Pin("LED", machine.Pin.OUT)
// led.off()
// led.on()
// time.sleep(1)
const schedule = {
  "monday": [
    {
      "clockin": "9",
      "clockout": "17"
    }
  ],
  "tuesday": [
    {
      "clockin": "9",
      "clockout": "17"
    }
  ],
  "wednesday": [
    {
      "clockin": "9",
      "clockout": "17"
    }
  ],
  "thursday": [
    {
      "clockin": "9",
      "clockout": "17"
    }
  ],
  "friday": [
    {
      "clockin": "9",
      "clockout": "17"
    }
  ],
  "saturday": [
    {
      "clockin": "0",
      "clockout": "0"
    }
  ],
  "sunday": [
    {
      "clockin": "0",
      "clockout": "23"
    }
  ]
}
// function whatday(weekday: number): string {
const whatday = (weekday: number): string => {
  const dayindex: number = weekday;
  const nameofday: string[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const day: string = nameofday[dayindex];
  return day;
}

const bar = (wled: WLEDClient, upto: number) => {
  let barupto = hourtoindex(upto);
  for (let i: number = 0; i < n; i++) {
    if (flip === true) {
      if (i >= barupto) {
        wled[i] = barcolor;
      } else {
        wled[i] = [0, 0, 0];
      }
    } else {
      if (i <= barupto) {
        wled[i] = barcolor;
      } else {
        wled[i] = [0, 0, 0];
      }
    }
  }
}

const addevents = (wled: WLEDClient, response: number[]) => {
  for (let x: number = 0; x < response.length; x++) {
    let index = hourtoindex(x);
    if (valid(index)) {
      wled[index] = eventcolor;
    }
  }
}

const valid = (index: number) => {
  let valid: boolean = false;
  if (index <= n && index > 0) {
    valid = true;
  }
  return valid;
}

const hourtoindex = (hoursin: number): number => {
  let index = Math.floor(n * (hoursin - clockin) / (clockout - clockin))
  if (flip) {
    index = n - 1 - index
  }
  if (index <= 1 || index >= n) {
    index = -1
  }
  return index
}

const eventnow = (hoursin: number, response: number[]): boolean => {
  let event = false
  for (let x of response) {
    if (hourtoindex(x) == hourtoindex(hoursin)) {
      event = true
    }
  }
  return event
}

const wheel = (pos: number): [number, number, number] => {
  // Input a value 0 to 255 to get a color value.
  // The colours are a transition r - g - b - back to r.
  let r: number;
  let g: number;
  let b: number;
  if (pos < 0 || pos > 255) {
    r = g = b = 0;
  } else if (pos < 85) {
    r = pos * 3;
    g = 255 - pos * 3;
    b = 0;
  } else if (pos < 170) {
    pos -= 85;
    r = 255 - pos * 3;
    g = 0;
    b = pos * 3;
  } else {
    pos -= 170;
    r = 0;
    g = pos * 3;
    b = 255 - pos * 3;
  }
  return [r, g, b];
}

function rainbow_cycle(wled) {
  for (let j = 0; j < 255; j++) {
    for (let i = 0; i < n; i++) {
      const pixel_index = (i * 256 / n) + j
      wled.setPixelColor(i, wheel(pixel_index & 255))
    }
    wled.show()
  }
}

function atwork(clockin: number, clockout: number, time: number) {
  let index = -1
  if (clockin != clockout) {
    index = hourtoindex(time)
  }
  let work = false
  if (index > -1) {
    work = true
  }
  return work
}

const todayseventsurl = 'http://metrics.puff.lan' // secrets.LANURL;
let count = 1;
let firstrun = true;
let shonetoday = true;
console.log(new Date());

while (true) {
  try {
    let firstrun = true;
    let shonetoday = false;
    let count = 0;
    let eventbool = false;
    let wled = await init()
    const wledLength = wled.state.segments[0].length ?? 0
    let now = new Date()
    let dayname = whatday(now[6]);
    let clockin = parseFloat(schedule[dayname][0]['clockin']);
    let clockout = parseFloat(schedule[dayname][0]['clockout']);
    let hoursin = parseFloat(now[3]) + parseFloat(now[4]) / 60;
    console.log('working?');
    let working = atwork(clockin, clockout, hoursin);
    console.log(working, hoursin);
    if (working) {
      shonetoday = false;
      bar(wled, hoursin);
      const response = await fetch(todayseventsurl)
      const todaysEvents = await response.json();
      eventbool = eventnow(hoursin, todaysEvents);
      addevents(wled, todaysEvents);

      if (firstrun) {
        firstrun = false;
      }
      count = (count + 1) % 2;
      if (eventbool) {
        for (let i = 0; i < wledLength; i++) {
          // wled.setPixelColor(i, tuple(z * count for z in eventcolor));
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
      } else {
        // let ledindex = Math.min(hourtoindex(hoursin), n);
        // wled.setPixelColor(ledindex, tuple(z * count for z in barcolor));
      }
      // wled.show();
    }
    else {
      if (shonetoday === false) {
        console.log('Trying rainbow');
        rainbow_cycle(wled);
        shonetoday = true;
      }
    }
  } catch (e) {
    console.log(e)
  }
}

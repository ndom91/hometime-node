const worldtimeurl = "https://timeapi.io/api/TimeZone/zone?timeZone=Europe/Berlin"
const n = 100                        // Number of pixels on strip
const p = 15                         // GPIO pin that data line of lights is connected to
// barcolor = (41, 24, 54)     // RGB for bar color
const barcolor = 'rgb(100, 0, 150)'       // RGB for bar color
const eventcolor = 'rgb(235, 121, 14)'    // RGB for event color
const flip = false                   // Flip display(set to True if the strip runs from right to left)
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
function whatday(weekday: number): string {
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

// import { sleep } from "sleep";
// import { get } from "requests";
// import { RTC } from "machine";

async function set_time(worldtimeurl: string): number {
  // sleep(1);
  const response = await fetch(worldtimeurl);
  const parsed = await response.json();
  const datetime_str = parsed["currentLocalTime"]
  console.log(datetime_str);
  const year = parseInt(datetime_str.substring(0, 4));
  const month = parseInt(datetime_str.slice(5, 7));
  const day = parseInt(datetime_str.substring(8, 10), 10)
  const hour = parseInt(datetime_str.substring(11, 13), 10)
  const minute = parseInt(datetime_str.substring(14, 16), 10)
  const second = parseInt(datetime_str.substring(17, 19), 10)
  // const month = int(datetime_str[5: 7]);
  // const year = int(datetime_str[0: 4]);
  // const day = int(datetime_str[8: 10]);
  // const hour = int(datetime_str[11: 13]);
  // const minute = int(datetime_str[14: 16]);
  // const second = int(datetime_str[17: 19]);
  // // update internal RTC
  // RTC.datetime((year,
  //   month,
  //   day,
  //   0,
  //   hour,
  //   minute,
  //   second,
  //   0));
  const dow = time.localtime()[6];
  return dow;
}

bar(np: number[], upto: number) {
  let barupto: number = hourtoindex(upto);
  for (let i: number = 0; i < n; i++) {
    if (flip === true) {
      if (i >= barupto) {
        np[i] = barcolor;
      } else {
        np[i] = (0, 0, 0);
      }
    } else {
      if (i <= barupto) {
        np[i] = barcolor;
      } else {
        np[i] = (0, 0, 0);
      }
    }
  }
}

addevents(np: number[], response: number[]) {
  for (let x: number = 0; x < response.length; x++) {
    let index: number = hourtoindex(x);
    if (valid(index)) {
      np[index] = eventcolor;
    }
  }
}

valid(index: number) {
  let valid: boolean = false;
  if (index <= n && index > 0) {
    valid = true;
  }
  return valid;
}

function off(np: NeoPixelStrip) {
  for (let i = 0; i < n; i++) {
    np.setPixelColorRGB(i, 0, 0, 0)
    np.show()
  }
}
function hourtoindex(hoursin: number): number {
  let index = Math.floor(n * (hoursin - clockin) / (clockout - clockin))
  if (flip) {
    index = n - 1 - index
  }
  if (index <= 1 || index >= n) {
    index = -1
  }
  return index
}
function eventnow(hoursin: number, response: number[]): boolean {
  let event = false
  for (let x of response) {
    if (hourtoindex(x) == hourtoindex(hoursin)) {
      event = true
    }
  }
  return event
}

function wheel(pos: number): [number, number, number] {
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

function rainbow_cycle(np: neopixel.Strip) {
  for (let j = 0; j < 255; j++) {
    for (let i = 0; i < n; i++) {
      const pixel_index = (i * 256 / n) + j
      np.setPixelColor(i, wheel(pixel_index & 255))
    }
    np.show()
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

import * as network from "network";
import * as neopixel from "neopixel";
import * as machine from "machine";
import * as time from "time";
import * as secrets from "secrets";

let wlan = network.WLAN(network.STA_IF);
wlan.active(true);
wlan.connect(secrets.SSID, secrets.PASSWORD);
print(secrets.SSID, secrets.PASSWORD);
while (wlan.isconnected() !== true) {
  time.sleep(1);
  print("Not connecting to WiFi\nWaiting\n");
}
let np = neopixel.NeoPixel(machine.Pin(p), n);
let todayseventsurl = secrets.LANURL;
let count = 1;
let firstrun = true;
// When you plug in, update rather than wait until the stroke of the next minute
print("connected to WiFi: Start loop");
off(np);
let shonetoday = true;
led.off();
set_time(worldtimeurl);
print(time.localtime());

while (true) {
  try {
    let firstrun = true;
    let shonetoday = false;
    let count = 0;
    let eventbool = false;
    let wlan = network.WLAN(network.STA_IF);
    let np = neopixel.create(pin, 60, NeoPixelMode.RGB);
    let led = new DigitalPin(pin);
    let now = time.gmtime();
    let dayname = whatday(now[6]);
    let clockin = parseFloat(schedule[dayname][0]['clockin']);
    let clockout = parseFloat(schedule[dayname][0]['clockout']);
    let hoursin = parseFloat(now[3]) + parseFloat(now[4]) / 60;
    console.log('working?');
    let working = atwork(clockin, clockout, hoursin);
    console.log(working, hoursin);
    if (working) {
      shonetoday = false;
      bar(np, hoursin);
      if (googlecalbool) {
        let response = urequests.get(todayseventsurl).json();
        eventbool = eventnow(hoursin, response);
        addevents(np, response);
      }
      else {
        eventbool = false;
      }
      if (firstrun) {
        firstrun = false;
      }
      count = (count + 1) % 2;
      if (eventbool) {
        for (let i = 0; i < n; i++) {
          np.setPixelColor(i, tuple(z * count for z in eventcolor));
        }
      }
      else {
        let ledindex = Math.min(hourtoindex(hoursin), n);
        np.setPixelColor(ledindex, tuple(z * count for z in barcolor));
      }
      np.show();
    }
    else {
      // shonetoday = False # DEBUG
      if (shonetoday === false) {
        console.log('Trying rainbow');
        led.on();
        rainbow_cycle(np);
        shonetoday = true;
        off(np);
        time.sleep(600);
      }
    }
    if (wlan.isconnected() !== true) {
      wlan = network.WLAN(network.STA_IF);
      wlan.active(true);
      wlan.connect(secrets.SSID, secrets.PASSWORD);
      while (wlan.isconnected() !== true) {
        time.sleep(1);
        console.log("Not connecting to WiFi\nWaiting\n");
      }
    }
    if (now[5] === 0 && now[4] === 44 && now[3] === 4) {
      machine.reset();
    }
    time.sleep(1);
  } catch (e) {
    print(e)
    machine.reset()
    off(np)
  }
}

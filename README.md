# hometime-node

> Inspired by https://github.com/veebch/hometime

## Features

The idea is to use an LED Strip as a visual indicator for the course of your day. With colored marker for your current point in time, as well as blocks of color for your calendar events, like meetings and appointments. The original `hometime` project did most of what I wanted, but it ran most of the code, including all of the LED related control, on the Raspberry Pi Pico W, with a small Python script on the server for grabbing Google Calendar info.

I wanted more control of the LED and to be able to gather info and control the LED from a local server. So I got an ESP32 instead of a Pico W and flashed it with [WLED](). This has some great features out of the box, the most important of which is the JSON API. So this repository includes a Typescript script to communicate with Google Calendar, parse your daily schedule, and set the appropriate segments and colors on your WLED strip!

## Requirements

### Hardware

- ESP32
- WS812 LED Strip
- USB Power Supply

### Software

- Google Cloud Platform credentials and Google Calendar API enabled
- Node.js 18+

## Getting Started

1. Clone this repository

```sh
$ git clone https://github.com/ndom91/hometime-node.git
```
2. Install all dependencies

```sh
$ pnpm install
```

3. Setup your environment variables

```sh
$ cp .env.example .env
$ vim .env
```

4. Start the script!
```sh
$ pnpm start
```

## idea

That will execute one run of the script, but the idea is to run this on a relatively frequent cron job, like every 5 minutes. It should do the following:
- Fetch Google Calendar Events (and cache them)
- Parse the data
- Set the WLED segments
  - First Color 1 for the entire strip
  - Color 2 for the "busy"
  - 1 LED in Color 3 for "current time"
- Check if event is starting in the next 5 minutes
  - Blink in Color 3 exponentially stronger as we get to kick-off time
- After working hours, show pretty effect of choice
 
## License

MIT

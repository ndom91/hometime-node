import { WLEDClientSegment } from "wled-client"

declare type RGBColor = [number, number, number]
declare type RGBWColor = [number, number, number, number]

export type SegmentColor = (RGBColor | RGBWColor)[]

export interface EventsToday {
  name: string
  startTime: string
  endTime: string
  color?: SegmentColor
  brightness?: number
  effectId?: number
  effectSpeed?: number
  effectIntensity?: number
  paletteId?: number
}

export interface InsertEventArgs extends Omit<WLEDClientSegment, "start"> {
  resolution: number
  events: EventsToday[]
  color?: SegmentColor
  start: Date
}

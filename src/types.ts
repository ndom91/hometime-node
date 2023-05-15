declare type RGBColor = [number, number, number];
declare type RGBWColor = [number, number, number, number];

export type SegmentColor = (RGBColor | RGBWColor)[]

export interface EventsToday {
  name: string
  startTime: string
  endTime: string
  color?: SegmentColor,
  brightness?: number
  effectId?: number
  effectSpeed?: number
  effectIntensity?: number
  paletteId?: number
}

export interface InsertEventArgs {
  events: EventsToday[]
  dateTime: Date
  color?: SegmentColor
  brightness?: number
  effect?: {
    effectId?: number
    effectSpeed?: number
    effectIntensity?: number
    paletteId?: number
  }
}

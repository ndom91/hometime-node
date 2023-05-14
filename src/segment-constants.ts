import { WLEDClientInfo } from 'wled-client'

export const useSegments = (info: WLEDClientInfo) => {
  const TRACE_FULL = {
    start: 0,
    stop: info.leds.count,
    effectId: 40,
    effectSpeed: 26,
    effectIntensity: 156,
    paletteId: 11
  }
  return {
    TRACE_FULL,
  }
}

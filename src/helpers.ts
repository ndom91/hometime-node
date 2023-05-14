import type { EventsToday } from './types.ts'

export const sleep = (timeout: number) => new Promise(res => setTimeout(res, timeout))

export const interleaveArray = (arr: EventsToday[], value: any) => {
  return arr.reduce((result, element, index, array) => {
    result.push(element);
    if (index < array.length - 1) {
      result.push(value);
    }
    return result;
  }, []);
};

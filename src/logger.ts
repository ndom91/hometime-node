import log from "loglevel"
// @ts-expect-error
import LogMessagePrefix from "loglevel-plugin-prefix"
import { gray, magenta, cyan, blue, red, yellow } from "kleur/colors"

const prefix = LogMessagePrefix

const colors = {
  TRACE: magenta,
  DEBUG: cyan,
  INFO: blue,
  WARN: yellow,
  ERROR: red,
}

prefix.reg(log)
log.enableAll()

prefix.apply(log, {
  format(level: string, _: string | undefined, timestamp: string) {
    // @ts-expect-error
    return `${gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](level)}`
  },
})

export { log }

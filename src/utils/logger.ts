const PREFIX = '[MAL]'

// `debug` solo se ve en builds de desarrollo (`npm run dev`); warn/error siempre.
export const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.debug(PREFIX, ...args)
  },
  warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
  error: (...args: unknown[]) => console.error(PREFIX, ...args)
}

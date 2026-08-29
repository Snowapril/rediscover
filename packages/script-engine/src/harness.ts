/*
 * @brief The code that runs inside the sandbox around the user's function.
 * @details Kept as one string rather than assembled per call so that what
 *   executes is fixed and reviewable, and nothing the user wrote is ever
 *   interpolated into source. Their script is evaluated as its own module; this
 *   only reaches the function it exported.
 *
 *   Everything crosses the boundary once, as JSON. Calling the user's function
 *   from the host per item would mean two boundary crossings per scrap, which is
 *   the difference between a folder sorting instantly and visibly stalling.
 */
export const HARNESS = `
globalThis.__prepare = function (json) {
  const items = JSON.parse(json)
  for (const item of items) {
    if (Array.isArray(item.tags)) Object.freeze(item.tags)
    Object.freeze(item)
  }
  globalThis.__items = items
}

globalThis.__describe = function (value, depth) {
  const kind = typeof value
  if (value === null || kind === 'number' || kind === 'string' || kind === 'boolean') {
    if (kind === 'number' && !Number.isFinite(value)) return 'a number that is not finite'
    return null
  }
  if (Array.isArray(value)) {
    if (depth > 0) return 'an array nested inside an array'
    for (const entry of value) {
      const inner = globalThis.__describe(entry, depth + 1)
      if (inner !== null) return inner
    }
    return null
  }
  if (kind === 'undefined') return 'nothing'
  if (kind === 'function') return 'a function'
  if (kind === 'object') return 'an object'
  return 'a ' + kind
}

globalThis.__run = function (name) {
  const fn = globalThis.__exported
  if (typeof fn !== 'function') {
    return JSON.stringify({ error: 'The script does not export a function called ' + name + '.' })
  }

  const values = []
  for (let index = 0; index < globalThis.__items.length; index++) {
    let value
    try {
      value = fn(globalThis.__items[index])
    } catch (cause) {
      const message = cause && cause.message ? cause.message : String(cause)
      return JSON.stringify({ error: name + '() failed on item ' + (index + 1) + ': ' + message })
    }

    const problem = globalThis.__describe(value, 0)
    if (problem !== null) {
      return JSON.stringify({
        error: name + '() returned ' + problem + ' for item ' + (index + 1) + '.',
      })
    }
    values.push(value)
  }

  return JSON.stringify({ values: values })
}
`

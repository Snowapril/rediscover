/*
 * @brief The code that runs inside the sandbox around the user's functions.
 * @details Kept as one string rather than assembled per call so that what
 *   executes is fixed and reviewable, and nothing the user wrote is ever
 *   interpolated into source. Their script is evaluated as its own module; this
 *   only reaches the functions it exported.
 *
 *   Everything crosses the boundary once, as JSON, and every requested export is
 *   run in the same pass. Calling a user function from the host per scrap would
 *   mean two boundary crossings per item; evaluating the script twice to read
 *   two of its exports would mean starting the sandbox twice.
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

/*
 * Describes what is wrong with a value, or null if nothing is. A sort key may
 * be any scalar or a flat array of them; a label must be text, or null to mean
 * the scrap belongs to no category.
 */
globalThis.__describeSortKey = function (value, depth) {
  const kind = typeof value
  if (value === null || kind === 'number' || kind === 'string' || kind === 'boolean') {
    if (kind === 'number' && !Number.isFinite(value)) return 'a number that is not finite'
    return null
  }
  if (Array.isArray(value)) {
    if (depth > 0) return 'an array nested inside an array'
    for (const entry of value) {
      const inner = globalThis.__describeSortKey(entry, depth + 1)
      if (inner !== null) return inner
    }
    return null
  }
  if (kind === 'undefined') return 'nothing'
  if (kind === 'function') return 'a function'
  if (kind === 'object') return 'an object'
  return 'a ' + kind
}

globalThis.__describeLabel = function (value) {
  if (value === null) return null
  if (typeof value === 'string') return value === '' ? 'an empty name' : null
  if (typeof value === 'undefined') return 'nothing'
  if (typeof value === 'number' || typeof value === 'boolean') {
    return 'a ' + typeof value + ' where a name was expected'
  }
  return 'something that is not a name'
}

globalThis.__run = function (specJson) {
  const spec = JSON.parse(specJson)
  const results = {}

  for (const entry of spec) {
    const fn = globalThis.__module[entry.name]
    if (typeof fn !== 'function') {
      if (entry.required) {
        return JSON.stringify({
          error: 'The script does not export a function called ' + entry.name + '.',
        })
      }
      continue
    }

    const describe = entry.kind === 'label' ? globalThis.__describeLabel : null
    const values = []

    for (let index = 0; index < globalThis.__items.length; index++) {
      let value
      try {
        value = fn(globalThis.__items[index])
      } catch (cause) {
        const message = cause && cause.message ? cause.message : String(cause)
        return JSON.stringify({
          error: entry.name + '() failed on item ' + (index + 1) + ': ' + message,
        })
      }

      const problem =
        describe === null ? globalThis.__describeSortKey(value, 0) : describe(value)
      if (problem !== null) {
        return JSON.stringify({
          error: entry.name + '() returned ' + problem + ' for item ' + (index + 1) + '.',
        })
      }
      values.push(value === undefined ? null : value)
    }

    results[entry.name] = values
  }

  return JSON.stringify({ results: results })
}
`

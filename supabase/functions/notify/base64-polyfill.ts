/*
 * @brief Supplies the Uint8Array base64 methods the push library expects.
 * @details The library encodes and decodes with `Uint8Array.fromBase64` and
 *   `toBase64`, which are a recent addition to the language. The edge runtime
 *   here is Deno 2.1, which predates them, so the library boots and then fails
 *   on its first conversion — reported, before this existed, as
 *   "Uint8Array.fromBase64 is not a function".
 *
 *   Both are defined only when missing, so a runtime that has them keeps its own
 *   native implementation and this becomes dead weight rather than a divergence.
 *   Delete it when the edge runtime catches up.
 */

interface Base64Options {
  alphabet?: 'base64' | 'base64url'
  omitPadding?: boolean
}

type Base64Capable = {
  fromBase64?: (input: string, options?: Base64Options) => Uint8Array
}

const ArrayConstructor = Uint8Array as unknown as Base64Capable

if (typeof ArrayConstructor.fromBase64 !== 'function') {
  ArrayConstructor.fromBase64 = (input: string, options?: Base64Options): Uint8Array => {
    const standard =
      options?.alphabet === 'base64url' ? input.replace(/-/g, '+').replace(/_/g, '/') : input
    const padded = standard.padEnd(standard.length + ((4 - (standard.length % 4)) % 4), '=')
    const binary = atob(padded)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  }
}

if (typeof (Uint8Array.prototype as { toBase64?: unknown }).toBase64 !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toBase64', {
    value: function (this: Uint8Array, options?: Base64Options): string {
      let binary = ''
      for (const byte of this) binary += String.fromCharCode(byte)
      const encoded = btoa(binary)
      const mapped =
        options?.alphabet === 'base64url'
          ? encoded.replace(/\+/g, '-').replace(/\//g, '_')
          : encoded
      return options?.omitPadding === true ? mapped.replace(/=+$/, '') : mapped
    },
    writable: true,
    configurable: true,
  })
}

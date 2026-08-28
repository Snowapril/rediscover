import { describe, expect, it } from 'vitest'
import { assertFetchable } from '../src/fetch-policy.ts'

describe('assertFetchable', () => {
  it('accepts an ordinary web address', () => {
    expect(assertFetchable('https://example.com/a?b=1').hostname).toBe('example.com')
    expect(assertFetchable('http://example.com').protocol).toBe('http:')
  })

  it('refuses a scheme that is not http or https', () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.com', 'gopher://example.com']) {
      expect(() => assertFetchable(url)).toThrow(/Unsupported scheme/)
    }
  })

  it('refuses anything that is not a URL', () => {
    expect(() => assertFetchable('not a url')).toThrow(/Not a URL/)
  })

  it('refuses the loopback interface by name and by address', () => {
    for (const url of [
      'http://localhost:54321/rest/v1/items',
      'http://app.localhost/',
      'http://127.0.0.1:8000/',
      'http://127.1.2.3/',
      'http://[::1]:9000/',
    ]) {
      expect(() => assertFetchable(url)).toThrow(/local address|private address/)
    }
  })

  it('refuses private network ranges', () => {
    for (const url of [
      'http://10.0.0.5/',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
      'http://192.168.1.1/',
      'http://0.0.0.0/',
      'http://100.64.0.1/',
      'http://[fd00::1]/',
      'http://[fe80::1]/',
    ]) {
      expect(() => assertFetchable(url)).toThrow(/private address/)
    }
  })

  it('refuses the cloud metadata address', () => {
    expect(() => assertFetchable('http://169.254.169.254/latest/meta-data/')).toThrow(
      /private address/,
    )
  })

  it('refuses internal service names', () => {
    expect(() => assertFetchable('http://db.internal/')).toThrow(/local address/)
  })

  it('does not mistake a public address for a private one', () => {
    for (const url of [
      'https://172.32.0.1/',
      'https://172.15.0.1/',
      'https://11.0.0.1/',
      'https://192.169.0.1/',
      'https://100.128.0.1/',
      'https://8.8.8.8/',
    ]) {
      expect(() => assertFetchable(url)).not.toThrow()
    }
  })

  it('is not fooled by a host that merely contains a private-looking name', () => {
    expect(() => assertFetchable('https://localhost.example.com/')).not.toThrow()
    expect(() => assertFetchable('https://notlocalhost/')).not.toThrow()
  })
})

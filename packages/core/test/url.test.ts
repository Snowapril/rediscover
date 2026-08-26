import { describe, expect, it } from 'vitest'
import { canonicalizeUrl, extractDomain } from '../src/url.js'

describe('canonicalizeUrl', () => {
  it('forces https, drops www, and trims a trailing slash', () => {
    expect(canonicalizeUrl('http://www.Example.com/posts/')).toBe('https://example.com/posts')
  })

  it('keeps the root path as a single slash', () => {
    expect(canonicalizeUrl('https://example.com')).toBe('https://example.com/')
  })

  it('accepts a bare domain as https', () => {
    expect(canonicalizeUrl('example.com/a')).toBe('https://example.com/a')
  })

  it('removes campaign and referral parameters', () => {
    expect(canonicalizeUrl('https://example.com/a?utm_source=x&utm_medium=y&fbclid=z')).toBe(
      'https://example.com/a',
    )
  })

  it('keeps meaningful parameters and sorts them', () => {
    expect(canonicalizeUrl('https://example.com/a?page=2&id=7&utm_source=x')).toBe(
      'https://example.com/a?id=7&page=2',
    )
  })

  it('collapses links that differ only by tracking to one identity', () => {
    const fromTwitter = canonicalizeUrl('https://www.example.com/post?id=1&utm_source=twitter')
    const fromNewsletter = canonicalizeUrl('http://example.com/post?utm_campaign=weekly&id=1')
    expect(fromTwitter).toBe(fromNewsletter)
  })

  it('drops an in-page anchor but keeps a client-side route', () => {
    expect(canonicalizeUrl('https://example.com/doc#section-3')).toBe('https://example.com/doc')
    expect(canonicalizeUrl('https://example.com/app#/settings')).toBe('https://example.com/app#/settings')
    expect(canonicalizeUrl('https://example.com/app#!/settings')).toBe('https://example.com/app#!/settings')
  })

  it('drops default ports and credentials', () => {
    expect(canonicalizeUrl('https://user:pw@example.com:443/a')).toBe('https://example.com/a')
    expect(canonicalizeUrl('http://example.com:80/a')).toBe('https://example.com/a')
  })

  it('keeps a non-default port', () => {
    expect(canonicalizeUrl('http://example.com:8080/a')).toBe('https://example.com:8080/a')
  })

  it('rejects inputs that are not web URLs', () => {
    expect(canonicalizeUrl('')).toBeNull()
    expect(canonicalizeUrl('   ')).toBeNull()
    expect(canonicalizeUrl('javascript:alert(1)')).toBeNull()
    expect(canonicalizeUrl('mailto:a@b.com')).toBeNull()
    expect(canonicalizeUrl('chrome://extensions')).toBeNull()
    expect(canonicalizeUrl('https://')).toBeNull()
  })

  it('preserves path case, which servers may treat as significant', () => {
    expect(canonicalizeUrl('https://example.com/Path/To')).toBe('https://example.com/Path/To')
  })
})

describe('extractDomain', () => {
  it('returns the hostname without www', () => {
    expect(extractDomain('https://www.example.com/a/b?c=1')).toBe('example.com')
  })

  it('keeps subdomains other than www', () => {
    expect(extractDomain('https://blog.example.com/a')).toBe('blog.example.com')
  })

  it('returns null for an unusable URL', () => {
    expect(extractDomain('not a url at all !!')).toBeNull()
  })
})

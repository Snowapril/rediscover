import { describe, expect, it } from 'vitest'
import { describeDue, isDue, remindAtFrom, REMINDER_PRESETS } from '../src/reminders.ts'

const DAY = 86_400_000
const NOON = Date.UTC(2026, 7, 30, 12, 0, 0)

describe('remindAtFrom', () => {
  it('puts each preset the right distance out', () => {
    expect(remindAtFrom('tomorrow', NOON)).toBe(NOON + DAY)
    expect(remindAtFrom('threeDays', NOON)).toBe(NOON + 3 * DAY)
    expect(remindAtFrom('week', NOON)).toBe(NOON + 7 * DAY)
    expect(remindAtFrom('month', NOON)).toBe(NOON + 30 * DAY)
  })

  it('keeps the time of day it was set at', () => {
    // Somebody saving at midnight is telling you when they are awake.
    const midnight = Date.UTC(2026, 7, 30, 0, 0, 0)
    expect(remindAtFrom('week', midnight) % DAY).toBe(midnight % DAY)
  })

  it('covers every preset offered', () => {
    for (const preset of REMINDER_PRESETS) {
      expect(remindAtFrom(preset.value, NOON)).toBeGreaterThan(NOON)
    }
  })
})

describe('isDue', () => {
  it('is not due before its moment', () => {
    expect(isDue(NOON + 1, NOON)).toBe(false)
  })

  it('is due at its moment and after', () => {
    expect(isDue(NOON, NOON)).toBe(true)
    expect(isDue(NOON - DAY, NOON)).toBe(true)
  })
})

describe('describeDue', () => {
  it('names the near future plainly', () => {
    expect(describeDue(NOON, NOON)).toBe('due today')
    expect(describeDue(NOON + DAY, NOON)).toBe('due tomorrow')
    expect(describeDue(NOON + 5 * DAY, NOON)).toBe('due in 5 days')
  })

  it('says how long an overdue one has been waiting', () => {
    // The number that should feel uncomfortable, since rotting scraps are the
    // problem the whole feature exists for.
    expect(describeDue(NOON - DAY, NOON)).toBe('1 day overdue')
    expect(describeDue(NOON - 12 * DAY, NOON)).toBe('12 days overdue')
  })

  it('treats a few hours either side as today', () => {
    expect(describeDue(NOON + 3 * 3_600_000, NOON)).toBe('due today')
    expect(describeDue(NOON - 3 * 3_600_000, NOON)).toBe('due today')
  })
})

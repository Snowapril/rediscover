import { describe, expect, it } from 'vitest'
import {
  EXAMPLE_SCRIPT_ITEM,
  SCRIPT_PROPERTIES,
  type ScriptPropertyDoc,
} from '../src/script-properties.ts'

describe('the property reference shown beside the editor', () => {
  it('documents exactly the properties a script is given', () => {
    // The point of this test: adding a property to ScriptItem without describing
    // it leaves a script author unable to discover it, and describing one that
    // does not exist sends them looking for something that is not there.
    const documented = SCRIPT_PROPERTIES.map((property) => property.name).sort()
    const actual = (Object.keys(EXAMPLE_SCRIPT_ITEM) as ScriptPropertyDoc['name'][]).sort()
    expect(documented).toEqual(actual)
  })

  it('describes each property only once', () => {
    const names = SCRIPT_PROPERTIES.map((property) => property.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('says something about every property', () => {
    for (const property of SCRIPT_PROPERTIES) {
      expect(property.type, property.name).not.toBe('')
      expect(property.description.length, property.name).toBeGreaterThan(10)
      expect(property.example, property.name).not.toBe('')
    }
  })

  it('leads with what a script reaches for first', () => {
    expect(SCRIPT_PROPERTIES[0]!.name).toBe('createdAt')
  })


  it('shows a scrap that is not too tidy to be useful', () => {
    // A worked example with every field populated teaches nothing about the
    // nulls, which are where scripts actually go wrong.
    expect(EXAMPLE_SCRIPT_ITEM.readAt).toBeNull()
    expect(EXAMPLE_SCRIPT_ITEM.publishedAt).toBeLessThan(EXAMPLE_SCRIPT_ITEM.createdAt)
  })
})

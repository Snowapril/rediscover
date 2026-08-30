import { useState } from 'react'
import { SCRIPT_PROPERTIES } from '@rediscover/core'

/*
 * @brief What a script is handed, so it can be written without guessing.
 * @details A script receives one object and nothing else, which makes "what is
 *   on it" the only question a person has while writing one. Every property is
 *   listed with its type, an example of a real value, and the trap in it where
 *   there is one — almost always that it can be null.
 *
 *   Clicking a property inserts it, because the gap between reading that
 *   `readingTimeMin` exists and typing `item.readingTimeMin` correctly is where
 *   a typo turns into a puzzling empty result.
 * @param onInsert Called with the expression to put into the editor.
 */
export function PropertyReference({ onInsert }: { onInsert(expression: string): void }) {
  const [open, setOpen] = useState(true)

  return (
    <section className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-medium">What a script is given</span>
        <span className="text-xs text-muted">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-line">
          <p className="px-3 py-2 text-xs text-muted">
            Your function is called once per scrap with one argument. Click a name to insert it.
          </p>
          <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {SCRIPT_PROPERTIES.map((property) => (
              <li key={property.name} className="px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <button
                    type="button"
                    onClick={() => onInsert(`item.${property.name}`)}
                    title={`Insert item.${property.name}`}
                    className="font-mono text-xs text-ink underline decoration-line underline-offset-2 hover:decoration-accent"
                  >
                    item.{property.name}
                  </button>
                  <span className="font-mono text-[0.65rem] text-accent">{property.type}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{property.description}</p>
                <p className="mt-0.5 font-mono text-[0.65rem] text-muted">
                  e.g. {property.example}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

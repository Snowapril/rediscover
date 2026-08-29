interface Props {
  categories: { label: string; count: number }[]
  selected: string | null
  onSelect(label: string | null): void
}

const chip = 'rounded-full border px-2.5 py-0.5 text-xs'

/*
 * @brief The categories a view's script put the scraps into.
 * @details Selecting one narrows the list to it; selecting All shows every
 *   category, separated. The counts are the point as much as the filtering — a
 *   folder that turns out to be nine tenths unread says something the folder
 *   itself does not.
 * @param categories Each category and how many scraps are in it.
 * @param selected The category being shown alone, or null for all of them.
 * @param onSelect Called with the category to narrow to, or null to widen.
 */
export function CategoryChips({ categories, selected, onSelect }: Props) {
  if (categories.length === 0) return null

  const total = categories.reduce((sum, category) => sum + category.count, 0)

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`${chip} ${
          selected === null
            ? 'border-ink bg-ink text-canvas'
            : 'border-line text-muted hover:border-line-strong'
        }`}
      >
        All <span className="tabular-nums opacity-70">{total}</span>
      </button>

      {categories.map((category) => (
        <button
          key={category.label}
          type="button"
          onClick={() => onSelect(selected === category.label ? null : category.label)}
          className={`${chip} ${
            selected === category.label
              ? 'border-ink bg-ink text-canvas'
              : 'border-line text-muted hover:border-line-strong'
          }`}
        >
          {category.label} <span className="tabular-nums opacity-70">{category.count}</span>
        </button>
      ))}
    </div>
  )
}

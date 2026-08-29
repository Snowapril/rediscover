/*
 * @brief A label shown on the folder a shake has armed for merging.
 * @details Merging removes a folder, so it says so in words rather than relying
 *   on a highlight the user has to have learnt.
 */
export function MergeBadge({ name }: { name: string }) {
  return (
    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-accent px-1.5 py-0.5 text-[0.65rem] font-medium text-canvas">
      Merge into {name}
    </span>
  )
}

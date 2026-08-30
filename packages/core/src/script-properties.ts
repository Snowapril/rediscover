import type { ScriptItem } from './types.ts'

/*
 * @brief What one property of a scrap is called, holds, and looks like.
 * @details Shown beside the script editor. Written as data rather than as prose
 *   in a component so a test can hold it to the type it documents: adding a
 *   property to ScriptItem without describing it here fails the build.
 */
export interface ScriptPropertyDoc {
  name: keyof ScriptItem
  /*
   * @brief The type as somebody writing a script would say it.
   */
  type: string
  /*
   * @brief What it holds, and the trap in it if there is one.
   */
  description: string
  /*
   * @brief A value it might actually have, written as JavaScript.
   */
  example: string
}

/*
 * @brief A scrap with every property filled in, for showing what one looks like.
 * @details Deliberately not tidy: no reading time, an unread state, and a
 *   published date older than when it was saved, because those are the shapes a
 *   script has to survive.
 */
export const EXAMPLE_SCRIPT_ITEM: ScriptItem = {
  id: '9b1f0c2e-7a5d-4b3c-8e21-6f0a4d2c1b77',
  url: 'https://blog.example.com/posts/why-we-forget?utm_source=news',
  domain: 'blog.example.com',
  title: 'Why We Forget',
  excerpt: 'Memory fades faster than we expect, and the reasons are stranger…',
  thumbnailUrl: 'https://blog.example.com/media/cover.png',
  siteName: 'Example Blog',
  author: 'Ada Lovelace',
  publishedAt: 1772668800000,
  createdAt: 1774310400000,
  updatedAt: 1774310400000,
  readState: 'unread',
  readAt: null,
  isImportant: true,
  tags: ['memory', 'to read'],
  readingTimeMin: 7,
  mediaType: 'article',
  note: 'Follow up on the study in the third section',
}

/*
 * @brief Every property a script can read off a scrap.
 * @details Ordered by how often a script reaches for it rather than
 *   alphabetically: what you sort by first, then what you group by, then the
 *   rest.
 */
export const SCRIPT_PROPERTIES: ScriptPropertyDoc[] = [
  {
    name: 'createdAt',
    type: 'number',
    description:
      'When the scrap was saved, in milliseconds. Negate it to put the newest first.',
    example: '1774310400000',
  },
  {
    name: 'readState',
    type: "'unread' | 'reading' | 'read'",
    description: 'How far through it you are.',
    example: "'unread'",
  },
  {
    name: 'isImportant',
    type: 'boolean',
    description: 'Whether you flagged it. false sorts before true, so negate it to lift flagged scraps.',
    example: 'true',
  },
  {
    name: 'title',
    type: 'string | null',
    description: 'Null when the page could not be read; fall back to url.',
    example: "'Why We Forget'",
  },
  {
    name: 'domain',
    type: 'string',
    description: 'The host, without www. Always present.',
    example: "'blog.example.com'",
  },
  {
    name: 'siteName',
    type: 'string | null',
    description: 'What the site calls itself. Null when it does not say; fall back to domain.',
    example: "'Example Blog'",
  },
  {
    name: 'readingTimeMin',
    type: 'number | null',
    description: 'Estimated minutes to read. Null when unknown, which sorts last.',
    example: '7',
  },
  {
    name: 'tags',
    type: 'string[]',
    description: 'Your tags. Empty rather than null when there are none.',
    example: "['memory', 'to read']",
  },
  {
    name: 'url',
    type: 'string',
    description: 'The address as saved, tracking parameters and all.',
    example: "'https://blog.example.com/posts/why-we-forget'",
  },
  {
    name: 'excerpt',
    type: 'string | null',
    description: 'The opening of the page, as extracted.',
    example: "'Memory fades faster than we expect…'",
  },
  {
    name: 'author',
    type: 'string | null',
    description: 'Who wrote it, when the page says.',
    example: "'Ada Lovelace'",
  },
  {
    name: 'publishedAt',
    type: 'number | null',
    description:
      'When the page was published, in milliseconds. Often long before you saved it, and null when the page does not say.',
    example: '1772668800000',
  },
  {
    name: 'readAt',
    type: 'number | null',
    description: 'When you marked it read, in milliseconds. Null while it is unread.',
    example: 'null',
  },
  {
    name: 'updatedAt',
    type: 'number',
    description: 'When the scrap last changed, in milliseconds.',
    example: '1774310400000',
  },
  {
    name: 'mediaType',
    type: "'article' | 'video' | 'image' | 'pdf' | 'link' | null",
    description: 'What the link points at.',
    example: "'article'",
  },
  {
    name: 'thumbnailUrl',
    type: 'string | null',
    description: 'The cover image, when the page offers one.',
    example: "'https://blog.example.com/media/cover.png'",
  },
  {
    name: 'note',
    type: 'string | null',
    description: 'Whatever you wrote on it yourself.',
    example: "'Follow up on the study in the third section'",
  },
  {
    name: 'id',
    type: 'string',
    description: 'Identifies the scrap. Rarely useful for sorting, but stable.',
    example: "'9b1f0c2e-…'",
  },
]

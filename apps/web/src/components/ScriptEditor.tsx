import { useEffect, useRef } from 'react'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/*
 * @brief Colours for the code, drawn from the page's own palette.
 * @details The editor sits inside the app rather than in a window of its own, so
 *   it takes the surrounding theme instead of bringing one. Everything resolves
 *   through the same custom properties as the rest of the page, which is what
 *   makes it follow light and dark without a second definition.
 */
const highlighting = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--color-accent)' },
  { tag: tags.controlKeyword, color: 'var(--color-accent)' },
  { tag: tags.definitionKeyword, color: 'var(--color-accent)' },
  { tag: tags.moduleKeyword, color: 'var(--color-accent)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--color-muted)', fontStyle: 'italic' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--color-accent)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--color-ink)', fontWeight: '600' },
  { tag: tags.function(tags.variableName), color: 'var(--color-ink)', fontWeight: '600' },
  { tag: tags.propertyName, color: 'var(--color-ink)' },
  { tag: tags.operator, color: 'var(--color-muted)' },
  { tag: tags.punctuation, color: 'var(--color-muted)' },
])

const theme = EditorView.theme({
  '&': {
    fontSize: '12px',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-line)',
    borderRadius: '0.5rem',
  },
  '&.cm-focused': { outline: 'none', borderColor: 'var(--color-accent)' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    lineHeight: '1.7',
    padding: '0.5rem 0',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-muted)',
    opacity: '0.5',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-cursor': { borderLeftColor: 'var(--color-ink)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-line)',
  },
})

interface Props {
  value: string
  readOnly: boolean
  onChange(value: string): void
}

/*
 * @brief A small JavaScript editor for a user script.
 * @details Built on CodeMirror directly rather than through a wrapper package,
 *   with only the extensions these scripts need: highlighting, undo, sane
 *   keybindings, and Tab for indentation. The all-in-one setups bring search
 *   panels, autocompletion and linting that a ten-line function has no use for,
 *   on a page that already carries a WebAssembly sandbox.
 * @param value The script source.
 * @param readOnly Whether it can be edited; built-in scripts cannot.
 * @param onChange Called with the new source as it is typed.
 */
export function ScriptEditor({ value, readOnly, onChange }: Props) {
  const host = useRef<HTMLDivElement | null>(null)
  const view = useRef<EditorView | null>(null)
  // Read through a ref so changing the handler does not rebuild the editor and
  // throw away the cursor.
  const notify = useRef(onChange)
  notify.current = onChange

  useEffect(() => {
    if (host.current === null) return

    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          javascript(),
          syntaxHighlighting(highlighting),
          indentUnit.of('  '),
          EditorView.lineWrapping,
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          placeholder('export function key(item) { … }'),
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) notify.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = editor

    return () => {
      editor.destroy()
      view.current = null
    }
    // Deliberately not depending on `value`: the document is kept in step by the
    // effect below, so typing does not tear the editor down on every keystroke.
  }, [readOnly])

  useEffect(() => {
    const editor = view.current
    if (editor === null) return
    const current = editor.state.doc.toString()
    if (current === value) return

    // Only when the value came from somewhere other than typing — switching
    // scripts, or discarding an edit. Replacing the document the user is in the
    // middle of would move their cursor to the end.
    editor.dispatch({ changes: { from: 0, to: current.length, insert: value } })
  }, [value])

  return <div ref={host} className="mt-3 overflow-hidden" />
}

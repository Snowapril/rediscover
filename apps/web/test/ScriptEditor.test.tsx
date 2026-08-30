import { EditorView } from '@codemirror/view'
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScriptEditor } from '../src/components/ScriptEditor.tsx'

afterEach(() => {
  document.body.innerHTML = ''
})

function editorText(): string {
  return document.querySelector('.cm-content')?.textContent ?? ''
}

/*
 * @brief Type into the editor the way a keystroke does.
 * @details A plain transaction with no annotation of ours on it, which is
 *   exactly what CodeMirror produces for real input. Going through the view
 *   rather than firing key events is what makes this work under a synthetic
 *   DOM, and it still exercises the same code path the listener sees.
 * @param text What to put in the document.
 */
function type(text: string): void {
  const dom = document.querySelector('.cm-editor') as HTMLElement | null
  if (dom === null) throw new Error('no editor on screen')
  const view = EditorView.findFromDOM(dom)
  if (view === null) throw new Error('no editor view behind the DOM')

  act(() => {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
  })
}

describe('ScriptEditor', () => {
  it('shows the script it is given', () => {
    render(<ScriptEditor value="export function key() { return 1 }" readOnly={false} onChange={() => {}} />)
    expect(editorText()).toContain('export function key()')
  })

  it('reports what the user types', () => {
    const onChange = vi.fn()
    render(<ScriptEditor value="before" readOnly={false} onChange={onChange} />)

    type('after')

    expect(onChange).toHaveBeenCalledWith('after')
  })

  it('does not report a change the caller itself made', () => {
    // The fault behind "Save puts the starter script back". Replacing the
    // document because a new value arrived used to be indistinguishable from
    // typing, so the editor told its caller that the caller's own stale value
    // had just been typed. The caller stored that as an unsaved edit, which then
    // beat the saved one — and the screen sat on the starter script until
    // another script was opened.
    const onChange = vi.fn()
    const { rerender } = render(<ScriptEditor value="first" readOnly={false} onChange={onChange} />)
    expect(editorText()).toContain('first')

    rerender(<ScriptEditor value="second" readOnly={false} onChange={onChange} />)

    expect(editorText()).toContain('second')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('leaves the document alone when the value it is given has not moved', () => {
    const onChange = vi.fn()
    const { rerender } = render(<ScriptEditor value="same" readOnly={false} onChange={onChange} />)
    type('edited by hand')
    onChange.mockClear()

    // The caller re-renders without the value changing — the editor must not
    // undo what was just typed.
    rerender(<ScriptEditor value="same" readOnly={false} onChange={onChange} />)

    expect(editorText()).toContain('edited by hand')
  })

  it('refuses edits to a built-in script', () => {
    render(<ScriptEditor value="export function key() { return 1 }" readOnly onChange={() => {}} />)
    expect(document.querySelector('.cm-content')?.getAttribute('contenteditable')).not.toBe('true')
  })

  it('accepts edits to a script of your own', () => {
    render(<ScriptEditor value="export function key() { return 1 }" readOnly={false} onChange={() => {}} />)
    expect(document.querySelector('.cm-content')?.getAttribute('contenteditable')).toBe('true')
  })
})

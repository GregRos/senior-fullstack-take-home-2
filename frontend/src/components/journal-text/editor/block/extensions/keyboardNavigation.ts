import { Extension } from "@tiptap/core"
import { redo, redoDepth, undo, undoDepth } from "@tiptap/pm/history"
import type { EditorView } from "@tiptap/pm/view"

export interface BoundaryNavigationCallbacks {
    onSplitForward: (beforeText: string, afterText: string) => void
    onMergeBackward: () => void
    onMoveBackward: () => void
    onMoveForward: () => void
}

interface ShortcutOptions {
    callbacks: BoundaryNavigationCallbacks
    getText: () => string
}

export function createShortcutExtension(options: ShortcutOptions) {
    return Extension.create({
        name: "journalShortcuts",
        addKeyboardShortcuts() {
            return {
                Enter: () => {
                    const range = currentTextRange(this.editor.view)
                    const text = options.getText()
                    options.callbacks.onSplitForward(
                        text.slice(0, range.from),
                        text.slice(range.to)
                    )
                    return true
                },
                Backspace: () => {
                    const range = currentTextRange(this.editor.view)
                    if (range.from !== 0 || range.from !== range.to) {
                        return false
                    }
                    options.callbacks.onMergeBackward()
                    return true
                },
                ArrowUp: () => {
                    if (!selectionIsAtStart(this.editor.view)) {
                        return false
                    }
                    options.callbacks.onMoveBackward()
                    return true
                },
                ArrowLeft: () => {
                    if (!selectionIsAtStart(this.editor.view)) {
                        return false
                    }
                    options.callbacks.onMoveBackward()
                    return true
                },
                ArrowDown: () => {
                    if (!selectionIsAtEnd(this.editor.view)) {
                        return false
                    }
                    options.callbacks.onMoveForward()
                    return true
                },
                ArrowRight: () => {
                    if (!selectionIsAtEnd(this.editor.view)) {
                        return false
                    }
                    options.callbacks.onMoveForward()
                    return true
                },
                "Mod-z": () => {
                    const { state, dispatch } = this.editor.view
                    return undoDepth(state) > 0 ? undo(state, dispatch, this.editor.view) : false
                },
                "Mod-Shift-z": () => {
                    const { state, dispatch } = this.editor.view
                    return redoDepth(state) > 0 ? redo(state, dispatch, this.editor.view) : false
                },
                "Mod-y": () => {
                    const { state, dispatch } = this.editor.view
                    return redoDepth(state) > 0 ? redo(state, dispatch, this.editor.view) : false
                }
            }
        }
    })
}

function currentTextRange(view: EditorView) {
    const { selection } = view.state

    return {
        from: Math.max(0, selection.from - 1),
        to: Math.max(0, selection.to - 1)
    }
}

function selectionIsAtStart(view: EditorView) {
    const { selection } = view.state
    return selection.empty && selection.from === 1
}

function selectionIsAtEnd(view: EditorView) {
    const { selection } = view.state
    return selection.empty && selection.to === view.state.doc.content.size - 1
}

import { Extension } from "@tiptap/core"
import { history } from "@tiptap/pm/history"
import type { EditorView } from "@tiptap/pm/view"

export interface CaretPlacement {
    type: "start" | "end" | "offset"
    offset?: number
}

interface CaretCoords {
    left: number
    top: number
}

export const JournalHistory = Extension.create({
    name: "journalHistory",
    addProseMirrorPlugins() {
        return [history()]
    }
})

export function plainTextFromView(view: EditorView) {
    return view.state.doc.textContent
}

export function caretPlacementFromCoords(view: EditorView, coords: CaretCoords): CaretPlacement {
    const position = view.posAtCoords(coords)?.pos
    if (position == null) {
        return { type: "end" }
    }

    return {
        type: "offset",
        offset: clampTextOffset(position - 1, view.state.doc.textContent.length)
    }
}

export function focusPositionFromCaret(view: EditorView, placement: CaretPlacement) {
    if (placement.type === "start") {
        return "start"
    }

    if (placement.type === "end") {
        return "end"
    }

    return clampTextOffset(placement.offset ?? 0, view.state.doc.textContent.length) + 1
}

function clampTextOffset(offset: number, textLength: number) {
    return Math.max(0, Math.min(offset, textLength))
}

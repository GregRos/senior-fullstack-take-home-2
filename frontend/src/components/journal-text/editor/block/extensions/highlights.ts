import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"

import { ErrorSpan, MistakeSpan } from "@/model/journal"
import type { Block } from "../../editor-props"

export interface HighlightDecoration {
    id: string
    from: number
    to: number
    kind: "mistake" | "error"
}

interface HighlightDecorationOptions {
    decorations: readonly HighlightDecoration[]
}

const highlightDecorationPluginKey = new PluginKey<DecorationSet>("journalHighlightDecorations")

export function createHighlightDecorationExtension(options: HighlightDecorationOptions) {
    return Extension.create({
        name: "journalHighlightDecorations",
        addProseMirrorPlugins() {
            const plugin = new Plugin({
                key: highlightDecorationPluginKey,
                state: {
                    init(_, state) {
                        return buildDecorationSet(state.doc, options.decorations)
                    },
                    apply(transaction, old, _, newState) {
                        const nextDecorations = transaction.getMeta(
                            highlightDecorationPluginKey
                        ) as readonly HighlightDecoration[] | undefined

                        if (nextDecorations) {
                            return buildDecorationSet(newState.doc, nextDecorations)
                        }

                        return old.map(transaction.mapping, newState.doc)
                    }
                },
                props: {
                    decorations(state) {
                        return highlightDecorationPluginKey.getState(state) ?? DecorationSet.empty
                    }
                }
            })

            return [plugin]
        }
    })
}

export function syncHighlightDecorations(
    view: EditorView,
    decorations: readonly HighlightDecoration[]
) {
    const transaction = view.state.tr
        .setMeta(highlightDecorationPluginKey, decorations)
        .setMeta("addToHistory", false)

    view.dispatch(transaction)
}

export function computeHighlights(block: Block): HighlightDecoration[] {
    if (block.checkedState.type === "active") {
        return []
    }

    const decorations: HighlightDecoration[] = []
    let offset = 1

    for (const span of block.spans) {
        const spanLength = span.content.length
        if (span instanceof MistakeSpan || span instanceof ErrorSpan) {
            decorations.push({
                id: span.id,
                from: offset,
                to: offset + spanLength,
                kind: span instanceof MistakeSpan ? "mistake" : "error"
            })
        }
        offset += spanLength
    }

    return decorations
}

function buildDecorationSet(
    doc: EditorView["state"]["doc"],
    decorations: readonly HighlightDecoration[]
) {
    return DecorationSet.create(
        doc,
        decorations.map(decoration =>
            Decoration.inline(decoration.from, decoration.to, {
                class: `jt-highlight jt-highlight--${decoration.kind}`,
                "data-span-id": decoration.id
            })
        )
    )
}

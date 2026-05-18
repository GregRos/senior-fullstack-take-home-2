import { useCallback, useEffect, useRef } from "react"

import Text from "@tiptap/extension-text"
import { useEditor, type Editor } from "@tiptap/react"

import type { Block } from "../editor-props"
import {
    buildTextDoc,
    createHighlightDecorationExtension,
    createShortcutExtension,
    focusPositionFromCaret,
    JournalDoc,
    JournalHistory,
    JournalParagraph,
    plainTextFromView,
    syncHighlightDecorations,
    type CaretPlacement,
    type HighlightDecoration
} from "./extensions/index"

interface UseTyEditorArgs {
    block: Block
    index: number
    highlightDecorations: HighlightDecoration[]
    onFocus(caretPlacement?: CaretPlacement): void
    onBlur(currentBlockContent: string): void
    onSplitForward(currentBlockContent: string, nextBlockContent: string): void
    onMergeBackward(currentBlockContent: string): void
    onMoveBackward(currentBlockContent: string): void
    onMoveForward(currentBlockContent: string): void
}

interface UseTyEditorResult {
    editor: Editor | null
    focusAndSetCaret(placement: CaretPlacement): void
}

export default function useTyEditor({
    block,
    index,
    highlightDecorations,
    onFocus,
    onBlur,
    onSplitForward,
    onMergeBackward,
    onMoveBackward,
    onMoveForward
}: UseTyEditorArgs): UseTyEditorResult {
    const dirtyRef = useRef(false)
    const latestTextRef = useRef(block.text)
    const blockRef = useRef(block)
    const callbacksRef = useRef({
        onFocus,
        onBlur,
        onSplitForward,
        onMergeBackward,
        onMoveBackward,
        onMoveForward
    })

    if (block.checkedState.type !== "active") {
        latestTextRef.current = block.text
    }

    blockRef.current = block
    callbacksRef.current = {
        onFocus,
        onBlur,
        onSplitForward,
        onMergeBackward,
        onMoveBackward,
        onMoveForward
    }

    const editor = useEditor(
        {
            extensions: [
                JournalDoc,
                JournalParagraph,
                Text,
                JournalHistory,
                createHighlightDecorationExtension({
                    decorations: highlightDecorations
                }),
                createShortcutExtension({
                    callbacks: {
                        onSplitForward: (beforeText, afterText) => {
                            dirtyRef.current = false
                            callbacksRef.current.onSplitForward(beforeText, afterText)
                        },
                        onMergeBackward: () => {
                            callbacksRef.current.onMergeBackward(latestTextRef.current)
                        },
                        onMoveBackward: () => {
                            callbacksRef.current.onMoveBackward(latestTextRef.current)
                        },
                        onMoveForward: () => {
                            callbacksRef.current.onMoveForward(latestTextRef.current)
                        }
                    },
                    getText: () => latestTextRef.current
                })
            ],
            content: buildTextDoc(latestTextRef.current),
            editable: block.checkedState.type === "active",
            editorProps: {
                attributes: {
                    class: "jt-block-editor",
                    spellcheck: "false",
                    autocorrect: "off",
                    autocomplete: "off",
                    autocapitalize: "off",
                    "aria-label": `Paragraph ${index}`
                },
                handleDOMEvents: {
                    focus: () => {
                        if (blockRef.current.checkedState.type !== "active") {
                            callbacksRef.current.onFocus()
                        }
                        return false
                    },
                    blur: () => {
                        window.queueMicrotask(() => {
                            if (blockRef.current.checkedState.type === "active") {
                                callbacksRef.current.onBlur(latestTextRef.current)
                            }
                        })
                        return false
                    }
                }
            },
            onUpdate: ({ editor: nextEditor }) => {
                if (blockRef.current.checkedState.type !== "active") {
                    return
                }

                latestTextRef.current = plainTextFromView(nextEditor.view)
                dirtyRef.current = true
            }
        },
        []
    )

    const focusAndSetCaret = useCallback(
        (placement: CaretPlacement) => {
            if (!editor) {
                return
            }

            editor.commands.focus(focusPositionFromCaret(editor.view, placement), {
                scrollIntoView: false
            })
        },
        [editor]
    )

    useEffect(() => {
        dirtyRef.current = false
    }, [block.checkedState.type, block.id])

    useEffect(() => {
        if (!editor) {
            return
        }

        editor.setEditable(block.checkedState.type === "active")
    }, [block.checkedState.type, editor])

    useEffect(() => {
        if (!editor) {
            return
        }

        syncHighlightDecorations(editor.view, highlightDecorations)
    }, [editor, highlightDecorations])

    useEffect(() => {
        if (!editor) {
            return
        }
        if (dirtyRef.current) {
            return
        }

        const desiredText = block.text

        latestTextRef.current = desiredText
        dirtyRef.current = false
        editor.commands.setContent(buildTextDoc(desiredText), {
            emitUpdate: false
        })
        syncHighlightDecorations(editor.view, highlightDecorations)
    }, [block, editor, highlightDecorations])

    return {
        editor,
        focusAndSetCaret
    }
}

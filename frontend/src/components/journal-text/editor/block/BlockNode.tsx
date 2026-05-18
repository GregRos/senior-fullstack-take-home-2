import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type MouseEvent
} from "react"

import { EditorContent as TiptapEditorContent } from "@tiptap/react"

import { ErrorSpan, MistakeSpan } from "@/model/journal"
import type { Block, Span } from "../editor-props"
import type { BlockNodeProps } from "./block-props"
import {
    caretPlacementFromCoords,
    computeHighlights,
    type CaretPlacement
} from "./extensions/index"
import GutterIcon from "./GutterIcon"
import MistakeTooltip from "./MistakeTooltip.tsx"
import type { MistakeTooltipProps } from "./MistakeTooltipProps"
import useTyEditor from "./useTyEditor"

export interface BlockNodeHandle {
    focusAndSetCaret: (placement: CaretPlacement) => void
}

const BlockNode = forwardRef<BlockNodeHandle, BlockNodeProps>(function BlockNode(
    {
        block,
        index,
        onFocus,
        onBlur,
        onSplitForward,
        onMergeBackward,
        onMoveBackward,
        onMoveForward,
        onFixMistake
    },
    ref
) {
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const [highlightReferenceElements, setHighlightReferenceElements] = useState<
        Record<string, HTMLElement>
    >({})

    const highlightSpans = useMemo(() => block.spans.filter(isHighlightSpan), [block.spans])

    const highlightDecorations = useMemo(
        () => computeHighlights(block),
        [block.checkedState.type, block.spans]
    )

    const { editor, focusAndSetCaret } = useTyEditor({
        block,
        index,
        highlightDecorations,
        onFocus,
        onBlur,
        onSplitForward,
        onMergeBackward,
        onMoveBackward,
        onMoveForward
    })

    useImperativeHandle(
        ref,
        () => ({
            focusAndSetCaret
        }),
        [focusAndSetCaret]
    )

    useEffect(() => {
        if (!wrapperRef.current) {
            return
        }
        const nextReferenceElements = Object.fromEntries(
            highlightSpans.map(span => [
                span.id,
                wrapperRef.current!.querySelector<HTMLElement>(`[data-span-id="${span.id}"]`)!
            ])
        )

        setHighlightReferenceElements(previousReferenceElements =>
            haveSameHighlightReferences(previousReferenceElements, nextReferenceElements)
                ? previousReferenceElements
                : nextReferenceElements
        )
    }, [block.id, highlightDecorations, highlightSpans])

    const handleInactiveMouseDown = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            if (block.checkedState.type === "active") {
                return
            }

            const target = event.target as HTMLElement
            if (target.closest(".jt-tooltip")) {
                event.preventDefault()
                event.stopPropagation()
                return
            }

            event.preventDefault()
            onFocus(
                editor
                    ? caretPlacementFromCoords(editor.view, {
                          left: event.clientX,
                          top: event.clientY
                      })
                    : { type: "end" }
            )
        },
        [block.checkedState.type, editor, onFocus]
    )

    return (
        <div
            ref={wrapperRef}
            className="jt-block-row"
            data-state={block.checkedState.type}
            data-mistakes={String(hasMistakes(block))}
        >
            <div className="jt-gutter" aria-hidden>
                <GutterIcon state={block.checkedState.type} hasMistakes={hasMistakes(block)} />
                <span className="jt-gutter-number">{index}</span>
            </div>

            <div className="jt-block-surface">
                <div className="jt-block-surfaceInner" onMouseDown={handleInactiveMouseDown}>
                    <TiptapEditorContent editor={editor} />
                </div>

                {highlightSpans.map(span => (
                    <MistakeTooltip
                        key={span.id}
                        referenceElement={highlightReferenceElements[span.id] ?? null}
                        {...toTooltipProps(span)}
                        onApplyFix={() => {
                            onFixMistake(span)
                        }}
                    />
                ))}
            </div>
        </div>
    )
})

export default BlockNode

function hasMistakes(block: Block) {
    return block.spans.some(isHighlightSpan)
}

function isHighlightSpan(span: Span): span is MistakeSpan<any> | ErrorSpan {
    return span instanceof MistakeSpan || span instanceof ErrorSpan
}

function toTooltipProps(span: MistakeSpan<any> | ErrorSpan): MistakeTooltipProps {
    if (span instanceof MistakeSpan) {
        return {
            kind: "mistake",
            before: span.source,
            after: span.targetSource,
            category: span.category,
            content: span.reason,
            canApply: true
        }
    }

    return {
        kind: "error",
        before: span.source,
        after: "",
        category: span.category,
        content: span.reason,
        canApply: false
    }
}

function haveSameHighlightReferences(
    previousReferenceElements: Record<string, HTMLElement | null>,
    nextReferenceElements: Record<string, HTMLElement | null>
) {
    const previousKeys = Object.keys(previousReferenceElements)
    const nextKeys = Object.keys(nextReferenceElements)

    if (previousKeys.length !== nextKeys.length) {
        return false
    }

    for (const key of nextKeys) {
        if (previousReferenceElements[key] !== nextReferenceElements[key]) {
            return false
        }
    }

    return true
}

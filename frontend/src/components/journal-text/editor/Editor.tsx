import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import { v4 as uuidv4 } from "uuid"

import { JournalBlock } from "@/model/journal"
import BlockNode, { type BlockNodeHandle } from "./block/BlockNode"
import type { CaretPlacement } from "./block/extensions/index"
import type { Block, BlockCommitEvent, EditorContent, EditorProps, Span } from "./editor-props"
import "./Editor.scss"

interface PendingFocusRequest {
    blockId: string
    caret: CaretPlacement
}

export default function Editor({
    content,
    revision,
    onBlockCommit,
    onSpanInteraction
}: EditorProps) {
    const blockRefsRef = useRef(new Map<string, BlockNodeHandle>())
    const [editorContent, setEditorContent] = useState(content)
    const contentRef = useRef(editorContent)
    const [pendingFocusRequest, setPendingFocusRequest] = useState<PendingFocusRequest | null>(null)

    contentRef.current = editorContent

    useEffect(() => {
        setEditorContent(content)
    }, [content, revision])

    const emitContentChange = useCallback((nextContent: EditorContent) => {
        contentRef.current = nextContent
        setEditorContent(nextContent)
    }, [])

    const setBlockRef = useCallback((blockId: string, handle: BlockNodeHandle | null) => {
        if (handle) {
            blockRefsRef.current.set(blockId, handle)
            return
        }

        blockRefsRef.current.delete(blockId)
    }, [])

    useEffect(() => {
        if (!pendingFocusRequest) {
            return
        }

        const nextActiveBlock = editorContent.blocks.find(
            block =>
                block.id === pendingFocusRequest.blockId && block.checkedState.type === "active"
        )
        if (!nextActiveBlock) {
            return
        }

        const handle = blockRefsRef.current.get(pendingFocusRequest.blockId)
        if (!handle) {
            return
        }

        handle.focusAndSetCaret(pendingFocusRequest.caret)
        setPendingFocusRequest(null)
    }, [editorContent.blocks, pendingFocusRequest])

    const handleFocus = useCallback(
        (blockId: string, caretPlacement?: CaretPlacement) => {
            const blocks = contentRef.current.blocks.map(x => {
                if (x.id === blockId) {
                    return x.withText(x.text).withCheckedState({ type: "active" })
                }
                return x
            })
            setEditorContent({ blocks })
            setPendingFocusRequest({
                blockId,
                caret: caretPlacement ?? { type: "end" }
            })
        },
        [emitContentChange, onBlockCommit]
    )

    const handleBlur = useCallback(
        (blockId: string, currentBlockContent?: string) => {
            const nextText = currentBlockContent!
            const nextBlocks = contentRef.current.blocks.map(block => {
                if (block.id !== blockId) {
                    return block
                }

                return block
                    .withText(nextText)
                    .withCheckedState({ type: "pending", date: new Date() })
            })

            const committedBlock = nextBlocks.find(block => block.id === blockId)
            if (!committedBlock) {
                return
            }

            const nextContent: EditorContent = { blocks: nextBlocks }
            emitContentChange(nextContent)
            onBlockCommit({ block: committedBlock, content: nextContent })
        },
        [emitContentChange, onBlockCommit]
    )

    const handleSplitForward = useCallback(
        (blockId: string, beforeText: string, afterText: string) => {
            const nextBlocks: Block[] = []
            let committedBlock: Block | null = null
            const newBlockId = uuidv4()

            for (const block of contentRef.current.blocks) {
                if (block.id !== blockId) {
                    nextBlocks.push(block)
                    continue
                }

                const pendingBlock = block
                    .withText(beforeText)
                    .withCheckedState({ type: "pending", date: new Date() })
                const activeBlock = new JournalBlock(newBlockId, { type: "active" }, []).withText(
                    afterText
                )

                nextBlocks.push(pendingBlock, activeBlock)
                committedBlock = pendingBlock
            }

            const nextContent: EditorContent = { blocks: nextBlocks }
            emitContentChange(nextContent)
            if (committedBlock) {
                onBlockCommit({ block: committedBlock, content: nextContent })
            }
            setPendingFocusRequest({
                blockId: newBlockId,
                caret: { type: "start" }
            })
        },
        [emitContentChange, onBlockCommit]
    )

    const handleMergeBackward = useCallback(
        (blockId: string, currentBlockContent: string) => {
            const index = contentRef.current.blocks.findIndex(block => block.id === blockId)
            if (index <= 0) {
                return
            }

            const previousBlock = contentRef.current.blocks[index - 1]
            const previousText = previousBlock.text
            const mergedText = previousText + currentBlockContent
            const nextBlocks = contentRef.current.blocks
                .filter(block => block.id !== blockId)
                .map(block => {
                    if (block.id !== previousBlock.id) {
                        return block
                    }

                    return previousBlock.withText(mergedText).withCheckedState({ type: "active" })
                })

            const nextContent: EditorContent = { blocks: nextBlocks }
            emitContentChange(nextContent)
            setPendingFocusRequest({
                blockId: previousBlock.id,
                caret: { type: "offset", offset: previousText.length }
            })
        },
        [emitContentChange]
    )

    const handleMove = useCallback(
        (blockId: string, direction: "next" | "previous", currentBlockContent?: string) => {
            const index = contentRef.current.blocks.findIndex(block => block.id === blockId)
            const targetIndex = direction === "previous" ? index - 1 : index + 1

            if (targetIndex < 0 || targetIndex >= contentRef.current.blocks.length) {
                return
            }

            moveFocusToBlock(
                contentRef.current,
                contentRef.current.blocks[targetIndex].id,
                direction === "previous" ? { type: "end" } : { type: "start" },
                currentBlockContent!,
                emitContentChange,
                onBlockCommit,
                setPendingFocusRequest
            )
        },
        [emitContentChange, onBlockCommit]
    )

    const handleFixMistake = useCallback(
        (span: Span) => {
            onSpanInteraction({ span, interaction: "apply" })
        },
        [onSpanInteraction]
    )

    const handleEmptyEditorMouseDown = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            if (event.button !== 0 || contentRef.current.blocks.length > 0) {
                return
            }

            event.preventDefault()

            const blockId = uuidv4()
            const nextContent: EditorContent = {
                blocks: [new JournalBlock(blockId, { type: "active" }, [])]
            }

            emitContentChange(nextContent)
            setPendingFocusRequest({
                blockId,
                caret: { type: "start" }
            })
        },
        [emitContentChange]
    )

    return (
        <div
            className="jt-editor-root"
            data-revision={revision ?? 0}
            onMouseDown={handleEmptyEditorMouseDown}
        >
            <div className="jt-editor-shell">
                {editorContent.blocks.map((block, index) => (
                    <BlockNode
                        key={block.id}
                        ref={handle => {
                            setBlockRef(block.id, handle)
                        }}
                        block={block}
                        index={index + 1}
                        onFocus={caretPlacement => {
                            handleFocus(block.id, caretPlacement)
                        }}
                        onBlur={currentBlockContent => {
                            handleBlur(block.id, currentBlockContent)
                        }}
                        onSplitForward={(currentBlockContent, nextBlockContent) => {
                            handleSplitForward(block.id, currentBlockContent, nextBlockContent)
                        }}
                        onMergeBackward={currentBlockContent => {
                            handleMergeBackward(block.id, currentBlockContent)
                        }}
                        onMoveBackward={currentBlockContent => {
                            handleMove(block.id, "previous", currentBlockContent)
                        }}
                        onMoveForward={currentBlockContent => {
                            handleMove(block.id, "next", currentBlockContent)
                        }}
                        onFixMistake={handleFixMistake}
                    />
                ))}
            </div>
        </div>
    )
}

function activeBlockId(content: EditorContent) {
    return content.blocks.find(block => block.checkedState.type === "active")?.id ?? null
}

function moveFocusToBlock(
    content: EditorContent,
    blockId: string,
    caret: CaretPlacement,
    activeBlockText: string,
    emitContentChange: (nextContent: EditorContent) => void,
    onBlockCommit: (event: BlockCommitEvent) => void,
    setPendingFocusRequest: (request: PendingFocusRequest | null) => void
) {
    const activeId = activeBlockId(content)
    const nextBlocks = content.blocks.map(block => {
        if (block.id === activeId && block.checkedState.type === "active") {
            return block
                .withText(activeBlockText)
                .withCheckedState({ type: "pending", date: new Date() })
        }

        if (block.id === blockId) {
            return block.withText(block.text).withCheckedState({ type: "active" })
        }

        return block
    })

    const previousActiveBlock = nextBlocks.find(
        block => block.id === activeId && block.checkedState.type === "pending"
    )
    const nextContent: EditorContent = { blocks: nextBlocks }

    emitContentChange(nextContent)
    if (previousActiveBlock) {
        onBlockCommit({ block: previousActiveBlock, content: nextContent })
    }
    setPendingFocusRequest({ blockId, caret })
}

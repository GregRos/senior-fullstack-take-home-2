import type { Block, Span } from "../editor-props"
import type { CaretPlacement } from "./extensions/index"

export interface BlockNodeProps {
    block: Block
    index: number
    onFocus(caretPlacement?: CaretPlacement): void
    onBlur(currentBlockContent: string): void
    onSplitForward(currentBlockContent: string, nextBlockContent: string): void
    onMergeBackward(currentBlockContent: string): void
    onMoveBackward(currentBlockContent: string): void
    onMoveForward(currentBlockContent: string): void
    onFixMistake(span: Span): void
}

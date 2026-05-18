import type {
    FlatBlock,
    FlatSpan,
    CheckStateType as ModelCheckStateType,
    CheckedState as ModelCheckedState,
    EditorContent as ModelEditorContent
} from "@/model/journal"

/**
 * The editor component is responsible for displaying and editting journal entry content. Use
 * BlockNote as the underlying editor, but configure it as follows:
 */
export type HighlightKind = "mistake" | "error"
export type Span = FlatSpan
export type Block = FlatBlock
export type CheckedState = ModelCheckedState
export type CheckStateType = ModelCheckStateType
export type EditorContent = ModelEditorContent

export interface BlockCommitEvent {
    block: Block
    content: EditorContent
}
export interface SpanHoverEvent {
    span: Span
    content: string
}
export interface SpanInteractionEvent {
    span: Span
    interaction: "apply"
}

export interface EditorProps {
    onBlockCommit: (event: BlockCommitEvent) => void
    onSpanInteraction: (event: SpanInteractionEvent) => void
    content: EditorContent
    /**
     * Monotonic counter incremented by the caller whenever `content` changes for a reason that
     * originated outside the editor (server correction, "apply fix", etc.). The editor uses this as
     * a signal to fully resync its internal document from `content` and to wipe any intra-session
     * history state. The counter is NOT bumped for routine echoes of the editor's own change
     * events.
     */
    revision?: number
}

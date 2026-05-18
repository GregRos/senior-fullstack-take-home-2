import type { HighlightKind } from "../editor-props"

export interface MistakeTooltipProps {
    kind: HighlightKind
    before: string
    after: string
    category: string
    content: string
    canApply: boolean
}

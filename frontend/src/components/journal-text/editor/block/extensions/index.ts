export { JournalDoc, JournalParagraph, buildTextDoc } from "./basics"
export {
    JournalHistory,
    caretPlacementFromCoords,
    focusPositionFromCaret,
    plainTextFromView,
    type CaretPlacement
} from "./caret"
export {
    computeHighlights,
    createHighlightDecorationExtension,
    syncHighlightDecorations,
    type HighlightDecoration
} from "./highlights"
export { createShortcutExtension, type BoundaryNavigationCallbacks } from "./keyboardNavigation"

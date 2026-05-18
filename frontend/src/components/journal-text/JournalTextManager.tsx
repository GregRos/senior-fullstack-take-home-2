// ---------------------------------------------------------------------------
// JournalTextManager — wraps the Tiptap editor with the JournalText state model.
//
// Responsibilities (extended in v2):
//   1. Hold the canonical JournalText state, derived initially from the
//      caller-supplied Output list (one per paragraph).
//   2. Reconcile editor change events back into JournalText.
//   3. On block commit (block becomes pending), call the CorrectionService
//      and, when the response arrives, replace the block's spans with the
//      parsed Output — provided the user hasn't refocused the block in the
//      meantime (stale-correction guard via the pending timestamp).
//   4. On span "apply", delegate to JournalText.applyFix.
//   5. Bump `revision` for non-typing external updates so each block can
//      resync its local document and clear any stale intra-session history.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { type CorrectionService } from "@/model/correction-service"
import { JournalText } from "@/model/journal"
import type { TextCorrectionsJson } from "../../model/corrections"
import { useCorrectionService } from "./CorrectionService"
import Editor from "./editor/Editor"
import type { Block as EditorBlock, EditorContent, Span as EditorSpan } from "./editor/editor-props"

export interface JournalTextManagerProps {
    /**
     * Initial state of the document, expressed as one correction Output per paragraph. All blocks
     * start in the `checked` state.
     */
    readonly outputs?: TextCorrectionsJson[]
    readonly journal?: JournalText
    readonly language?: string
    readonly onChange?: React.Dispatch<React.SetStateAction<JournalText>>
}
export default function JournalTextManager({
    outputs,
    journal: controlledJournal,
    language,
    onChange
}: JournalTextManagerProps) {
    const service = useCorrectionService()

    const [uncontrolledJournal, setUncontrolledJournal] = useState<JournalText>(() =>
        JournalText.fromOutputs(outputs ?? [])
    )
    const [revision, setRevision] = useState(0)
    const journal = controlledJournal ?? uncontrolledJournal
    const setJournal = onChange ?? setUncontrolledJournal

    useEffect(() => {
        if (controlledJournal || !outputs) return
        setUncontrolledJournal(JournalText.fromOutputs(outputs))
        setRevision(0)
    }, [controlledJournal, outputs])

    // Latest references for use inside async / callback code.
    const journalRef = useRef(journal)
    journalRef.current = journal

    const editorContent: EditorContent = useMemo(() => journal.toEditorContent(), [journal])

    // -------------------------------------------------------------------------
    // Editor event handlers
    // -------------------------------------------------------------------------

    const handleBlockCommit = useCallback(
        ({ block, content }: { block: EditorBlock; content: EditorContent }) => {
            const mergedJournal = journalRef.current.mergeEditorContent(content)
            journalRef.current = mergedJournal

            if (block.isEmpty) {
                setJournal(() => {
                    const nextJournal = mergedJournal.setBlockCheckedState(block.id, {
                        type: "checked",
                        date: new Date()
                    })
                    journalRef.current = nextJournal
                    return nextJournal
                })
                setRevision(r => r + 1)
                return
            }

            setJournal(mergedJournal)

            const pendingDate =
                block.checkedState.type === "pending" ? block.checkedState.date : new Date()

            requestCorrectionFor(
                service,
                journalRef,
                setJournal,
                setRevision,
                block.id,
                language,
                pendingDate
            )
        },
        [language, service]
    )

    const handleSpanInteraction = useCallback(
        ({ span, interaction }: { span: EditorSpan; interaction: "apply" }) => {
            if (interaction !== "apply") return
            if (span.type === "valid") return
            const next = journalRef.current.applyFix(span.id)
            journalRef.current = next
            setJournal(next)
            setRevision(r => r + 1)
        },
        []
    )

    return (
        <Editor
            content={editorContent}
            revision={revision}
            onBlockCommit={handleBlockCommit}
            onSpanInteraction={handleSpanInteraction}
        />
    )
}

function requestCorrectionFor(
    service: CorrectionService,
    journalRef: React.MutableRefObject<JournalText>,
    setJournal: React.Dispatch<React.SetStateAction<JournalText>>,
    setRevision: React.Dispatch<React.SetStateAction<number>>,
    blockId: string,
    language: string | undefined,
    pendingDate: Date
): void {
    const block = journalRef.current.getBlock(blockId)
    if (!block) return
    const idx = journalRef.current.blocks.indexOf(block)
    const previous = journalRef.current.blocks.slice(0, idx).map(b => b.text)
    const next = journalRef.current.blocks.slice(idx + 1).map(b => b.text)

    service
        .requestCorrection({
            paragraph: block.text,
            language,
            contextBefore: previous,
            contextAfter: next
        })
        .then((output: TextCorrectionsJson) => {
            setJournal(prev => {
                const current = prev.getBlock(blockId)
                if (!current) {
                    return prev
                }
                if (
                    current.checkedState.type !== "pending" ||
                    current.checkedState.date.getTime() !== pendingDate.getTime()
                ) {
                    // Stale: the user refocused (or the block was edited) since the
                    // request was issued. Drop the result.
                    return prev
                }
                const updated = prev.setBlockFromOutput(blockId, output)
                journalRef.current = updated
                // Server-driven content update — bump revision so the editor
                // accepts the new spans and clears intra-session PM history.
                setRevision(r => r + 1)
                return updated
            })
        })
        .catch(err => {
            // eslint-disable-next-line no-console
            console.error("Correction request failed", err)
        })
}

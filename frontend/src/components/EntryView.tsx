import { getApi, type JournalEntry, type Language } from "@/api"
import JournalEntryFurniture, {
    type JournalEntrySavePayload
} from "@/components/JournalEntryFurniture"
import type { TextCorrectionsJson } from "@/model/corrections"
import { JournalText } from "@/model/journal"
import { DEFAULT_ENTRY_LANGUAGE } from "@/model/languages"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useBlocker, useParams } from "react-router-dom"
import "./EntryView.scss"

function outputsFromContent(content: Record<string, TextCorrectionsJson>): TextCorrectionsJson[] {
    return Object.keys(content)
        .sort((a, b) => Number(a) - Number(b))
        .map(k => content[k]!)
}

function journalFromEntry(entry: JournalEntry): JournalText {
    return JournalText.fromOutputs(
        outputsFromContent(entry.content as Record<string, TextCorrectionsJson>)
    )
}

export interface EntryViewProps {
    readonly entryTitle: string
    readonly languages: readonly Language[]
    readonly onEntrySaved?: (savedEntry: EntryViewSavedEntry) => Promise<void> | void
}

export interface EntryViewSavedEntry {
    readonly id: string
    readonly title: string
}

export default function EntryView({ entryTitle, languages, onEntrySaved }: EntryViewProps) {
    const { id } = useParams<{ id: string }>()
    const [entry, setEntry] = useState<JournalEntry | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadEntry = useCallback(async () => {
        if (!id) return
        try {
            const nextEntry = await getApi().getEntry(Number(id))
            setEntry(nextEntry)
            setIsDirty(false)
            setError(null)
        } catch (err) {
            setError(String(err))
        }
    }, [id])

    useEffect(() => {
        void loadEntry()
    }, [loadEntry])

    useEffect(() => {
        if (!isDirty) return
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault()
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [isDirty])

    useBlocker(
        useCallback(
            ({ currentLocation, nextLocation }) => {
                if (!isDirty || currentLocation.pathname === nextLocation.pathname) return false
                const confirmed = window.confirm("You have unsaved changes. Leave without saving?")
                return !confirmed
            },
            [isDirty]
        )
    )

    const handleSave = useCallback(
        async (draftEntry: JournalEntrySavePayload) => {
            await getApi().updateEntry(draftEntry.entryId, {
                language: draftEntry.language,
                content: draftEntry.journal.toContentRecord()
            })
            await onEntrySaved?.({ id: String(draftEntry.entryId), title: draftEntry.title })
            await loadEntry()
        },
        [loadEntry, onEntrySaved]
    )

    const savedJournal = useMemo(() => (entry ? journalFromEntry(entry) : null), [entry])

    if (error) {
        return (
            <div className="entry-view app-message-state">
                <div className="app-message-state__content">
                    <p className="app-message-state__text app-message-state__text--error">
                        {error}
                    </p>
                </div>
            </div>
        )
    }

    if (!entry || !savedJournal) {
        return (
            <div className="entry-view app-message-state">
                <div className="app-message-state__content">
                    <p className="app-message-state__text">Loading…</p>
                </div>
            </div>
        )
    }

    return (
        <JournalEntryFurniture
            entryId={Number(id)}
            draftKey={entry.updatedAt}
            title={entryTitle}
            language={entry.language || DEFAULT_ENTRY_LANGUAGE}
            languages={languages}
            createdAt={entry.createdAt}
            journal={savedJournal}
            onDirtyChange={setIsDirty}
            onSave={handleSave}
        />
    )
}

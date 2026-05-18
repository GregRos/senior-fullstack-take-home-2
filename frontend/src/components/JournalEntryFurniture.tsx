import { getApi, type Language } from "@/api"
import { CorrectionServiceProvider } from "@/components/journal-text/CorrectionService"
import JournalTextManager from "@/components/journal-text/JournalTextManager"
import { ApiCorrectionService } from "@/model/correction-service"
import { JournalText } from "@/model/journal"
import { buildEntryLanguageOptions, DEFAULT_ENTRY_LANGUAGE } from "@/model/languages"
import { Button, Group, Select, Stack, Text, TextInput } from "@mantine/core"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

dayjs.extend(relativeTime)

export interface JournalEntryFurnitureProps {
    readonly entryId: number
    readonly draftKey: string
    readonly title: string
    readonly language: string
    readonly languages: readonly Language[]
    readonly createdAt: string
    readonly journal: JournalText
    readonly onDirtyChange?: (isDirty: boolean) => void
    readonly onSave: (entry: JournalEntrySavePayload) => void | Promise<void>
}

export interface JournalEntrySavePayload {
    readonly entryId: number
    readonly title: string
    readonly language: string
    readonly journal: JournalText
}

interface JournalEntryDraft {
    readonly title: string
    readonly language: string
    readonly journal: JournalText
}

interface SavedSnapshot {
    readonly entry: JournalEntryDraft
    readonly contentKey: string
}

function normaliseLanguage(language: string): string {
    return language || DEFAULT_ENTRY_LANGUAGE
}

function createDraftEntry(
    title: string,
    language: string,
    journal: JournalText
): JournalEntryDraft {
    return {
        title,
        language: normaliseLanguage(language),
        journal
    }
}

function createSavedSnapshot(title: string, language: string, journal: JournalText): SavedSnapshot {
    const entry = createDraftEntry(title, language, journal)
    return {
        entry,
        contentKey: JSON.stringify(journal.toContentRecord())
    }
}

function countWords(journal: JournalText): number {
    let count = 0
    for (const block of journal.blocks) {
        const words = block.text
            .trim()
            .split(/\s+/)
            .filter(word => word.length > 0)
        count += words.length
    }
    return count
}

const wordFormatter = new Intl.NumberFormat()

export default function JournalEntryFurniture({
    entryId,
    draftKey,
    title,
    language,
    languages,
    createdAt,
    journal,
    onDirtyChange,
    onSave
}: JournalEntryFurnitureProps) {
    const latestSavedRef = useRef(createSavedSnapshot(title, language, journal))
    const [draftEntry, setDraftEntry] = useState(() => latestSavedRef.current.entry)

    useEffect(() => {
        latestSavedRef.current = createSavedSnapshot(title, language, journal)
    }, [title, language, journal])

    useEffect(() => {
        setDraftEntry(latestSavedRef.current.entry)
    }, [entryId, draftKey])

    const languageOptions = useMemo(
        () => buildEntryLanguageOptions(languages, draftEntry.language),
        [draftEntry.language, languages]
    )
    const correctionService = useMemo(() => new ApiCorrectionService(getApi(), entryId), [entryId])
    const draftContentKey = useMemo(
        () => JSON.stringify(draftEntry.journal.toContentRecord()),
        [draftEntry.journal]
    )
    const savedEntry = latestSavedRef.current.entry
    const isDirty =
        draftEntry.title !== savedEntry.title ||
        draftEntry.language !== savedEntry.language ||
        draftContentKey !== latestSavedRef.current.contentKey

    useEffect(() => {
        onDirtyChange?.(isDirty)
    }, [isDirty, onDirtyChange])

    const handleLanguageChange = useCallback((nextLanguage: string | null) => {
        setDraftEntry(previousEntry => ({
            ...previousEntry,
            language: nextLanguage ?? DEFAULT_ENTRY_LANGUAGE
        }))
    }, [])
    const handleSave = useCallback(() => {
        return onSave({
            entryId,
            ...draftEntry
        })
    }, [draftEntry, entryId, onSave])

    const wordCount = countWords(draftEntry.journal)

    return (
        <>
            <Stack h="100%" gap="md">
                <Group align="flex-start" justify="space-between" wrap="wrap">
                    <Stack gap={4} style={{ flex: 1, minWidth: 240 }}>
                        <TextInput
                            aria-label="Entry title"
                            onChange={event => {
                                setDraftEntry(previousEntry => ({
                                    ...previousEntry,
                                    title: event.currentTarget.value
                                }))
                            }}
                            placeholder="Untitled entry"
                            styles={{
                                input: {
                                    height: "auto",
                                    padding: 0,
                                    fontSize: "1.75rem",
                                    fontWeight: 700,
                                    lineHeight: 1.2
                                }
                            }}
                            value={draftEntry.title}
                            variant="unstyled"
                        />
                        <Select
                            aria-label="Entry language"
                            data={languageOptions}
                            onChange={handleLanguageChange}
                            size="md"
                            value={draftEntry.language}
                            w={240}
                        />
                        <Text size="xs" c="dimmed">
                            created {dayjs(createdAt).fromNow()} &nbsp;|&nbsp;{" "}
                            {wordFormatter.format(wordCount)} words
                        </Text>
                    </Stack>

                    <Button onClick={handleSave}>Save</Button>
                </Group>

                <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                    <CorrectionServiceProvider service={correctionService}>
                        <JournalTextManager
                            journal={draftEntry.journal}
                            language={draftEntry.language}
                            onChange={nextJournal => {
                                setDraftEntry(previousEntry => ({
                                    ...previousEntry,
                                    journal:
                                        typeof nextJournal === "function"
                                            ? nextJournal(previousEntry.journal)
                                            : nextJournal
                                }))
                            }}
                        />
                    </CorrectionServiceProvider>
                </div>
            </Stack>
        </>
    )
}

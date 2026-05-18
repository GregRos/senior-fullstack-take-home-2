import { getApi, type JournalEntrySummary, type Language } from "@/api"
import EntryView, { type EntryViewSavedEntry } from "@/components/EntryView"
import JournalEntryList from "@/components/JournalEntryList"
import type { JournalEntryListItem } from "@/model"
import {
    buildEntryLanguageOptions,
    DEFAULT_ENTRY_LANGUAGE,
    getLanguageLabel
} from "@/model/languages"
import {
    AppShell,
    Button,
    Center,
    Group,
    Modal,
    Select,
    Stack,
    Text,
    TextInput
} from "@mantine/core"
import { useCallback, useEffect, useRef, useState } from "react"
import { Route, Routes, useMatch, useNavigate } from "react-router-dom"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTRY_TITLE_STORAGE_KEY = "journal-entry-titles"

function readStoredEntryTitles(): Record<string, string> {
    if (typeof window === "undefined") return {}

    try {
        const raw = window.localStorage.getItem(ENTRY_TITLE_STORAGE_KEY)
        if (!raw) return {}

        const parsed = JSON.parse(raw) as Record<string, unknown>
        return Object.fromEntries(
            Object.entries(parsed).flatMap(([id, value]) => {
                if (typeof value !== "string") return []
                const title = value.trim()
                return title ? [[id, title]] : []
            })
        )
    } catch {
        return {}
    }
}

function persistEntryTitles(entryTitles: Record<string, string>): void {
    if (typeof window === "undefined") return
    window.localStorage.setItem(ENTRY_TITLE_STORAGE_KEY, JSON.stringify(entryTitles))
}

function listItemFromSummary(
    entry: JournalEntrySummary,
    languages: readonly Language[],
    titleOverride?: string | null
): JournalEntryListItem {
    const title = titleOverride?.trim() || null

    return {
        id: String(entry.id ?? ""),
        title: title || null,
        languageLabel: getLanguageLabel(entry.language, languages),
        startedAt: entry.createdAt,
        mistakeCount: entry.mistakeCount
    }
}

function withUpdatedEntryTitle(
    entryTitles: Record<string, string>,
    id: string,
    title: string
): Record<string, string> {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
        return Object.fromEntries(Object.entries(entryTitles).filter(([entryId]) => entryId !== id))
    }

    return { ...entryTitles, [id]: title }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
    const navigate = useNavigate()
    const selectedId = useMatch("/entry/:id")?.params.id
    const [entries, setEntries] = useState<JournalEntryListItem[]>([])
    const [languages, setLanguages] = useState<Language[]>([])
    const [entryTitles, setEntryTitles] = useState<Record<string, string>>(() =>
        readStoredEntryTitles()
    )
    const entryTitlesRef = useRef(entryTitles)
    const [isCreatingEntry, setIsCreatingEntry] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isDeletingEntry, setIsDeletingEntry] = useState(false)
    const [createEntryError, setCreateEntryError] = useState<string | null>(null)
    const [newEntryTitle, setNewEntryTitle] = useState("")
    const [newEntryLanguage, setNewEntryLanguage] = useState(DEFAULT_ENTRY_LANGUAGE)
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const createEntryLanguageOptions = buildEntryLanguageOptions(languages, newEntryLanguage)

    const loadLanguages = useCallback(async () => {
        const nextLanguages = await getApi().listLanguages()
        setLanguages(nextLanguages)
    }, [])

    const loadEntries = useCallback(async () => {
        const nextEntries = await getApi().listEntries()
        const nextTitles = entryTitlesRef.current
        setEntries(
            nextEntries.map(entry =>
                listItemFromSummary(entry, languages, nextTitles[String(entry.id)])
            )
        )
    }, [languages])

    useEffect(() => {
        entryTitlesRef.current = entryTitles
        persistEntryTitles(entryTitles)
    }, [entryTitles])

    useEffect(() => {
        void loadLanguages()
    }, [loadLanguages])

    useEffect(() => {
        void loadEntries()
    }, [loadEntries])

    const handleSelectEntry = useCallback(
        (id: string) => {
            navigate(`/entry/${id}`)
        },
        [navigate]
    )

    const handleOpenCreateModal = useCallback(() => {
        setNewEntryTitle("")
        setNewEntryLanguage(DEFAULT_ENTRY_LANGUAGE)
        setCreateEntryError(null)
        setIsCreateModalOpen(true)
    }, [])

    const handleCloseCreateModal = useCallback(() => {
        if (isCreatingEntry) return

        setCreateEntryError(null)
        setIsCreateModalOpen(false)
    }, [isCreatingEntry])

    const handleRequestDeleteEntry = useCallback((id: string) => {
        setPendingDeleteId(id)
    }, [])

    const handleCloseDeleteModal = useCallback(() => {
        if (isDeletingEntry) return

        setPendingDeleteId(null)
    }, [isDeletingEntry])

    const handleDeleteEntry = useCallback(async () => {
        if (!pendingDeleteId) return

        const id = pendingDeleteId

        setIsDeletingEntry(true)

        try {
            await getApi().deleteEntry(Number(id))

            setEntries(previousEntries => previousEntries.filter(entry => entry.id !== id))
            setEntryTitles(previousTitles => {
                const { [id]: _removedTitle, ...remainingTitles } = previousTitles
                entryTitlesRef.current = remainingTitles
                return remainingTitles
            })

            if (selectedId === id) {
                navigate("/")
            }

            setPendingDeleteId(null)
        } finally {
            setIsDeletingEntry(false)
        }
    }, [navigate, pendingDeleteId, selectedId])

    const handleEntrySaved = useCallback(
        async ({ id, title }: EntryViewSavedEntry) => {
            const nextTitles = withUpdatedEntryTitle(entryTitlesRef.current, id, title)
            entryTitlesRef.current = nextTitles
            setEntryTitles(nextTitles)
            await loadEntries()
        },
        [loadEntries]
    )

    const handleCreateEntry = useCallback(async () => {
        const title = newEntryTitle.trim()
        if (!title) {
            setCreateEntryError("Title is required.")
            return
        }

        setIsCreatingEntry(true)
        setCreateEntryError(null)

        try {
            const entry = await getApi().createEntry(newEntryLanguage)
            if (entry.id == null) {
                throw new Error("Entry creation did not return an id.")
            }

            const entryId = String(entry.id)

            setEntries(previousEntries => [
                listItemFromSummary(entry, languages, title),
                ...previousEntries.filter(previousEntry => previousEntry.id !== entryId)
            ])
            setEntryTitles(previousTitles => {
                const nextTitles = { ...previousTitles, [entryId]: title }
                entryTitlesRef.current = nextTitles
                return nextTitles
            })

            setIsCreateModalOpen(false)
            navigate(`/entry/${entry.id}`)
        } catch (error) {
            setCreateEntryError(error instanceof Error ? error.message : String(error))
        } finally {
            setIsCreatingEntry(false)
        }
    }, [navigate, newEntryLanguage, newEntryTitle])

    const pendingDeleteEntry = pendingDeleteId
        ? (entries.find(entry => entry.id === pendingDeleteId) ?? null)
        : null

    return (
        <>
            <AppShell navbar={{ width: 280, breakpoint: "sm" }} padding="md">
                <AppShell.Navbar p="md">
                    <JournalEntryList
                        entries={entries}
                        isCreatingEntry={isCreatingEntry}
                        onCreateEntry={handleOpenCreateModal}
                        onDeleteEntry={handleRequestDeleteEntry}
                        onSelectEntry={handleSelectEntry}
                        selectedId={selectedId}
                    />
                </AppShell.Navbar>

                <AppShell.Main>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <Center h="100%">
                                    <Text c="dimmed">Select an entry to get started.</Text>
                                </Center>
                            }
                        />
                        <Route
                            path="/entry/:id"
                            element={
                                <EntryView
                                    entryTitle={selectedId ? (entryTitles[selectedId] ?? "") : ""}
                                    languages={languages}
                                    onEntrySaved={handleEntrySaved}
                                />
                            }
                        />
                    </Routes>
                </AppShell.Main>
            </AppShell>

            <Modal
                centered
                closeOnClickOutside={!isCreatingEntry}
                closeOnEscape={!isCreatingEntry}
                onClose={handleCloseCreateModal}
                opened={isCreateModalOpen}
                title="Create a journal entry"
            >
                <form
                    onSubmit={event => {
                        event.preventDefault()
                        void handleCreateEntry()
                    }}
                >
                    <Stack gap="md">
                        <TextInput
                            autoFocus
                            label="Title"
                            onChange={event => {
                                setNewEntryTitle(event.currentTarget.value)
                            }}
                            placeholder="Morning reflections"
                            value={newEntryTitle}
                        />
                        <Select
                            aria-label="New entry language"
                            data={createEntryLanguageOptions}
                            label="Language"
                            onChange={value => {
                                setNewEntryLanguage(value ?? DEFAULT_ENTRY_LANGUAGE)
                            }}
                            value={newEntryLanguage}
                        />
                        {createEntryError ? (
                            <Text c="red" size="sm">
                                {createEntryError}
                            </Text>
                        ) : null}
                        <Group justify="flex-end">
                            <Button
                                disabled={isCreatingEntry}
                                onClick={handleCloseCreateModal}
                                type="button"
                                variant="default"
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={newEntryTitle.trim().length === 0}
                                loading={isCreatingEntry}
                                type="submit"
                            >
                                Create entry
                            </Button>
                        </Group>
                    </Stack>
                </form>
            </Modal>

            <Modal
                centered
                closeOnClickOutside={!isDeletingEntry}
                closeOnEscape={!isDeletingEntry}
                onClose={handleCloseDeleteModal}
                opened={pendingDeleteEntry != null}
                title="Delete journal entry"
            >
                <Stack gap="md">
                    <Text>
                        Are you sure you want to delete "{pendingDeleteEntry?.title ?? "Untitled"}"?
                        This cannot be undone.
                    </Text>
                    <Group justify="flex-end">
                        <Button
                            disabled={isDeletingEntry}
                            onClick={handleCloseDeleteModal}
                            type="button"
                            variant="default"
                        >
                            Cancel
                        </Button>
                        <Button
                            color="red"
                            loading={isDeletingEntry}
                            onClick={() => void handleDeleteEntry()}
                        >
                            Delete entry
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}

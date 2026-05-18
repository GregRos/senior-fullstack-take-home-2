import type { JournalEntryListItem } from "@/model"
import { ActionIcon, Group, Stack, Text, UnstyledButton } from "@mantine/core"
import { IconAlertCircle, IconCircleCheck, IconPlus, IconX } from "@tabler/icons-react"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(relativeTime)

export interface JournalEntryListProps {
    readonly entries: JournalEntryListItem[]
    readonly isCreatingEntry?: boolean
    readonly onCreateEntry?: () => void
    readonly onSelectEntry: (id: string) => void
    readonly onDeleteEntry?: (id: string) => void
    readonly selectedId?: string
}

export default function JournalEntryList({
    entries,
    isCreatingEntry = false,
    onCreateEntry,
    onDeleteEntry,
    onSelectEntry,
    selectedId
}: JournalEntryListProps) {
    const sorted = [...entries].sort((a, b) => {
        const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0
        const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0
        return bTime - aTime
    })

    const getEntryMeta = (entry: JournalEntryListItem): string => {
        const meta = [
            entry.languageLabel,
            entry.startedAt ? dayjs(entry.startedAt).fromNow() : "no date"
        ]
        return meta.filter(value => value && value.trim().length > 0).join(" • ")
    }

    const getRowStyle =
        (isSelected: boolean) =>
        (theme: {
            readonly radius: Record<string, string>
            readonly colors: Record<string, readonly string[]>
        }) => ({
            width: "100%",
            minHeight: 72,
            borderRadius: theme.radius.sm,
            backgroundColor: isSelected ? theme.colors.gray[1] : "transparent"
        })

    return (
        <Stack gap={0}>
            {onCreateEntry ? (
                <UnstyledButton
                    aria-label="Create entry"
                    disabled={isCreatingEntry}
                    onClick={onCreateEntry}
                    style={theme => ({
                        ...getRowStyle(false)(theme),
                        display: "block",
                        border: `1px solid ${theme.colors.blue[4]}`,
                        background: `linear-gradient(135deg, ${theme.colors.blue[1]} 0%, ${theme.colors.indigo[1]} 100%)`,
                        boxShadow: `inset 0 0 0 1px ${theme.colors.blue[2]}`
                    })}
                >
                    <Group align="center" justify="center" p="sm" wrap="nowrap">
                        <Group
                            align="center"
                            justify="center"
                            style={theme => ({
                                width: 44,
                                height: 44,
                                flexShrink: 0,
                                borderRadius: theme.radius.xl,
                                backgroundColor: theme.colors.blue[6],
                                color: theme.colors.gray[0],
                                boxShadow: `0 10px 20px -12px ${theme.colors.blue[9]}`
                            })}
                        >
                            <IconPlus size={24} stroke={2.6} />
                        </Group>
                    </Group>
                </UnstyledButton>
            ) : null}

            {sorted.map(entry => (
                <Group
                    key={entry.id}
                    align="center"
                    gap="xs"
                    p="sm"
                    style={getRowStyle(selectedId === entry.id)}
                    wrap="nowrap"
                >
                    <UnstyledButton onClick={() => onSelectEntry(entry.id)} style={{ flex: 1 }}>
                        <Group align="flex-start" wrap="nowrap" gap="xs">
                            {entry.mistakeCount > 0 ? (
                                <IconAlertCircle
                                    size={18}
                                    color="orange"
                                    style={{ flexShrink: 0, marginTop: 2 }}
                                />
                            ) : (
                                <IconCircleCheck
                                    size={18}
                                    color="green"
                                    style={{ flexShrink: 0, marginTop: 2 }}
                                />
                            )}
                            <Stack gap={2} style={{ flex: 1 }}>
                                <Text fw={700} size="sm" lineClamp={1}>
                                    {entry.title ?? "Untitled"}
                                </Text>
                                <Text size="xs" c="dimmed" lineClamp={1}>
                                    {getEntryMeta(entry)}
                                </Text>
                            </Stack>
                        </Group>
                    </UnstyledButton>

                    {onDeleteEntry ? (
                        <ActionIcon
                            aria-label="Remove entry"
                            color="gray"
                            onClick={() => {
                                onDeleteEntry(entry.id)
                            }}
                            size="sm"
                            variant="subtle"
                        >
                            <IconX size={14} />
                        </ActionIcon>
                    ) : null}
                </Group>
            ))}
        </Stack>
    )
}

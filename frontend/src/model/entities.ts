import { z } from "zod"

import { MistakeCategory, TextCorrections } from "./corrections"

const MyDateTime = z.string().datetime({ offset: true, local: true })
const MaybeId = z.number().int().nullable()

export const User = z.object({
    id: MaybeId,
    name: z.string(),
    createdAt: MyDateTime,
    credits: z.number().int(),
    model: z.string()
})
export type User = z.infer<typeof User>

export const JournalEntry = z.object({
    id: MaybeId,
    userId: z.number().int(),
    createdAt: MyDateTime,
    updatedAt: MyDateTime,
    language: z.string(),
    content: TextCorrections
})
export type JournalEntry = z.infer<typeof JournalEntry>

export const JournalEntrySummary = z.object({
    id: z.number().int(),
    userId: z.number().int(),
    createdAt: MyDateTime,
    updatedAt: MyDateTime,
    language: z.string()
})
export type JournalEntrySummary = z.infer<typeof JournalEntrySummary>

export const MistakeCategoryInfo = z.object({
    id: MaybeId,
    code: MistakeCategory,
    title: z.string()
})
export type MistakeCategoryInfo = z.infer<typeof MistakeCategoryInfo>

export const MistakeHistoryEntry = z.object({
    id: MaybeId,
    userId: z.number().int(),
    journalEntryId: z.number().int(),
    mistakeCategoryId: z.number().int(),
    createdAt: MyDateTime,
    category: MistakeCategory
})
export type MistakeHistoryEntry = z.infer<typeof MistakeHistoryEntry>

export const InferenceUsageEvent = z.object({
    id: MaybeId,
    userId: z.number().int(),
    createdAt: MyDateTime,
    eventType: z.string(),
    inTokens: z.number().int(),
    outTokens: z.number().int(),
    duration: z.number(),
    cost: z.number().int()
})
export type InferenceUsageEvent = z.infer<typeof InferenceUsageEvent>

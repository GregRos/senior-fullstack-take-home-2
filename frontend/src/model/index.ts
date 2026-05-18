// ---------------------------------------------------------------------------
// Zod schemas for the backend API response shapes.
// All field names mirror the backend's camelCase aliases (models.py uses
// `alias_generator=to_camel`).
// ---------------------------------------------------------------------------

import { z } from "zod"

import { TextCorrections } from "./corrections"

const DateTimeSchema = z.string().datetime({ offset: true, local: true })

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export const UserSchema = z.object({
    id: z.number().int(),
    name: z.string(),
    createdAt: DateTimeSchema,
    credits: z.number().int(),
    model: z.string()
})

export type UserJSON = z.infer<typeof UserSchema>

// ---------------------------------------------------------------------------
// JournalEntrySummary — no content field (mirrors JournalEntrySummary DTO)
// ---------------------------------------------------------------------------

export const JournalEntrySummarySchema = z.object({
    id: z.number().int(),
    userId: z.number().int(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    language: z.string()
})

export type JournalEntrySummaryJSON = z.infer<typeof JournalEntrySummarySchema>

// ---------------------------------------------------------------------------
// JournalEntry — full entry with correction output keyed by paragraph index
// ---------------------------------------------------------------------------

export const JournalEntrySchema = JournalEntrySummarySchema.extend({
    content: z.record(z.string(), TextCorrections)
})

export type JournalEntryJSON = z.infer<typeof JournalEntrySchema>

// ---------------------------------------------------------------------------
// MistakeCategory
// ---------------------------------------------------------------------------

export const MistakeCategorySchema = z.object({
    id: z.number().int(),
    code: z.string(),
    title: z.string()
})

export type MistakeCategoryJSON = z.infer<typeof MistakeCategorySchema>

// ---------------------------------------------------------------------------
// MistakeHistoryEntry
// ---------------------------------------------------------------------------

export const MistakeHistoryEntrySchema = z.object({
    id: z.number().int(),
    userId: z.number().int(),
    journalEntryId: z.number().int(),
    mistakeCategoryId: z.number().int(),
    createdAt: DateTimeSchema,
    category: z.string()
})

export type MistakeHistoryEntryJSON = z.infer<typeof MistakeHistoryEntrySchema>

// ---------------------------------------------------------------------------
// InferenceUsageEvent
// ---------------------------------------------------------------------------

export const InferenceUsageEventSchema = z.object({
    id: z.number().int(),
    userId: z.number().int(),
    createdAt: DateTimeSchema,
    eventType: z.string(),
    inTokens: z.number().int(),
    outTokens: z.number().int(),
    duration: z.number(),
    cost: z.number().int()
})

export type InferenceUsageEventJSON = z.infer<typeof InferenceUsageEventSchema>

// ---------------------------------------------------------------------------
// JournalEntryListItem — minimal shape needed to render the entry list
// ---------------------------------------------------------------------------

export interface JournalEntryListItem {
    readonly id: string
    readonly title: string | null
    readonly languageLabel: string | null
    readonly startedAt: string | null
    readonly mistakeCount: number
}

// ---------------------------------------------------------------------------
// EntryPatch — mirrors the backend _EntryPatch model (PATCH /api/entry/$ID)
// ---------------------------------------------------------------------------

export interface EntryPatch {
    readonly language?: string
}

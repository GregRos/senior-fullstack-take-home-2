// ---------------------------------------------------------------------------
// Journal entry schemas and types — mirrors the backend's `JournalEntry`
// model serialised with camelCase aliases.
// ---------------------------------------------------------------------------

import z from "zod"
import { TextCorrectionsJson } from "../model/corrections"

const _dt = z.string().datetime({ offset: true, local: true })

export const JournalEntrySummarySchema = z.object({
    id: z.number().int().nullable(),
    userId: z.number().int(),
    createdAt: _dt,
    updatedAt: _dt,
    language: z.string(),
    mistakeCount: z.number().int().nonnegative()
})

export type JournalEntrySummary = z.infer<typeof JournalEntrySummarySchema>

export const JournalEntrySchema = JournalEntrySummarySchema.extend({
    content: z.record(z.string(), z.unknown())
})

export type JournalEntry = z.infer<typeof JournalEntrySchema>

export interface JournalEntryUpdate {
    language?: string
    content?: Record<string, unknown>
}

export const CheckMistakesAckSchema = z.object({
    status: z.string(),
    entryId: z.number().int(),
    corrections: TextCorrectionsJson
})

export type CheckMistakesAck = z.infer<typeof CheckMistakesAckSchema>

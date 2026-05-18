// ---------------------------------------------------------------------------
// Daily mistake stats schema — mirrors the backend's `_DailyStats` model.
// ---------------------------------------------------------------------------

import z from "zod"

export const DailyMistakeStatsSchema = z.object({
    date: z.string(),
    total: z.number().int(),
    byType: z.record(z.string(), z.number().int())
})

export type DailyMistakeStats = z.infer<typeof DailyMistakeStatsSchema>

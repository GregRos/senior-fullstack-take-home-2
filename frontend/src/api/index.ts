// ---------------------------------------------------------------------------
// Public surface of the API layer. Callers should use the `getApi()` singleton
// and call specific methods — no raw HTTP primitives are exposed.
// ---------------------------------------------------------------------------

import { ApiClient } from "./client"

export { ApiClient, ApiError } from "./client"
export {
    CheckMistakesAckSchema,
    JournalEntrySchema,
    JournalEntrySummarySchema,
    type CheckMistakesAck,
    type JournalEntry,
    type JournalEntrySummary,
    type JournalEntryUpdate
} from "./entries"
export { LanguageSchema, type Language } from "./languages.ts"
export { DailyMistakeStatsSchema, type DailyMistakeStats } from "./stats"

let _api: ApiClient | undefined

export function getApi(): ApiClient {
    if (!_api) _api = new ApiClient()
    return _api
}

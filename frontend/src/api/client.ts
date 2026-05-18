// ---------------------------------------------------------------------------
// ApiClient — single hub for all backend requests.
//
// Calls GET /api/login once (no auth header) to obtain the user ID, then
// includes Authorization: {userId} on every subsequent request. All specific
// endpoint methods live here; no generic HTTP verbs are exposed.
// ---------------------------------------------------------------------------

import z from "zod"
import type { CorrectionRequest, TextCorrectionsJson } from "../model/corrections"
import {
    CheckMistakesAckSchema,
    JournalEntrySchema,
    JournalEntrySummarySchema,
    type JournalEntry,
    type JournalEntrySummary,
    type JournalEntryUpdate
} from "./entries"
import { LanguageSchema, type Language } from "./languages.ts"
import { DailyMistakeStatsSchema, type DailyMistakeStats } from "./stats"

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly detail: unknown,
        public readonly url: string
    ) {
        super(`${status} ${statusText} — ${url}`)
        this.name = "ApiError"
    }
}

const _UserSchema = z.object({ id: z.number().int(), name: z.string() })

export class ApiClient {
    private readonly baseUrl: string
    private userId: number | undefined
    private loginPromise: Promise<void> | undefined

    constructor(baseUrl: string = import.meta.env.VITE_SERVER_URL) {
        this.baseUrl = (baseUrl || "").replace(/\/+$/, "")
    }

    private ensureLoggedIn(): Promise<void> {
        return (this.loginPromise ??= this.doLogin())
    }

    private async doLogin(): Promise<void> {
        const raw = await this.request("GET", "/api/login", undefined, true)
        this.userId = _UserSchema.parse(raw).id
    }

    private async request(
        method: string,
        path: string,
        body?: unknown,
        skipAuth = false
    ): Promise<unknown> {
        if (!skipAuth) await this.ensureLoggedIn()

        const url = `${this.baseUrl}${path}`
        const headers: Record<string, string> = { Accept: "application/json" }
        if (!skipAuth) headers.Authorization = String(this.userId)

        let payload: BodyInit | undefined
        if (body !== undefined) {
            headers["Content-Type"] = "application/json"
            payload = JSON.stringify(body)
        }

        const response = await fetch(url, { method, headers, body: payload })

        if (response.status === 204) return undefined

        const text = await response.text()
        const data = text ? safeJsonParse(text) : undefined

        if (!response.ok) {
            throw new ApiError(
                response.status,
                response.statusText,
                (data as Record<string, unknown> | undefined)?.detail ?? data,
                url
            )
        }

        return data
    }

    async getMe(): Promise<{ id: number; name: string }> {
        return _UserSchema.parse(await this.request("GET", "/api/me"))
    }

    async listEntries(): Promise<JournalEntrySummary[]> {
        return z.array(JournalEntrySummarySchema).parse(await this.request("GET", "/api/entries"))
    }

    async listLanguages(): Promise<Language[]> {
        return z.array(LanguageSchema).parse(await this.request("GET", "/api/languages"))
    }

    async getEntry(id: number): Promise<JournalEntry> {
        return JournalEntrySchema.parse(await this.request("GET", `/api/entry/${id}`))
    }

    async createEntry(language?: string): Promise<JournalEntry> {
        const body = language ? { language } : undefined
        return JournalEntrySchema.parse(await this.request("POST", "/api/entry", body))
    }

    async updateEntry(id: number, patch: JournalEntryUpdate): Promise<JournalEntry> {
        const body: Record<string, unknown> = {}
        if (patch.language !== undefined) body.language = patch.language
        if (patch.content !== undefined) body.content = patch.content
        return JournalEntrySchema.parse(await this.request("PATCH", `/api/entry/${id}`, body))
    }

    async deleteEntry(id: number): Promise<void> {
        await this.request("DELETE", `/api/entry/${id}`)
    }

    async checkMistakes(id: number, req: CorrectionRequest): Promise<TextCorrectionsJson> {
        const ack = CheckMistakesAckSchema.parse(
            await this.request("POST", `/api/entry/${id}/mistakes`, {
                paragraph: req.paragraph,
                language: req.language,
                contextBefore: req.contextBefore ?? [],
                contextAfter: req.contextAfter ?? []
            })
        )
        return ack.corrections
    }

    async getStats(): Promise<DailyMistakeStats[]> {
        return z.array(DailyMistakeStatsSchema).parse(await this.request("GET", "/api/stats"))
    }
}

function safeJsonParse(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

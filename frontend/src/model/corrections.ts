// ---------------------------------------------------------------------------
// Correction-server payload types.
//
// Extracted from ../../../../prompt.md (the corrections agent's IO contract).
// The agent receives a paragraph plus context and returns an Output: a flat
// list of items where each item is either a plain text token, a Fix object
// describing a single mistake, or an error span for text that is wrong but
// cannot be corrected safely.
//
// Fixes can nest via the `target` field: a parent fix's target may itself be
// a list containing additional Fix objects. From the editor's point of view
// these nested fixes are hidden behind the outer fix; they only become
// visible (and individually applicable) once the outer fix has been applied.
// ---------------------------------------------------------------------------

import { z } from "zod"

export const MistakeCategory = z.string()
export type MistakeCategory = z.infer<typeof MistakeCategory>

export const ErrorCategory = z.enum(["unclear", "unexpected_language", "offensive"])
export type ErrorCategory = z.infer<typeof ErrorCategory>

export const _BaseSpan = z.object({
    source: z.string()
})

export const ValidSpanJson = _BaseSpan.extend({
    type: z.literal("valid")
})
export type ValidSpanJson = z.infer<typeof ValidSpanJson>

const _BaseMistakeSpan = _BaseSpan.extend({
    type: z.literal("mistake"),
    category: MistakeCategory,
    reason: z.string()
})
type _BaseMistakeSpan = z.infer<typeof _BaseMistakeSpan>

export const ErrorSpanJson = _BaseSpan.extend({
    type: z.literal("error"),
    category: ErrorCategory,
    reason: z.string()
})
export type ErrorSpanJson = z.infer<typeof ErrorSpanJson>

export type TargetItemJson = ValidSpanJson | MistakeSpanJson

export type TargetField = TargetItemJson[]

export const TargetField: z.ZodType<TargetField> = z.lazy(
    (): z.ZodType<NonErrorSpanJson[]> => NonErrorSpanJson.array()
)

export const MistakeSpanJson = _BaseMistakeSpan.extend({
    target: TargetField
})
export type MistakeSpanJson = z.infer<typeof MistakeSpanJson>

export const NonErrorSpanJson = z.lazy(() => z.union([ValidSpanJson, MistakeSpanJson]))
export type NonErrorSpanJson = MistakeSpanJson | ValidSpanJson
export const AnySpanJson = z.lazy(() => z.union([NonErrorSpanJson, ErrorSpanJson]))
export type AnySpanJson = z.infer<typeof AnySpanJson>
export const TextCorrectionsJson = z.array(AnySpanJson)
export type TextCorrectionsJson = z.infer<typeof TextCorrectionsJson>

export function parseTextCorrections(value: unknown): TextCorrectionsJson {
    return TextCorrectionsJson.parse(value)
}

export function createPlainToken(text: string): ValidSpanJson {
    return ValidSpanJson.parse({ type: "valid", source: text })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The source-text span of a fix (the part of the original text it covers). */
export function fixSourceText(fix: MistakeSpanJson): string {
    return fix.source
}

/** The text the fix proposes as a correction. */
export function fixTargetText(fix: MistakeSpanJson): string {
    return fixTargetToText(fix.target)
}

/**
 * The immediate text produced by applying only this outer fix. Nested mistake spans remain
 * unresolved and therefore contribute their source text.
 */
export function fixImmediateTargetText(fix: MistakeSpanJson): string {
    return fix.target.map(outputItemSourceText).join("")
}

function fixTargetToText(target: TargetField): string {
    return target.map(outputItemText).join("")
}

function outputItemText(item: AnySpanJson): string {
    switch (item.type) {
        case "valid":
            return item.source
        case "error":
            return item.source
        default:
            return fixTargetText(item)
    }
}

/** The plain-text source of an output item (used to reconstruct input text). */
export function outputItemSourceText(item: AnySpanJson): string {
    switch (item.type) {
        case "valid":
            return item.source
        case "error":
            return item.source
        default:
            return fixSourceText(item)
    }
}

/** Reconstruct the input text covered by an Output payload. */
export function outputSourceText(output: TextCorrectionsJson): string {
    return output.map(outputItemSourceText).join("")
}
export interface CorrectionRequest {
    /** The paragraph being corrected. */
    paragraph: string
    /** Selected entry language, or `auto` to let the agent detect it. */
    language?: string
    /** Previous paragraphs in the same document (context only). */
    contextBefore?: string[]
    /** Following paragraphs in the same document (context only). */
    contextAfter?: string[]
}

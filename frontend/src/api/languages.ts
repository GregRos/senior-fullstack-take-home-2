import z from "zod"

export const LanguageSchema = z.object({
    id: z.number().int().nullable(),
    code: z.string(),
    localName: z.string(),
    displayName: z.string()
})

export type Language = z.infer<typeof LanguageSchema>

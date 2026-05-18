export const AUTO_DETECT_ENTRY_LANGUAGE = "auto"
export const DEFAULT_ENTRY_LANGUAGE = "en-GB"
export const AUTO_DETECT_ENTRY_LANGUAGE_LABEL = "Auto-detect"

export interface AvailableLanguage {
    readonly code: string
    readonly localName: string
    readonly displayName: string
}

export interface EntryLanguageOption {
    readonly value: string
    readonly label: string
}

export function buildEntryLanguageOptions(
    languages: readonly AvailableLanguage[],
    selectedLanguage?: string
): EntryLanguageOption[] {
    const options = [
        { value: AUTO_DETECT_ENTRY_LANGUAGE, label: AUTO_DETECT_ENTRY_LANGUAGE_LABEL },
        ...languages.map(language => ({ value: language.code, label: language.displayName }))
    ]

    const normalizedSelectedLanguage = selectedLanguage?.trim()
    if (
        normalizedSelectedLanguage &&
        !options.some(option => option.value === normalizedSelectedLanguage)
    ) {
        options.push({ value: normalizedSelectedLanguage, label: normalizedSelectedLanguage })
    }

    return options
}

export function getLanguageLabel(
    language: string,
    languages: readonly AvailableLanguage[]
): string {
    const normalizedLanguage = language.trim()
    if (!normalizedLanguage) return "Unknown language"
    if (normalizedLanguage === AUTO_DETECT_ENTRY_LANGUAGE) {
        return AUTO_DETECT_ENTRY_LANGUAGE_LABEL
    }

    return (
        languages.find(option => option.code === normalizedLanguage)?.displayName ??
        normalizedLanguage
    )
}

// ---------------------------------------------------------------------------
// CorrectionService — abstracts the "ask the server for corrections" call.
//
// JournalTextManager pulls the service out of React context, so consumers can
// substitute a real backend, a recorded fixture, or the mock implementation
// shipped here. The current mock returns canned corrections after a short
// delay so the pending → checked transition is visible in the UI.
// ---------------------------------------------------------------------------

import { createContext, useContext, type ReactNode } from "react"

import type { CorrectionService } from "@/model/correction-service"

const CorrectionServiceContext = createContext<CorrectionService | null>(null)

export function CorrectionServiceProvider({
    service,
    children
}: {
    service: CorrectionService
    children: ReactNode
}) {
    return (
        <CorrectionServiceContext.Provider value={service}>
            {children}
        </CorrectionServiceContext.Provider>
    )
}

export function useCorrectionService(): CorrectionService {
    const service = useContext(CorrectionServiceContext)
    if (!service) {
        throw new Error("useCorrectionService must be used within a CorrectionServiceProvider")
    }
    return service
}

import type { ApiClient } from "../api/client"
import type { CorrectionRequest, TextCorrectionsJson } from "./corrections"

export class ApiCorrectionService implements CorrectionService {
    constructor(
        private readonly client: ApiClient,
        private readonly entryId: number
    ) {}

    requestCorrection(req: CorrectionRequest): Promise<TextCorrectionsJson> {
        return this.client.checkMistakes(this.entryId, req)
    }
}
export interface CorrectionService {
    /** Request a correction for the given paragraph. */
    requestCorrection(request: CorrectionRequest): Promise<TextCorrectionsJson>
}

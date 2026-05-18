import { isEqual } from "lodash"
import { v4 as uuidv4 } from "uuid"
import {
    AnySpanJson,
    ErrorSpanJson,
    MistakeSpanJson,
    TextCorrectionsJson,
    ValidSpanJson,
    createPlainToken,
    parseTextCorrections,
    type NonErrorSpanJson
} from "./corrections"

export interface PendingCheckedState {
    type: "pending"
    date: Date
}

export interface CheckedCheckedState {
    type: "checked"
    date: Date
}

export interface ActiveCheckedState {
    type: "active"
}

export type CheckedState = PendingCheckedState | CheckedCheckedState | ActiveCheckedState
export type CheckStateType = CheckedState["type"]

export abstract class SpanBase<Data extends { source: string; type: string }> {
    constructor(
        readonly id: string,
        readonly _data: Data
    ) {}

    get source() {
        return this._data.source
    }

    get type() {
        return this._data.type
    }

    get content() {
        return this.source
    }

    abstract get flat(): _FlatSpan

    abstract hasSpan(id: string): boolean

    toJSON() {
        return this._data
    }

    isContentEqualTo(other: SpanBase<any>) {
        return isEqual(this._data, other._data)
    }
}

export class ValidSpan extends SpanBase<ValidSpanJson> {
    get flat() {
        return this
    }

    hasSpan(id: string) {
        return this.id === id
    }
}

export class MistakeSpan<Children extends NonErrorSpanJson = NonErrorSpanJson> extends SpanBase<
    MistakeSpanJson & { target: Children[] }
> {
    get target(): __SpanByType<Children>[] {
        return this._data.target.map(span => wrapSpan(span) as any)
    }
    private _withTarget<NewChildren extends NonErrorSpanJson>(
        newTarget: __SpanByType<NewChildren>[]
    ) {
        return new MistakeSpan<NewChildren>(this.id, {
            ...this._data,
            target: newTarget.map(span => span._data as any)
        })
    }

    get targetSource() {
        return this._data.target.map(span => span.source).join("")
    }

    get category() {
        return this._data.category
    }

    get reason() {
        return this._data.reason
    }

    get flat() {
        return new MistakeSpan<ValidSpanJson>(this.id, {
            ...this._data,
            target: this._data.target.map(x => ({
                type: "valid",
                source: x.source
            }))
        })
    }

    hasSpan(id: string): boolean {
        if (this.id === id) return true
        return this.target.some(span => span.hasSpan(id))
    }
}

export class ErrorSpan extends SpanBase<ErrorSpanJson> {
    get flat() {
        return this
    }

    hasSpan(id: string) {
        return this.id === id
    }

    get category() {
        return this._data.category
    }

    get reason() {
        return this._data.reason
    }
}

export class JournalBlock<__Span extends _Span = _Span> {
    static fromOutput(
        output: TextCorrectionsJson,
        checkedState: CheckedState = { type: "checked", date: new Date() },
        id = uuidv4()
    ) {
        return new JournalBlock(
            id,
            checkedState,
            parseTextCorrections(output).map(span => wrapSpan(span))
        )
    }

    constructor(
        readonly id: string,
        readonly checkedState: CheckedState,
        readonly spans: __Span[]
    ) {}

    get source() {
        return this.spans.map(span => span.source).join("")
    }

    get text() {
        return this.source
    }

    get isEmpty() {
        return this.source.length === 0
    }

    hasSpan(id: string) {
        return this.spans.some(span => span.hasSpan(id))
    }

    private _withSpans<NewSpan extends _Span>(newSpans: NewSpan[]) {
        return new JournalBlock<NewSpan>(this.id, this.checkedState, newSpans)
    }

    isEditorEquivalent(editorBlock: FlatBlock) {
        const flatBlock = this.toEditorBlock()
        if (flatBlock.spans.length !== editorBlock.spans.length) return false
        for (let index = 0; index < flatBlock.spans.length; index++) {
            const currentSpan = flatBlock.spans[index]
            const editorSpan = editorBlock.spans[index]
            if (!currentSpan || !editorSpan) return false
            if (currentSpan.type !== editorSpan.type) return false
            if (currentSpan.content !== editorSpan.content) return false
        }
        return true
    }

    fixTopLevelSpan(spanId: string) {
        const newSpans = this.spans.flatMap(span => {
            if (span instanceof MistakeSpan) {
                if (span.id === spanId) {
                    return span.target
                }
            }
            return [span]
        })

        return this._withSpans(newSpans)
    }

    applyFix(spanId: string) {
        return this.fixTopLevelSpan(spanId)
    }

    get flat() {
        const flattenedSpans = this.spans.flatMap(span => span.flat)
        return new JournalBlock(this.id, this.checkedState, flattenedSpans)
    }

    toEditorBlock(): FlatBlock {
        return this.flat
    }

    withCheckedState(newCheckedState: CheckedState) {
        return new JournalBlock(this.id, newCheckedState, this.spans)
    }

    withSpans<NewSpan extends _Span>(newSpans: NewSpan[]) {
        return this._withSpans(newSpans)
    }

    withText(content: string) {
        if (!content) {
            return this.withSpans([])
        }

        return this.withSpans([
            new ValidSpan(this.spans[0]?.id ?? `${this.id}-span`, createPlainToken(content))
        ])
    }

    mergeEditorBlock(editorBlock: FlatBlock) {
        return editorBlock.withText(editorBlock.text)
    }

    toOutput() {
        return this.spans.map(span => span.toJSON())
    }

    toJSON() {
        return this.toOutput()
    }

    isContentEqualTo(other: JournalBlock<any>) {
        return isEqual(
            this.spans.map(span => span.toJSON()),
            other.spans.map(span => span.toJSON())
        )
    }
}
export type FlatBlock = JournalBlock<_FlatSpan>

export interface EditorContent {
    blocks: FlatBlock[]
}

export class JournalText<__Span extends _Span = _Span> {
    static empty() {
        return new JournalText(uuidv4(), [])
    }

    static fromOutputs(outputs: readonly TextCorrectionsJson[], id = uuidv4()) {
        return new JournalText(
            id,
            outputs.map(output => JournalBlock.fromOutput(output))
        )
    }

    static fromContentRecord(content: Record<string, TextCorrectionsJson>, id = uuidv4()) {
        return JournalText.fromOutputs(
            Object.keys(content)
                .sort((a, b) => Number(a) - Number(b))
                .map(key => content[key]!),
            id
        )
    }

    constructor(
        readonly id: string,
        readonly blocks: JournalBlock<__Span>[]
    ) {}

    _withBlocks<NewSpan extends _Span>(newBlocks: JournalBlock<NewSpan>[]) {
        return new JournalText<NewSpan>(this.id, newBlocks)
    }
    get source() {
        return this.blocks.map(block => block.source).join("\n")
    }

    getBlockIndex(block: string | JournalBlock<__Span>) {
        const blockId = typeof block === "string" ? block : block.id
        return this.blocks.findIndex(b => b.id === blockId)
    }

    mapBlocks<NewSpan extends _Span>(
        mapper: (block: JournalBlock<__Span>) => JournalBlock<NewSpan>
    ) {
        return this._withBlocks(this.blocks.map(mapper))
    }

    filterBlocks(predicate: (block: JournalBlock<__Span>) => boolean) {
        return this._withBlocks(this.blocks.filter(predicate))
    }

    getBlock(blockId: string) {
        return this.blocks.find(block => block.id === blockId) ?? null
    }

    get flat() {
        return this._withBlocks(this.blocks.map(block => block.flat))
    }

    toEditorContent(): EditorContent {
        return { blocks: this.blocks.map(block => block.flat) }
    }

    mergeEditorContent(editorContent: EditorContent): JournalText<_Span> {
        const existingById = new Map(this.blocks.map(block => [block.id, block]))
        const newBlocks: JournalBlock<_Span>[] = editorContent.blocks.map(block => {
            const existing = existingById.get(block.id)
            if (!existing) {
                return block.withText(block.text) as JournalBlock<_Span>
            }
            if (existing.isEditorEquivalent(block)) {
                return existing.withCheckedState(block.checkedState) as JournalBlock<_Span>
            }
            return existing.mergeEditorBlock(block) as JournalBlock<_Span>
        })
        return this._withBlocks(newBlocks)
    }

    fix(spanId: string) {
        const newBlocks = this.blocks.map(block => {
            if (block.hasSpan(spanId)) {
                return block.fixTopLevelSpan(spanId)
            }
            return block
        })

        return this._withBlocks(newBlocks)
    }

    applyFix(spanId: string) {
        return this.fix(spanId)
    }

    get activeBlock() {
        return this.blocks.find(block => block.checkedState.type === "active") || null
    }

    switchActiveBlock(blockId: string) {
        const blocks = this.blocks.map(block => {
            if (block.id === blockId) {
                return block.withCheckedState({ type: "active" })
            } else if (block.checkedState.type === "active") {
                return block.withCheckedState({ type: "pending", date: new Date() })
            }

            return block
        })
        return this._withBlocks(blocks)
    }

    toJSON() {
        const content = {} as Record<string, AnySpanJson[]>
        for (const [index, block] of this.blocks.entries()) {
            content[String(index)] = block.toJSON()
        }
        return content
    }

    toOutputs() {
        return this.blocks.map(block => block.toOutput())
    }

    toContentRecord() {
        return this.toJSON()
    }

    setBlockFromJson(blockId: string, blockJson: AnySpanJson[], checkedState: CheckedState) {
        const newBlocks = this.blocks.map(block => {
            if (block.id === blockId) {
                const spans = blockJson.map(span => wrapSpan(span))
                return new JournalBlock(blockId, checkedState, spans)
            }
            return block
        })
        return this._withBlocks(newBlocks)
    }

    setBlockFromOutput(
        blockId: string,
        output: TextCorrectionsJson,
        checkedState: CheckedState = { type: "checked", date: new Date() }
    ) {
        return this.setBlockFromJson(blockId, parseTextCorrections(output), checkedState)
    }

    setBlockCheckedState(blockId: string, checkedState: CheckedState) {
        return this._withBlocks(
            this.blocks.map(block =>
                block.id === blockId ? block.withCheckedState(checkedState) : block
            )
        )
    }

    removeBlock(blockId: string) {
        return this._withBlocks(this.blocks.filter(block => block.id !== blockId))
    }

    isContentEqualTo(other: JournalText<any>) {
        return isEqual(
            this.blocks.map(block => block.toJSON()),
            other.blocks.map(block => block.toJSON())
        )
    }
}
export type _Span = ValidSpan | MistakeSpan<any> | ErrorSpan
export type Span = _Span

export type __SpanByType<S extends { type: string }> = S["type"] extends "valid"
    ? ValidSpan
    : S["type"] extends "mistake"
      ? MistakeSpan<any>
      : S["type"] extends "error"
        ? ErrorSpan
        : never

export type _FlatSpan = ErrorSpan | ValidSpan | MistakeSpan<ValidSpanJson>
export type FlatSpan = _FlatSpan
export function wrapSpan<Data extends AnySpanJson>(data: Data, id = uuidv4()): __SpanByType<Data> {
    switch (data.type) {
        case "valid":
            return new ValidSpan(id, data) as any
        case "error":
            return new ErrorSpan(id, data) as any
        case "mistake":
            return new MistakeSpan(id, data) as any
        default:
            throw new Error(`Unknown span type: ${(data as any).type}`)
    }
}


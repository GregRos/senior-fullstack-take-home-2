import type { MistakeTooltipProps } from "./MistakeTooltipProps"

type MistakeTooltipRowProps = Pick<MistakeTooltipProps, "kind" | "before" | "after">

export default function MistakeTooltipRow({
    kind,
    before,
    after
}: MistakeTooltipRowProps) {
    const beforeClassName = `jt-tooltip-before jt-tooltip-before--${kind}`

    return (
        <div className="jt-tooltip-row">
            {before ? <span className={beforeClassName}>{before}</span> : null}
            {before && after ? <span className="jt-tooltip-arrow">→</span> : null}
            {after ? <span className="jt-tooltip-after">{after}</span> : null}
        </div>
    )
}
import { type MouseEvent as ReactMouseEvent } from "react"

import type { MistakeTooltipProps } from "./MistakeTooltipProps"

interface MistakeTooltipFooterProps extends Pick<
    MistakeTooltipProps,
    "kind" | "category" | "canApply"
> {
    onApplyFix: () => void
}

function formatTooltipCategory(category: string): string {
    return category.replace(/[_-]+/g, " ")
}

export default function MistakeTooltipFooter({
    kind,
    category,
    canApply,
    onApplyFix
}: MistakeTooltipFooterProps) {
    const categoryClassName = `jt-tooltip-category jt-tooltip-category--${kind}`

    return (
        <div className="jt-tooltip-footer">
            {canApply ? (
                <button
                    type="button"
                    className="jt-tooltip-apply"
                    onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onApplyFix()
                    }}
                >
                    Apply fix
                </button>
            ) : null}
            <div className={categoryClassName}>{formatTooltipCategory(category)}</div>
        </div>
    )
}

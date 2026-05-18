import {
    autoUpdate,
    flip,
    FloatingPortal,
    offset,
    safePolygon,
    shift,
    useDismiss,
    useFloating,
    useHover,
    useInteractions,
    useRole
} from "@floating-ui/react"

import { useState } from "react"

import MistakeTooltipFooter from "./MistakeTooltipFooter"
import type { MistakeTooltipProps } from "./MistakeTooltipProps"
import MistakeTooltipRow from "./MistakeTooltipRow"

interface MistakeTooltipComponentProps extends MistakeTooltipProps {
    referenceElement: HTMLElement | null
    onApplyFix: () => void
}

const HOVER_HIDE_DELAY_MS = 70

export default function MistakeTooltip({
    kind,
    before,
    after,
    category,
    content,
    canApply,
    referenceElement,
    onApplyFix
}: MistakeTooltipComponentProps) {
    const [isOpen, setIsOpen] = useState(false)
    const { refs, floatingStyles, context } = useFloating({
        elements: {
            reference: referenceElement
        },
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: "bottom-start",
        whileElementsMounted: autoUpdate,
        middleware: [offset(10), flip({ padding: 12 }), shift({ padding: 12 })]
    })
    const hover = useHover(context, {
        move: false,
        delay: { close: HOVER_HIDE_DELAY_MS },
        handleClose: safePolygon()
    })
    const dismiss = useDismiss(context)
    const role = useRole(context, { role: "tooltip" })
    const { getFloatingProps } = useInteractions([hover, dismiss, role])

    const tooltipClassName = `jt-tooltip jt-tooltip--${kind}`

    if (!isOpen || !referenceElement) {
        return null
    }

    return (
        <FloatingPortal>
            <div
                ref={refs.setFloating}
                {...getFloatingProps({
                    className: tooltipClassName,
                    style: floatingStyles
                })}
            >
                <MistakeTooltipRow kind={kind} before={before} after={after} />
                {content ? <div className="jt-tooltip-reason">{content}</div> : null}
                <MistakeTooltipFooter
                    kind={kind}
                    category={category}
                    canApply={canApply}
                    onApplyFix={onApplyFix}
                />
            </div>
        </FloatingPortal>
    )
}

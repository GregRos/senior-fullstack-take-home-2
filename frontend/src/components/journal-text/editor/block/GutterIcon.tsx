import { IconAlertTriangle, IconArrowRight, IconCircleCheck } from "@tabler/icons-react"

import type { CheckStateType } from "../editor-props"

interface GutterIconProps {
    state: CheckStateType
    hasMistakes: boolean
}

export default function GutterIcon({ state, hasMistakes }: GutterIconProps) {
    function getClassName() {
        const classes = ["jt-gutter-icon"]
        if (state === "active") {
            classes.push("jt-gutter-icon--active")
        } else if (state === "pending") {
            classes.push("jt-gutter-icon--pending")
        } else if (hasMistakes) {
            classes.push("jt-gutter-icon--warning")
        } else {
            classes.push("jt-gutter-icon--checked")
        }
        return classes.join(" ")
    }

    function getIcon() {
        if (state === "active") {
            return <IconArrowRight stroke={2} />
        }

        if (state === "pending") {
            return <span className="jt-spinner" />
        }

        if (hasMistakes) {
            return <IconAlertTriangle stroke={2} />
        }

        return <IconCircleCheck stroke={2} />
    }

    return <span className={getClassName()}>{getIcon()}</span>
}

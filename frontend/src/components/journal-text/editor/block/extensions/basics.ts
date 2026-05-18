import { Node } from "@tiptap/core"

export const JournalDoc = Node.create({
    name: "doc",
    topNode: true,
    content: "paragraph"
})

export const JournalParagraph = Node.create({
    name: "paragraph",
    group: "block",
    content: "text*",
    parseHTML() {
        return [{ tag: "p" }]
    },
    renderHTML({ HTMLAttributes }) {
        return ["p", HTMLAttributes, 0]
    }
})

export function buildTextDoc(text: string) {
    if (!text) {
        return { type: "doc", content: [{ type: "paragraph" }] }
    }

    return {
        type: "doc",
        content: [
            {
                type: "paragraph",
                content: [{ type: "text", text }]
            }
        ]
    }
}

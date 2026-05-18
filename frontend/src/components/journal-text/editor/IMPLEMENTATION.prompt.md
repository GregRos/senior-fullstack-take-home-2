Implementing [EDITOR.prompt.md](./EDITOR.prompt.md). The editor props are given in [editor-props.tsx](./editor-props.tsx) and the authoritative editor state in [STATE.prompt.md](../STATE.prompt.md).

Editable areas will be implemented using Tiptap and ProseMirror.

Each block is its own seperate tiptap instance.

Place the editor creation in a custom hook called `useTyEditor` that lives in [block/useTyEditor.ts](./block/useTyEditor.ts). This hook should return the editor instance and any other relevant state or handlers for the block.

mistakes are decorations. we convert the repr to ranges when content is fetched. note that content will never be fetched for an editor while the user is editting.

we assign IDs to blocks.

We handle merge/split ourselves. we capture backspace + enter (NOT using a keydown or events but using pm/tiptap extensions). if we're at the start of a block, we merge the blocks. for enter, this always splits blocks.

We also back/forward/up/down ourselves if this would transition across blocks. this raises a callback.

Each block is represented as a react BlockNode component.

The Editor does not directly interact with tiptap/pm at all, BlockNode owns the editor so it interacts with it.

BlockNode props are specified in [block-props.ts](./block/block-props.ts).

The block itself will change how its contents are rendered (i.e. with decorations or not) based on its state.

However a block can't really know if it should be focused or not. The Editor needs to determine which block is focused if any and change its props.

undo/redo only work when editting a single block and that's it. no undoing fixes or block transforms. when an editting sesh is over (i.e. the block is deselected), history is cleared for that editor.

Editting text in a block does not update the Editor automatically. The Editor is only updated when the block loses focus AND the block thinks edits occurred. When determining this, don't compare existing/current Tiptap content. Instead, just invalidate after any change in the text.

Blocks can lose focus organically (user clicks elsewhere), but they can also lose focus due to navigation and edits on the blocks. This is detected by the block but occurs in the Editor.

1. Pressing enter will split a block into two blocks and move the caret to the start of the 2nd block, while committing the first block.
2. Backspace at position 0 will try to merge the block with the previous block. If this succeeds, the focused block is deleted.
3. Arrow keys can move focus to the next/previous blocks. If this succeeds, the next/previous block is focused and the current block is blurred.

If an operation fails (i.e. there is no previous/next block), the focus loss and commit doesn't happen.

We use a single callback and a discriminated union for the different block-level events. Some events can cause a commit so they will have a text payload with the editted text. The callback should always be called once for any change.

Span events use a separate callback and can be called irrespective of block events.

The event types appear in [editor-props.tsx](./editor-props.tsx).

# Focus and caret

## Handling focus change by user

The CheckedState says whether a block should be focused or not. We set onBlur and onFocus handlers on the tiptap editor.

If a handler fires and this does not match the expected state, then we detect that focus has shifted leading to blur/focus events firing. Otherwise, those events don't fire, since there is no change in the intended focus state, so the focus shift must have been handled already.

## Handling focus change and caret positioning after merge/split

After merge/split focus moves to a different block.

when this happens, first the render loop sets the state of the block that should gain focus as active.

Then we imperatively call a `focusAndSetCaret` method on the block to force its caret to a computed position based on the split/merge operation.

Note that no programmatic token or intent is used and is not needed.

# Tooltips

Tooltips should use @floating-ui/react to anchor to decorated mistake spans, with timers and safePolygon.

When the mouse leaves the highlighted mistake, the tooltip should disappear.

Put tooltip logic into a separate component. Create a tooltip for each span and have the tooltip component decide whether it's open. But you need to capture the ref to the span at the block level and pass it down.

# CRITICAL INSTRUCTIONS

- DO NOT MEASURE THE SIZE OF DOM ELEMENTS/nodes for any reason. Do not use this technique to create overlays for highlighting.
- Do not change styling directly via JavaScript. Change classes and other attributes and specify styling in SCSS.
- Specify all icons in SCSS and their sizes. You may use an embedded style tag if needed for CSS variables.
- DO NOT create DOM nodes in the document at all.
- DO NOT mutate DOM nodes owned by PM, such as by assigning attributes or attaching handlers.
- PREFER going through PM/TipTap/BlockNote APIs

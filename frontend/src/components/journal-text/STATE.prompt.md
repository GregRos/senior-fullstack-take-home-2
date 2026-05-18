Extract out the types found in [corrections.ts](../../model/corrections.ts).

Note that the editor does not have the nested structure. Its input is flat. This means all the nested corrections are hidden (this is noted in [EDITOR.prompt.md](./editor/EDITOR.prompt.md)).

Create a class hierarchy for Block and Span objects wrapping the data received from the server. This is all contained in a parent clas called JournalText.

JournalText should be immutable. Actions on JournalText should return a new JournalText.

This JournalText should be the authoritative and complete state of the text and all the corrections. When the editor updates its representation, that should be merged into this class.

The JournalText should have a method providing a flattened representation of the text and corrections. It should be able to receive block updates from the editor and merge them into its own state, which will invalidate any nested corrections.

The JournalText should track whether blocks are pending, active, or checked.

The JournalText should be able to apply fixes to the text using a Span object with an id and returned an updated JournalText.

It should not track the editor state of which block is active. It's just a representation of the text and corrections.

# JournalTextManager

This is a component wrapping the Editor. It receives updates from the Editor and corrections from the server via a context object. This context will currently have a mocked implementation.

Its props should include the Output structure described in [corrections.ts](../../model/corrections.ts), which will serve as its initial state.

# If a mock editor component exists

In the mock editor component, use a [JournalTextManager](./JournalTextManager.tsx) instead of an Editor directly. Initialize it with the dummy initial state.

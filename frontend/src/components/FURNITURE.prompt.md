DO NOT EDIT THE EDITOR COMPONENT IN THIS SESH
DO NOT EDIT THE BACKEND IN THIS SESH

# Journal entry component

do not wire anyhting up just build the layout

should have a header

and a body which is of the type that JournalTextManager receives.

Under the title, have a tiny:

created X ago | N words

humanize the ago and the number of words using appropriate libraries

under the body of the entry ,there should be a save button. make the page stop navigation if there are changes that haven't been saved.

the save button calls `onSave` callback with the updated journal entry data.

Create a display of the journal entry which is just the editor embedded in this furniture.

# Journal entry list

A list of journal entries showing titles, created X ago

two rows with prominent title. ordered by created at desc

should receive base journal entry objects with just the necessary parts

an icon shows whether the entry has mistakes or not.

JournalEntryList should have a `onSelectEntry(id: string)` callback prop that will change the view when an entry is clicked. It should also have an `entries: JournalEntryListItem[]` prop that contains the data for the list.

# App

Should mount the journal entry list as a sidebar on the left and the journal entry component on the right. It should manage the state of which entry is selected and pass the appropriate data to each component.

It should use routing to manage the selected entry, so that the URL changes when a different entry is selected and the correct entry is shown when the page is refreshed.

Use react router.

# Buttons

a small X next to a journal entry to delete. On delete, create a confirmation modal.

A + button at the top of the entry list to add. button should be on a row like an entry.

clicking the button should open a modal asking for a title and a language.

This should go to `POST /api/entry` and you should receive an ID from this. Wait for a response before navigating the view. Meanwhile you can spin something.

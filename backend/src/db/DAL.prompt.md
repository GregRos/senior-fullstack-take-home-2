Data access layer should use SQLModel. Use asyncio for data access.
It should support:

```yaml
get_user(useR_id): gets a user by id
list_journal_entries(User): Lists journal entries for the user ordered by created_at desc. Returns a list of journal entry objects without content.
create_journal_entry(JournalEntry): creates a journal entry for the user
get_journal_entry(user_id, entry_id): gets a journal entry by id, checking that it belongs to the user
create_mistake_entry(MistakeEntry): creates a mistake entry for the user
create_inference_usage_event(InferenceUsageEvent): creates an inference usage event for the user
```

(More were later added)

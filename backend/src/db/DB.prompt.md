The following tables are used:

```yaml JournalEntries
# everything is required
id: primary key autoincrement
user_id: Users.id foreign key (owned by)
created_At: date when entry was created, should be indexed with user_id
updated_at: date when entry was updated, should be indexed with user_id
language: language code
content: |
    serialized form of journey entry state with mistakes and all
    see [corrections.ts](../../../frontend/src/model/corrections.ts) and [agent/models.py](../agent/models.py)
    this data INCLUDES mistake spans and reasons
    data shape is not part of the schema.
```

```yaml Users
# everything is required
id: primary key autoincrement
interface_language_id: Languages.id foreign key
name: name string
created_at: timestamp
credits: an int for total credits
model: (fill in gpt-5-mini ID)
CREATE:
    name: you
    created_at: $(now)
    password: lulz no
    credits: Infinity
    model: openai/gpt-5-mini
```

```yaml MistakeHistoryEntries
# This is added after a mistakes API call. it's just here for statistics. we only save a little mistake info here. it's NOT an authoritative source for mistakes!
# everything is required
id: primary key autoincrement
user_id: Users.id foreign key
journal_entry_id: JournalEntries.id foreign key (owned by)
mistake_category_id: MistakeCategories.id foreign key
created_at: timestamp
category: category string (can be anything as far as DB is concerned)
```

```yaml MistakeCategories
id: primary key autoincrement
code: string identifier code
title: human display string for the mistake type

CREATE: |
    autogenerate initial mistake types based on plausible mistakes
    make sure it includes an Other MistakeType.
```

```yaml Languages
# NOT IMPLEMENTED
id: primary key autoincrement
code: language code like en-GB
local_name: human friendly name of the language in that language (e.g. English, Español, etc.)
display_name: human friendly English name of the language (e.g. English, Spanish, etc.)
CREATE: |
    autogenerate a plausible set of initial languages
```

```yaml LanguageTexts
# NOT IMPLEMENTED
id: primary key autoincrement
language_id: Languages.id foreign key
key: string identifier for the text (e.g. "journal_title_placeholder")
text: the actual text in the language
CREATE:
    # generate for a plausible set of languages
    UNTITLED:
        en-GB: "Untitled"
        # ... other languages
    APPLY_FIX:
        en-GB: "Apply Fix"
        # ... other languages
    SAVE:
        en-GB: "Save"
        # ... other languages
```

## Metrics

These might be better tracked in a separate analytics DB, but for simplicity we'll track them here.

```yaml InferenceUsageEvents
id: primary key autoincrement
user_id: Users.id foreign key
created_at: timestamp
event_type: string (use 'correction')
in_tokens: int (number of tokens in the prompt/context)
out_tokens: int (number of tokens in the response)
duration: float64 (duration of the API call in seconds)
cost: int (for tracking usage for stats and credits)
```

## Seeding

Seed the DB with a fake journal history as a demonstration. Make sure to use the span classes. Do not hand-write JSON.

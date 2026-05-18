# Solution

## Running
An OpenAI API key is required. It should go in  `.api-keys.yaml` at the repo root. See `.api-keys.example.yaml`.

```bash
docker build . --target backend-test
docker compose up --build -d --wait
curl http://localhost:8888/api/login # there is no real login
```

I used agents a lot when writing this code. You can find `*.prompt.md` files scattered across the repo which show some of my instructions. Not everything is in there, but a lot of it is. They can also serve a bit like documentation and can demonstrate my intent.

## Tech choices

```yaml
backend:
    language: python # Common for agentic backends
    web: unicorn + FastAPI # Common HTTP server and simple but idiomatic API bindings
    type safety: pydantic # Strong integration with the rest of the backend stack
    llm client: pydantic_ai # Lets me avoid annoying boilerplate
    llm: potentially flexible but tested with openai # I had an API key lying around
    orm: SQLModel # Good integration with the rest of the stack
    db: sqlite # Simplifies deployment
frontend:
    language: typescript # It's what you use
    ui framework: react # What I have most experience with
    type safety: zod # Strong integration with TypeScript, very ergonomic API, validation is important when running tons of agents
    router: react-router # It's a router... for React
    build tool: vite # What I use for projects that don't need SSR
    styling: scss # I just really like it.
    editor: Tiptap + ProseMirror # The overall editor surface is custom, but this is used for decorations, interior caret tracking, etc.
    tooltips: floating-ui # It does tooltips
llm development tools:
    harness: vscode/github copilot # I was using Cursor but credits are getting expensive
    model: gpt-5.4 # It works well
```

## Design
I really wanted to link corrections to the user's text in an intuitive way. So I decided to highlight mistakes in the user's text and not present them in some adjacent component. This means every mistake must be anchored to part of the user's text.

I chose not to do stage 2. However, I did choose to provide groundwork for that stage. Mistakes are categorized under types, are recorded to the database, and so on.

I think it's better to have a product that people might want to use and no visible usage statistics rather than a product no one wants to use and does have them.

### Some notes on history tracking and visualization
For stage 2, I would've gone for:

- A calendar heatmap showing how much the user has used the app (mistakes corrected/paragraphs written)
- Total count of mistakes fix using the app.
- A graph showing most common mistakes made over time, based on mistake category, probably using chartjs or something similar.

### Avoiding real-time correction
I didn't go for real-time highlighting either, though. This is for a few reasons:

1. The student might be struggling to write a complete sentence. It would be distracting to have mistakes shoved in their face.
2. The student's text might not be intelligble without context, so corrections might be completely off.
3. Even fast LLMs respond pretty slowly. Trying to correct the user's text as it's being written would create pretty substantial delays anyway.
4. Due to the previous reasons, inference responses would need to be invalidated frequently no matter what, which means wasting money.

I also really wanted to avoid specific Hard Problems, such as trying to reconcile mistakes from N seconds ago to the user's text as it is now.

### Paragraph-based system
Instead, I've gone for a hybrid system. The user's journal entry is divided into paragraphs that can each be editted and checked separately and in parallel. While the user is editting, no inference requests for that paragraph are sent and no highlights are shown.

The app only fetches correctiosn when the user is finished with that paragraph, and they appear within a short time. Hovering over a mistake shows a tooltip that explains the mistake, how it can be fixed, what its category is, and provides a button to fix it.

This creates a natural loop of:

```
write something -> move on while it's being checked -> receive corrections -> learn from mistakes
```

### Handling overlapping mistakes
Students can construct clauses with multiple mistakes that break several rules but apply to the same text.

Let's say we have the text:

> Steve shop goed.

This has three issues:

1. "goed" should be "went" which is a pretty common mistake.
2. The word order is wrong, again a common mistake for speakers of SOV languages, such as Japanese.
3. English requires the function words "to the" before "shop".

At the same time, it's pretty clear what the sentence means, so it can still be corrected. It's just that lumping the three corrections into a single interaction and listing them at once would be confusing. It also wouldn't allow for statistics gathering.

Instead, I've chosen to split the corrections as follows:

```yaml
word-order "store-goed -> goed store":
    conjugation "goed -> went":
    preposition "store -> to the store":
```

The user will first see the word order correction, fix it, and only then see the two child corrections for "went" and "to the store".

### Intended audience
The app is geared towards beginner/intermediate users of a language, rather than advanced users. The way in which the text is presented doesn't lend itself to writing long articles or making large changes to sentences. This is partly because I've been quite disappointed with such products in the past and rarely use LLMs to write prose.

I considered having an option for a user to select their skill level and to tweak the system prompt in various ways depending on that, but I decided this was out of scope.

### Language support
The app distinguishes between two languages:

1. The input language that the user is trying to learn. Each journey entry is written in a specific language.
2. The interface language. This is what the text is presented in.

A number of input languages are supported, such as German, French, and Korean. There is no RTL support.

Only English is supported as an interface language.

### Non-features

1. Auto-complete: Writing the user's text for them is counter-productive if they want to learn how to do it themselves.
2. Hints: I did consider having links to work definitions, grammar rules, and so on. But I decided not to.
3. Auto-save: You have to click a Save button. it's a pain, but I decided handling it was also a pain.
4. Mobile support: Decided it was out of scope.

## Implementation

### Development process
A lot of the implementation was generally done using agents. I run several agents in parallel focusing on different parts of the code. I typically store prompts for the agents in `*.prompt.md` files, and I've comitted these as an extra source of documentation and a view into the development process.

### Editor frontend
The editor is kind of like a block based editor, but none that I found let me avoid the "reconcile highlights" issue. I ended up using a custom implementation where each paragraph is separate editor and I handle keyboard bindings and events to make them seem connected.

This is probably not the most efficient way of doing it, but I really wanted to avoid having to reconcile anything.

### Data model
The best way to get a picture of the data model is to look at the examples for the model [here](./backend/src/agent/prompt/examples.py). It's defined [over here](./backend/src/agent/models.py). Another good source is [here](./backend/src/agent/prompt/system_prompt.py).

All communication with the model is via pydantic_ai mediated JSON. We send it a payload specifying the language(s) used, the current paragraph being checked, and the surrounding paragraphs for context.

The model responds by quoting the user's response as JSON objects containing spans of the user's text. Valid spans have `type: valid` while mistakes have `type: mistake`, together with the `reason` and a `target` field that tells the app what to correct the user's text to.

I chose this option because I was skeptical of an LLM's ability to, for example, point at specific bits of text via offsets. I thought I could get better results using a schema that was arranged in the same order as the text, with the user's input adjacent to the mistake.

It also allows for naturally nesting mistakes when we want to split them up. The `target` field itself can contain more mistake spans. This lets a single wrong phrase be decomposed into several wrong layers.

This works quite well. However, I have encountered some issues. The model doesn't always know how to use nested mistakes properly for example. If there are multiple mistakes, it doesn't always fix them all. A better approach might be just sending the corrected text to the model to construct this nested structure, or to do so once the user has finished fixing all the mistakes.

The results are not deterministic, of course. The LLM will highlight the same mistakes somewhat differently. If one letter is off, sometimes it will highlight just that letter, but other times it will highlight the word. There are also edge phrases or sentences that it will only sometimes mark as mistakes.

### Frontend data model
The frontend has its own version of the data model. It uses a set of classes to manipulate the body of a journal entry, compute decoration ranges, and apply fixes.

In the end the frontend does compute offsets for highlighting purposes.

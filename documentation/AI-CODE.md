# Documentation Module Instructions

## Content Organization

The JS client documentation follows Red Hat Modular Documentation with a three-layer hierarchy:

```
Title (guide)  →  titles/js_client.asciidoc
  └── Story (assembly)  →  stories/assembly_*.adoc
      └── Topic (reusable content)  →  topics/{con,proc,ref}_*.adoc
          └── Code examples  →  topics/code_examples/*.js
          └── Config examples  →  topics/config_examples/*.xml
```

### Titles
- Located in `asciidoc/titles/`
- Main entry point: `js_client.asciidoc`
- Sets document attributes and includes `stories.adoc`

### Stories (Assemblies)
- Located in `asciidoc/stories/`
- Named `assembly_*.adoc`
- Assemble multiple topics into a user journey
- Set and restore `:context:` for anchor scoping
- Include topics with `include::{topics}/proc_*.adoc[leveloffset=+1]`

### Topics
- Located in `asciidoc/topics/`
- Three types with strict naming prefixes:
  - **`con_*`** — Concept: explains what something is and why it matters
  - **`proc_*`** — Procedure: step-by-step instructions (uses `.Procedure` header with numbered steps)
  - **`ref_*`** — Reference: tables, API details, configuration options
- Each topic must have an ID: `[id='descriptive-name_{context}']`
- Topics are designed for reuse across multiple guides

### Code and Configuration Examples
- JavaScript code examples: `topics/code_examples/*.js`
- Server configuration examples: `topics/config_examples/*.xml`
- Include in topics with: `include::code_examples/myexample.js[]`

## Document Attributes

Use attributes defined in `topics/attributes/community-attributes.adoc`:
- `{brandname}` — "Infinispan" (never hardcode)
- `{hr_js}` — "Hot Rod JS"
- `{doc_home}`, `{server_docs}`, `{node_docs}` — external links

Community vs downstream content is controlled via `ifdef::community[]` / `ifdef::downstream[]` blocks.

## Writing Style

### Voice and Tense
- **Active voice**, present tense, second person ("you")
- Never use first person ("we", "I")
- No contractions ("do not", not "don't")
- American English spelling

### Formatting
- One sentence per line (hard wrap at sentence boundaries, not at column width)
- Use `{brandname}` and `{hr_js}` attributes, never hardcode product names
- File paths, class names, configuration attributes: backticks (`` ` ``)
- GUI elements: bold (`*Add*`)
- First occurrence of a term: italics (`_High availability_`)
- Numbers below 10: spell out ("four"); 10 and above: numerals ("12")
- Avoid Latin abbreviations (use "for example" not "e.g.", "that is" not "i.e.")
- Never use "simply" unless it genuinely clarifies

### Section IDs and Cross-References
- Section IDs use underscores: `[id='configuring-connections_{context}']`
- Reusable topics must include `{context}` in their ID
- Internal links: `link:#anchor_name[Link Text]`

### Admonitions
```asciidoc
[NOTE]
====
Note content.
====
```
Use `NOTE`, `TIP`, `WARNING`, `IMPORTANT` as appropriate.

### Code Blocks
```asciidoc
[source,javascript,options="nowrap",subs=attributes+]
----
include::code_examples/myexample.js[]
----
```

Always include code examples as separate files, not inline.

## Conditional Content

Use `ifdef` / `endif` for community vs enterprise content:
```asciidoc
ifdef::community[]
Community-only content here.
endif::community[]
```

## Terminology

- **Cache Manager** — two words, capitalized (use `CacheManager` only for the Java interface)
- **Off-heap** — always hyphenated when used as an adjective
- **Add/Remove** — for container membership; **Create/Delete** — for building/destroying objects; **Clear** — delete all elements

## Building Documentation
- Build HTML: `npm run docs:user`
- Output: `out/docs/index.html`
- Requires `asciidoctor` CLI

## When Creating New Documentation
1. Determine if the content is a concept, procedure, or reference — use the correct `con_`/`proc_`/`ref_` prefix
2. Place the topic file in `topics/`
3. Create or update an assembly in `stories/` to include the new topic
4. Update `stories.adoc` in the titles directory if adding a new assembly
5. Always set `[id='descriptive-name_{context}']` at the top of the topic
6. Include code examples as separate files in `topics/code_examples/`

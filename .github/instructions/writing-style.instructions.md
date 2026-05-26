---
applyTo: "docs/**/*.md"
description: "Writing style for the ALZ best-practices guide chapters under docs/."
---

# Writing style — ALZ best-practices guide

The chapters under `docs/` are a **book**, not a wiki or a slide deck. They
should read as continuous, flowing prose that walks the reader through a
chain of thought, with every paragraph picking up the thread of the
previous one. The reference for this style is the author's book
*Understanding and Designing Azure Networking* (Moreno & Stuart, BPB
Publications, 2025): when in doubt about tone, sentence length, or how
to introduce a topic, match that book.

These rules apply to chapter prose in `docs/*.md`. They do **not** apply
to `README.md`, `docs/references.md`, code blocks, tables, the
"In this chapter" TOC, navigation links, decision callouts, or the
numbered "Decision framework" question lists.

## Voice and tone

- Write in the **second person** ("you"). Avoid "we", and avoid
  impersonal constructions ("one should…", "it is recommended that…")
  unless they read more naturally in context.
- Address the reader as an intelligent peer who is here to make a
  decision, not as a beginner who needs to be hand-held or as a customer
  to be persuaded. State things directly.
- Do **not** open paragraphs with marketing or hedging fillers such as
  "Importantly,", "It's worth noting that,", "In today's fast-paced
  world,", "Notably," — start with the substantive claim.
- It is fine to use mild rhetorical devices ("After all,", "Fortunately,",
  "As before,") sparingly when they serve the chain of thought.

## Sentence and paragraph shape

- Prefer **long, well-structured sentences with subordinate clauses**
  over a sequence of short choppy sentences. A 30–50 word sentence that
  preserves a chain of thought is better than three 10-word sentences
  that fragment it.
- A **paragraph** should make one argument with two to five sentences of
  support. One-sentence paragraphs are a code smell — fuse them into the
  paragraph above or below using a subordinate clause or connective.
- The **first sentence of each paragraph** should state the paragraph's
  conclusion or claim; the rest supports it. (Inverted pyramid at the
  paragraph level.)
- Within a section, paragraphs should be ordered so that each one is the
  natural consequence or counterpoint of the previous one.

## Transitions — the most important rule

The single biggest failure mode of LLM-generated technical prose is that
it reads like a list of disconnected facts. Every paragraph **must**
visibly connect to the one before it. Use:

- **Backward references** that name the previous idea: *"The previous
  section already gave you a hint of how to…"*, *"As before, this pattern
  offers…"*, *"Thus far, Private Link has been discussed…"*, *"Where the
  behavior differs from X is…"*.
- **Connective adverbs and conjunctions** that signal the relationship:
  *However*, *Therefore*, *Yet*, *Although*, *Since*, *Because*,
  *Conversely*, *In contrast*, *By the same token*, *On the other hand*.
- **Forward hints** at the end of a section that prepare the next one:
  *"That naturally raises the question of how to…, which the next
  section addresses."*

At every `## H2` boundary, the closing sentence of one section should
hint at the next, and the opening paragraph of the next section should
acknowledge what came before when it is natural to do so. Section
headings themselves are not a substitute for a transition.

## Recommendations are embedded in prose, not labels

- **Never** lead a section, option, or pattern with a bolded
  `**Verdict:**`, `**Recommendation:**`, `**Bottom line:**`, or
  `**The principle:**` label. Convert the verdict into a normal topic
  sentence that *says* the recommendation in flowing language.
- A natural topic sentence that gives the recommendation up front is
  strictly better than a label + sentence. For example, prefer
  *"For roughly 80 % of enterprise estates, the right answer is a layered
  few-repo topology…"* over *"**Verdict:** layered few-repo for ~80 % of
  enterprises."*
- Inside an Options/Patterns comparison, each option's first paragraph
  should both describe the option *and* tell the reader when it applies
  and when it doesn't. Pros/Cons bullets follow as support — they don't
  replace the lead paragraph.

## Bullet lists

- Use bullets only when the content is **genuinely a list** — a set of
  questions to ask, a set of design constraints, a set of options, a
  checklist, a Pros/Cons enumeration. If the bullets are paraphrasing
  prose, convert them back to prose.
- Do **not** split a paragraph or a bullet item with a callout
  (`> 📘`, `> ⚖️`, `> 🎥`) in the middle. Callouts belong **before** or
  **after** the prose they relate to, never between two halves of a
  sentence or two bullets of the same list.
- A bulleted list does not need a colon-terminated "lead-in" if the
  preceding paragraph already makes the introduction natural.

## Recurring chapter-level structure

Each chapter (other than `14-anti-patterns.md`, which is a checklist
chapter) follows this skeleton:

1. `# NN · Title`
2. `**In this chapter:**` TOC bullets
3. `> Decision:` one-line decision callout
4. Navigation links
5. **Lead paragraph** — three to five sentences of prose that state the
   recommendation up front, name the central tradeoff in one line, and
   say who should read the chapter. No bolded label prefix.
6. `## How we got here` — historical context. This stays first as a
   house-style exception to strict pyramid order: the reader needs to
   know the journey before the decisions are meaningful.
7. `## Decision framework` — three to seven numbered questions, each
   followed by a one-line recommendation that links into the deeper
   section that explains it.
8. Deep analysis sections in order of decreasing importance. Each one
   opens with a topic sentence that states its conclusion.
9. `## Anti-patterns` near the end.
10. `## References` last.

`14-anti-patterns.md` skips `## How we got here` by design and starts
straight at `## Decision framework`.

## Vocabulary and references

- The first time an acronym appears in a chapter, expand it in
  parentheses: *Software-Defined Wide Area Network (SDWAN)*, *bring your
  own IP (BYOIP)*. Subsequent uses can be bare.
- Cross-chapter references should read as natural prose, not as bare
  bracketed links. Prefer *"covered in [03 modules & registries](…)"* over
  a parenthetical *"(see Chapter 3)"* dropped at the end of a sentence.
- Anchors in this repo use **single-dash** GitHub-style slugs (em-dashes
  in headings collapse to one dash, not two). Match the existing TOC.

## Caveats and exceptions

- Caveats belong in prose. Write *"There might be situations where Azure
  cannot fulfill that requirement; for example, if capacity is reduced…"*
  rather than spinning up a `> ⚠️ Caveat:` block.
- Genuine asides (a definition the reader can skip, an aside that breaks
  the narrative if inlined) belong in a `> 📘` callout placed between
  paragraphs, never inside one.

## What to leave alone when editing existing chapters

- Code blocks, including their internal formatting.
- Tables.
- The "In this chapter" TOC list (regenerate only if section ordering
  actually changes).
- The `> Decision:` callout.
- The numbered "Decision framework" question list.
- Existing `> 📘`, `> ⚖️`, `> 🎥` callouts — fix placement only if they
  split a paragraph or a bullet mid-sentence.
- References.

## Quick self-check before committing prose changes

1. Read the section aloud. Does each paragraph connect to the previous
   one with a visible transition?
2. Are there any bolded label prefixes (`**Verdict:**`, `**The
   principle:**`, `**Recommendation:**`, `**Layout sketch:**`)? Convert
   them to topic sentences.
3. Are there one-sentence paragraphs? Fuse them.
4. At each `## H2` boundary, is there a bridge between the closing
   sentence above and the opening sentence below?
5. Does the chapter still read in the second person, without slipping
   into "we" or impersonal constructions?
6. Are callouts cleanly placed between paragraphs, not splitting them?

If a change is purely structural (reordering sections, fixing anchors,
updating the TOC), the prose-flow checks above do not apply — but a
prose-flow pass is required afterwards.

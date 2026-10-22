# Label Check

Check a draft food or supplement label for risky claims and undeclared allergens **before you send it to print**, so you only pay an expert to look at what's actually risky.

> A screening aid, not legal advice. The tool can only say "no issues found against rule pack v0.1". It never says a label is "compliant".

---

## Job to be done

> **When** I've drafted the copy for a new product label and before I send it to print,
> **I want to** check its claims and allergen statements against the rules of the market I'm selling in,
> **so I can** fix risky wording before printing and only pay an expert for what's actually risky.

**User:** a bootstrapped founder launching a packaged food or supplement product, with no in-house labeling or regulatory person.

## The 3 tests the MVP must pass

| # | What I do | What must happen |
|---|---|---|
| 1 | Paste *"High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds"* and pick the **US (FDA)** rule pack | Within **10 seconds**, "helps manage diabetes" is flagged as a **high-severity disease claim**, with the rule ID and a rewrite I can copy |
| 2 | Same label | **Whey protein concentrate** is flagged as undeclared **milk** (HIGH), and **almonds** is flagged with its own rule (LOW: no "Contains:" line). The report shows the rule-pack version and says **"No issues found against rule pack v0.1"** for anything not flagged. It never says "compliant" |
| 3 | Submit empty text, a pasta recipe, random words, or an unreadable image | A plain message asks me to paste label text. No flags are invented and nothing crashes. Any AI flag without a valid rule ID is dropped before I see it |

**Why test 2 changed:** the first version flagged "almonds" as HIGH "not declared". Under US law (FALCPA), an ingredient name that identifies the allergen ("almonds", "peanut butter") already counts as the declaration. Only hidden sources like *whey* are truly undeclared. Almonds now get a LOW "best practice" note instead.

**Consistency check:** `npm run acceptance` also runs a second label five times and requires the same verdict every time: *"Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt"*.

---

## Current workflow → future workflow

| | Today (without the tool) | With Label Check |
|---|---|---|
| 1 | Write label copy in a doc | Same |
| 2 | Google the FDA/FSSAI rules and guess which wording is risky | Paste the copy (or upload a photo) and pick the market |
| 3 | Miss things like "whey" needing a "milk" declaration | Allergen sources are found by a fixed, published list |
| 4 | Pay a consultant to review **everything** | Get a report in seconds: each risky line, the rule it breaks and a suggested rewrite |
| 5 | Wait days and repeat after each edit | Fix the flagged lines, re-check instantly, and pay an expert to review **only the flagged items** |
| 6 | Print | Print with fewer surprises |

---

## Architecture: Input → AI → Logic → Action → Output

```
INPUT            AI (judgement)            LOGIC (plain code)               ACTION (you)            OUTPUT
─────            ──────────────            ──────────────────               ────────────            ──────
Label text  ─┐                             Input checks (empty/short/long)
             ├─▶ Is this a label?   ─▶     Drop AI flags with bad rule ID   Read each flag          Report:
Photo ──▶ ───┘   Find disease claims       or quotes not in your text       Copy / edit / ignore    · flags + rule + citation
 (AI reads it,   + write rewrites          Allergen check (keyword lists)   the rewrite             · suggested rewrites
  you review)                              Severity & citation from pack    Decide what goes        · "No issues found
Rule pack                                  "Compliant" filter               to an expert              against rule pack v0.1"
(US FDA / FSSAI)                           Build report                                             · "Not checked" items
```

1. **Input:** pasted label text or a photo, plus a rule pack: **US (FDA) v0.1** or **India (FSSAI) v0.1**. Plain-code checks reject empty, too-short or too-long text and bad image files before any AI call, so bad input costs nothing.
2. **AI:** one call decides whether the text is a label and finds disease claims, each with an exact quote, a rule ID and a rewrite. A separate call reads text from a photo. Answers must come back as JSON in a fixed shape, and the app re-checks that shape.
3. **Logic (plain code):** the rule packs (`lib/rulepacks/*.json`) hold every rule's ID, name, severity and citation. Code checks every AI flag and drops it if the rule ID isn't in the pack or the quote isn't in your text. Code runs the allergen check and builds the report.
4. **Action (you):** review the photo transcription, judge each flag, copy or ignore rewrites, and decide what an expert should see.
5. **Output:** the report on one screen. Each flag shows "Found by: AI" or "Found by: rule check", so you know which to trust more.

### Rule packs (v0.1, deliberately small)

| Pack | Rule ID | Rule | Checked by |
|---|---|---|---|
| US (FDA) | `US-FDA-DC-001` | Disease claim (FD&C Act §201(g)(1); 21 CFR 101.93(g)) | AI |
| US (FDA) | `US-FDA-ALG-001` | Major food allergen not declared, e.g. "whey" with no mention of milk (FD&C Act §403(w)) | Code |
| US (FDA) | `US-FDA-ALG-002` | LOW: allergen named only by the ingredient ("almonds"), which is legal but has no "Contains:" line | Code |
| India (FSSAI) | `FSSAI-DC-001` | Claim to prevent, treat or cure a disease (FSS Act 2006; Advertising & Claims Regs 2018) | AI |
| India (FSSAI) | `FSSAI-ALG-001` | Allergen not declared, including gluten cereals like **oats** and sulphites (Labelling & Display Regs 2020) | Code |

Adding a market means adding one JSON file in `lib/rulepacks/`.

---

## Where AI is used, and why

| AI job | Why not a simple rule? |
|---|---|
| **Read text from a photo** | Turning pixels into text needs vision |
| **Decide "is this a label?"** | A recipe and a label both have "Ingredients:"; keywords can't tell them apart |
| **Find disease claims and write rewrites** | The same claim can be worded endlessly ("helps manage diabetes", "great for diabetics"), and a good rewrite needs language skill |

**Everything else is plain code**, because it must be exact and give the same answer every time: the input checks, the allergen check (fixed published lists with exceptions like "peanut butter" ≠ milk), rule IDs, severities and citations, checking the AI's flags, the report wording, and the "compliant" filter.

## What stays human

- Checking the text the app read from a photo before running the check
- Deciding whether each flag is right, and whether to use, edit or ignore each rewrite
- Checking what the tool can't know: the real recipe, cross-contact, where the "Contains:" line sits on the artwork, and anything outside the 2 rules per pack
- **Having an expert confirm the rule citations.** They were written from general knowledge, and the FSSAI ones especially should be checked against the official text
- The final decision to print

## Why these tools

| Tool | Why |
|---|---|
| **Next.js** (App Router, TypeScript) | One project for both the screen and the server routes, and it deploys to Vercel with no extra setup |
| **OpenRouter + Gemini 3.8 Flash** | The plan was the Claude API, but the only key available is an OpenRouter key whose workspace allows only Google models. Gemini 3.8 Flash is fast (about 3 s per check), reads images, supports JSON-schema answers and costs well under a cent per check. All AI code is in one file (`lib/ai.ts`), so switching providers later means changing only that file |
| **Zod** | One definition of the AI's answer shape, used both to ask for that shape and to check the reply |
| **Vitest** | Free, fast unit tests for all the plain-code logic, with no AI calls |
| **Tailwind CSS** | Simple styling without separate CSS files |

## Failure cases, and what you see

| What goes wrong | What the app does |
|---|---|
| Empty, too-short or no-letters text | "Please paste your label text." (no AI call) |
| Text over 5,000 characters | "That's too long for one label. Paste just the label text." |
| A recipe, article or random words | "This doesn't look like product label text. Please paste your label text." No flags |
| Wrong file type, file over 5 MB, corrupt or blank image | "We couldn't read that. Please paste your label text." |
| The AI invents a quote, or gives a missing or unknown rule ID | Flag dropped, and the screen says "1 AI suggestion was removed…" |
| The AI writes "compliant" | Replaced by code before you see it |
| The AI misses a claim | Can't be caught automatically. The report never says "compliant" and lists exactly which rules were checked |
| The AI flags something harmless, or suggests a weak rewrite | The quote, reason and rule are shown, and rewrites are labelled "AI-written, check before using" |
| No ingredient list in the text | Allergen rule shown as **"Not checked: no ingredient list found"**, not "no issues" |
| AI answer slow (no reply in 6 s) | A backup request starts automatically, and whichever answers first wins |
| AI service down, both attempts fail, or a malformed answer | "The checker couldn't run. Please try again." No partial report |
| Borderline claims ("supports healthy blood sugar") | Each rule pack spells out what to flag and what not to flag, with a tie-break, so the same text gets the same verdict |
| First check after starting the app | The page pings both API routes on load, so they're ready before you click |
| Missing API key | "The checker isn't set up yet. Add your OpenRouter API key to .env.local…" |
| Browser blocks the clipboard | Copy button says "Blocked: select the text" |

**Known limitations:** v0.1 doesn't check structure/function claims ("supports healthy blood sugar"), nutrient content claims ("high protein") or "gluten-free" claims. The FSSAI pack still treats a missing "Contains:" line as undeclared, because Indian allergen rules haven't been checked against the official text.

---

## Run it locally

**You need:** [Node.js](https://nodejs.org) 22 or newer (developed on 24 LTS) and an [OpenRouter API key](https://openrouter.ai/settings/keys) whose workspace allows `google/gemini-3.8-flash`.

```bash
git clone https://github.com/adityasinghal-source/label-check.git
cd label-check
npm install
```

Copy `.env.example` to a new file called `.env.local` and replace `paste-your-key-here` with your OpenRouter key. `.env.local` is git-ignored, so the key is never committed.

```bash
npm run dev
```

Open http://localhost:3000, click **Use example label**, then **Check label**.

**For a demo or judging,** use the production build instead. It's faster and never pauses to compile:

```bash
npm run demo
```

This runs `next build` and then `next start`. Open http://localhost:3000 once the build finishes.

### Tests

```bash
npm test
```

Runs the unit tests (free, no AI calls).

```bash
npm run acceptance
```

Runs the 3 acceptance tests against the running app (`npm run dev` first). It uses the real AI and costs a fraction of a cent.

## Project layout

| Path | What it is |
|---|---|
| `app/page.tsx` | The one screen |
| `components/Report.tsx` | Report, flag cards, copy button |
| `app/api/check/route.ts` | Input checks → AI → logic → report |
| `app/api/read-image/route.ts` | Photo → label text |
| `lib/ai.ts` | The only file that talks to the AI |
| `lib/rulepacks/` | Rule packs (US FDA, FSSAI) as JSON |
| `lib/allergens.ts`, `lib/validateFlags.ts`, `lib/buildReport.ts`, `lib/inputGuard.ts` | Plain-code logic |
| `tests/` | Unit tests |
| `scripts/acceptance.mjs` | The 3 acceptance tests |

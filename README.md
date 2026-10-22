# ShelfReady

**Catch label problems before you print, for every market and channel you sell on.**

Paste a draft food or supplement label (or upload a photo), choose where you sell (the US, or India and its marketplaces), and get every risky claim, hidden allergen and missing declaration, with the rule it breaks and a fix. If a marketplace has already rejected you, paste the rejection too: ShelfReady explains the likely reason and points to the flags behind it.

> A screening aid, not legal advice. ShelfReady can only say "no issues found against rule pack v0.1". It never says a label is "compliant".

---

## Job to be done

> **When** I've drafted the copy for a new product label and before I send it to print,
> **I want to** check its claims and allergen statements against the rules of the market I'm selling in,
> **so I can** fix risky wording before printing and only pay an expert for what's actually risky.

**User:** a bootstrapped founder launching a packaged food or supplement product, with no in-house labeling or regulatory person.

## The tests it must pass

| # | What I do | What must happen |
|---|---|---|
| 1 | Paste *"High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds"*, choose **United States** | Within **10 seconds**, "helps manage diabetes" is flagged as a **high-severity disease claim**, with the rule ID, its source link and a rewrite I can copy |
| 2 | Same label, then the granola bites: *"Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt"* | Hidden allergens are found: **whey → milk** is flagged HIGH; the milk in *"natural flavor (contains milk)"* goes into the generated "Contains:" line. The report shows the rule-pack version and **"No issues found against rule pack v0.1"** for anything not flagged, and never says "compliant" |
| 3 | Submit empty text, a pasta recipe, random words, or an unreadable image | A plain message asks me to paste label text. No flags are invented and nothing crashes. AI flags without a valid rule ID are dropped |
| 4 | The granola label, **India + Blinkit**, with the rejection *"Listing rejected: label information incomplete"* | The results open with a **"Likely reason for rejection"** card that links to the flags behind it (missing FSSAI licence number, net quantity, MRP, best-before, manufacturer) and gives the fix |

`npm run acceptance` runs all of these against the live app, plus a 5-run consistency check and channel checks.

**Two deliberate interpretations:**
- Under US law, an ingredient name that identifies the allergen ("almonds", "peanut butter") already counts as declared. Those get a LOW "add a Contains: line" note, not HIGH.
- "Supports healthy blood sugar" names no disease, so the FDA pack doesn't call it a disease claim. Amazon (US) flags it, because Amazon's review is stricter.

---

## Current workflow → future workflow

| | Today (without ShelfReady) | With ShelfReady |
|---|---|---|
| 1 | Write label copy in a doc | Same |
| 2 | Google FDA / FSSAI / Legal Metrology rules and guess | Paste the copy (or a photo), pick the market and channels |
| 3 | Miss "whey" needing a "milk" declaration, or a missing MRP | Hidden allergens and missing declarations are found by fixed, published lists |
| 4 | Learn each marketplace's rules from rejections, weeks later | A channel matrix shows the same label passing on one channel and failing on another |
| 5 | Get a vague rejection and guess what it means | Paste it: the likely reason, the flags behind it, the fix and a resubmission note |
| 6 | Pay a consultant to review **everything** | Fix everything in one click, re-check, and pay an expert for **only the flagged items** |

---

## How it works: Input → AI → Logic → Action → Output

```
INPUT                 AI (judgement)                LOGIC (plain code)                  ACTION (you)          OUTPUT
Label text or photo   Is this a label?              Input checks (no AI cost)           Judge each flag       Likely reason for rejection
Market: US / India    Disease claims + rewrites     Allergen check (published lists)    Copy / edit rewrites  Readiness verdict
Channels (optional)   Rejection → likely cause      Missing declarations (MRP, net qty) Fix all, re-check     Channel matrix
Rejection (optional)  Photo → text                  Channel rules, shelf-life maths     Decide what goes      Allergen line
                                                    Drop AI flags with bad IDs/quotes   to an expert          Highlighted label, flag cards
```

**One Check button.** The plain-code checks run first (they're instant). The claim check and the rejection explainer then run at the same time, so adding a rejection doesn't double the wait. Only a rejection with no label gets the likely cause, plus a request for the label to confirm it.

### Markets and channels

A **market** pack has the rules that always apply. Each **channel** is a thin layer of its own rules on top, not a copy. Every rule has an ID, a plain-language name, a source link and a verified/unverified status, all shown in the results.

| Layer | Rules | Status |
|---|---|---|
| **United States (FDA)** | Disease claims (AI), undeclared major allergens, "Contains:" best practice | Verified: eCFR, US Code |
| Amazon (US) | Blood sugar / diabetes wording | **Unverified** (Seller Central forum + compliance guides) |
| **India (FSSAI + Legal Metrology)**, applies to every Indian channel | Disease claims (AI), allergens, FSSAI licence number, veg/non-veg mark, net quantity, MRP, best-before, manufacturer, "natural" | Verified: FSSAI regulations, Legal Metrology (Packaged Commodities) Rules 2011 |
| Any Indian online channel | 30% or 45 days of shelf life left at delivery | Verified: FSSAI advisory, Nov 2024 |
| Amazon India | Minimum 3 months of shelf life (5 for FBA); FSSAI licence valid 2+ months | Verified: Amazon.in Grocery & Gourmet Foods Listing Policy |
| Blinkit | 90+ days of shelf life at intake; FSSAI number printed, not stickered | **Unverified** (third-party guides) |
| Zepto | About 60% shelf life at intake; GS1 barcode | **Unverified** (third-party guides) |
| Swiggy Instamart | About 60% shelf life at intake | **Unverified** (Instamart doesn't publish requirements) |
| Amazon Now | Assumed to follow Amazon.in's shelf-life minimum | **Unverified** |
| Flipkart Minutes, BigBasket BB Now | No public channel-specific rules found, so only the India layer applies | Shown in the results |

**The channel matrix** has each issue as a row and each selected channel as a column. A cell is **fail** only for a verified, high-severity label problem. Unverified rules, lower risks and "confirm with the channel" items are only ever **warnings**, so a guess never reads as fact. Shelf life is read from the label ("Best before 2 months from manufacture"), so a 2-month product fails Amazon India's 3-month minimum but passes channels without one.

Rule files: `lib/rulepacks/us-fda-v0.1.json`, `lib/rulepacks/fssai-v0.1.json`, `lib/rulepacks/channels-v0.1.json`. Adding a channel means adding an entry to `channels-v0.1.json`.

---

## Where AI is used, and why

| AI job | Why not a simple rule? |
|---|---|
| **Read text from a photo** | Turning pixels into text needs vision |
| **Decide "is this a label?"** | A recipe and a label both have "Ingredients:"; keywords can't tell them apart |
| **Find disease claims and write rewrites** | The same claim can be worded endlessly, and a good rewrite needs language skill |
| **Explain a vague rejection** | Rejection messages are free text. Matching one to likely causes needs judgement. The rule IDs and quotes it returns are checked by code |

**Everything else is plain code**, because it must be exact and give the same answer every time: input checks, allergen detection, missing declarations, channel rules, shelf-life maths, rule IDs, severities and sources, checking the AI's answers, the matrix, Fix all and the "compliant" filter.

## What stays human

- Checking the text read from a photo before running the check
- Deciding whether each flag is right, and whether to use each rewrite
- Filling in the [placeholders] that Fix all adds (licence number, MRP…)
- Confirming the items marked **Confirm** and the rules marked **Unverified** with each channel
- **Having an expert confirm the rule citations**, then the final decision to print

## Why these tools

| Tool | Why |
|---|---|
| **Next.js** (App Router, TypeScript) | One project for the screen and the server routes; deploys to Vercel with no extra setup |
| **OpenRouter + Gemini 3.8 Flash** | The plan was the Claude API, but the available OpenRouter key only allows Google models. Fast (about 3 s), reads images, supports JSON-schema answers, well under a cent per check. All AI code is in `lib/ai.ts` |
| **Zod** | One definition of each AI answer shape, used to ask for it and to check the reply |
| **Tailwind CSS** | Styling with colour tokens that switch automatically for dark mode |
| **Vitest** | Free, fast unit tests for all plain-code logic |

## Failure cases, and what you see

| What goes wrong | What the app does |
|---|---|
| Empty, too-short or too-long text | A readable message before any AI call |
| A recipe, article or random words | "This doesn't look like product label text. Please paste your label text." No flags |
| Wrong file type, file over 5 MB, corrupt or blank image | "We couldn't read that. Please paste your label text." |
| Only a rejection, no label | The likely cause, plus "Paste your label text too, to confirm which parts caused the rejection" |
| The rejection box holds something that isn't a rejection | The label is still checked, with a note that the rejection was ignored |
| The AI invents a quote or a rule ID | Dropped by code; the screen says a suggestion was removed |
| The AI writes "compliant" | Replaced by code |
| The AI misses a claim | Can't be caught automatically; the report lists exactly which rules were checked |
| A channel rule has no public source | Shown with an **Unverified** chip, and never as a hard fail |
| AI answer slow (no reply in 6 s) | A backup request starts automatically; the first answer wins |
| AI service down | "The checker couldn't run. Please try again." with a Try again button. No partial report |
| Missing API key | "The checker isn't set up yet. Add your OpenRouter API key to .env.local…" |

**Known limitations:** the FDA pack doesn't check structure/function, nutrient content or "gluten-free" claims. The veg/non-veg mark is a symbol, so it can only be checked through the words on the label. The FSSAI allergen line uses the US "Contains:" format, because I couldn't verify FSSAI's official format. Quick-commerce rules are mostly unverified, because most of them sit behind seller logins.

---

## Run it locally

**You need:** [Node.js](https://nodejs.org) 22 or newer and an [OpenRouter API key](https://openrouter.ai/settings/keys) whose workspace allows `google/gemini-3.8-flash`.

```bash
git clone https://github.com/adityasinghal-source/label-check.git
cd label-check
npm install
```

Copy `.env.example` to `.env.local` and replace `paste-your-key-here` with your OpenRouter key. `.env.local` is git-ignored.

```bash
npm run dev
```

Open http://localhost:3000 and click one of the examples in the results panel, then **Check**. For a demo, `npm run demo` runs the faster production build.

### Tests

```bash
npm test
```

Unit tests: free, no AI calls.

```bash
npm run acceptance
```

The acceptance tests against the running app. It uses the real AI and costs a fraction of a cent.

## Project layout

| Path | What it is |
|---|---|
| `app/page.tsx` | The one screen: header, input panel, results |
| `app/api/check/route.ts` | One check: input checks → code rules → AI (claims + rejection, in parallel) → report |
| `app/api/read-image/route.ts` | Photo → label text |
| `lib/ai.ts` | The only file that talks to the AI |
| `lib/rulepacks/` | Market packs and channel layers (JSON), and how they combine |
| `lib/allergens.ts`, `lib/codeRules.ts`, `lib/shelfLife.ts`, `lib/validateFlags.ts` | Plain-code checks |
| `lib/buildReport.ts`, `lib/summary.ts`, `lib/matrix.ts`, `lib/highlight.ts`, `lib/fixAll.ts` | Report, verdict, channel matrix, highlights, Fix all |
| `components/` | Report, rejection card, channel matrix, Fix all, highlighted label |
| `tests/`, `scripts/acceptance.mjs` | Unit tests and acceptance tests |

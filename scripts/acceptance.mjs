// Runs the acceptance tests against the running app (npm run dev first).
// Uses the real AI, so it needs your API key in .env.local and costs a fraction of a cent.
import { crc32, deflateSync } from "node:zlib";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL =
  "High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds";
const INPUT_B =
  "Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt";
const PASTA_RECIPE =
  "Ingredients: 400g spaghetti, 2 cloves garlic, olive oil, parmesan. Boil the pasta for 10 minutes, fry the garlic in oil, toss together and serve.";

let failures = 0;
function expect(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function postCheck({ text = "", market = "us", channels = [], rejection = "", packType = "single", dimensions = null }) {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, market, channels, rejection, packType, dimensions }),
  });
  return { http: res.status, body: await res.json(), seconds: (Date.now() - started) / 1000 };
}

async function postImage(bytes, type) {
  const form = new FormData();
  form.append("files", new Blob([bytes], { type }), "label.png");
  form.append("panels", "front");
  const res = await fetch(`${BASE}/api/read-image`, { method: "POST", body: form });
  return { http: res.status, body: await res.json() };
}

// A plain white PNG: a valid image with no text on it.
function blankPng(width = 300, height = 200) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 255)]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array(height).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const asksForLabel = (r) =>
  r.http === 200 && r.body.status === "needs_text" && /paste your label text/i.test(r.body.message) && !r.body.report;
const quotesFor = (report, ruleId) => report?.flags.filter((f) => f.ruleId === ruleId).map((f) => f.quotedText) ?? [];

console.log(`Testing ${BASE}\n\nTest 1: disease claim flagged within 10 seconds (5 runs)`);
const runs = [];
for (let i = 0; i < 5; i++) runs.push(await postCheck({ text: LABEL }));
for (const [i, run] of runs.entries()) {
  const flag = run.body.report?.flags.find((f) => f.ruleId === "US-FDA-DC-001");
  expect(
    `run ${i + 1}: US-FDA-DC-001, high, quotes "helps manage diabetes", has rewrite`,
    flag?.severity === "high" && /helps manage diabetes/i.test(flag.quotedText) && flag.suggestedRewrite.length > 0,
    run.body.status === "ok" ? `rewrite: ${flag?.suggestedRewrite ?? "none"}` : run.body.message,
  );
  expect(`run ${i + 1}: under 10 seconds`, run.seconds < 10, `${run.seconds.toFixed(1)} s`);
}

console.log("\nTest 2: allergens, version, no-issues wording");
const report = runs[0].body.report;
expect("whey protein concentrate flagged as undeclared milk (HIGH)", quotesFor(report, "US-FDA-ALG-001").includes("whey protein concentrate"));
// US law accepts "almonds" in the ingredient list as the declaration, so it only gets the LOW "add a Contains: line" advice.
expect("almonds flagged as missing a Contains line (LOW advice)", quotesFor(report, "US-FDA-ALG-002").includes("almonds"));
expect("report shows rule pack v0.3", report?.packVersion === "0.3");
expect("report has a no-issues entry", report?.ruleStatuses.some((r) => r.status === "no_issues"));
expect('never says "compliant"', !JSON.stringify(runs.map((r) => r.body)).toLowerCase().includes("compliant"));
expect("allergen line generated in FDA style", report?.allergenStatement === "Contains: Milk, Tree Nuts (Almonds).", report?.allergenStatement);
expect("every flag has a source link", report?.flags.every((f) => /^https:\/\//.test(f.source.url)));

console.log("\nConsistency: the granola label gets the same verdict every time (5 runs, US)");
const verdicts = [];
for (let i = 1; i <= 5; i++) {
  const run = await postCheck({ text: INPUT_B });
  const flags = run.body.report?.flags ?? [];
  const summary = flags.map((f) => `${f.ruleId}${f.quotedText ? ` "${f.quotedText}"` : ""}`).join(", ") || run.body.message;
  verdicts.push(summary);
  expect(
    `run ${i}: no disease claim, peanut butter only as LOW advice, milk declared`,
    run.body.status === "ok" &&
      !flags.some((f) => f.ruleId === "US-FDA-DC-001" || f.ruleId === "US-FDA-ALG-001") &&
      flags.some((f) => f.ruleId === "US-FDA-ALG-002" && f.quotedText === "peanut butter"),
    summary,
  );
  expect(`run ${i}: under 10 seconds`, run.seconds < 10, `${run.seconds.toFixed(1)} s`);
}
expect("all 5 runs flag exactly the same issues", new Set(verdicts).size === 1);

console.log("\nMinimum completeness");
const abc = await postCheck({ text: "abc" });
expect('"abc" asks for label text (too short to be a label)', asksForLabel(abc), abc.body.message);
for (const [market, expected] of [
  ["us", ["US-FDA-NET-001", "US-FDA-ING-001", "US-FDA-NUT-001", "US-FDA-MFR-001"]],
  ["india", ["IN-FSSAI-ING", "IN-FSSAI-NUT", "IN-FSSAI-LIC", "IN-LM-NET", "IN-LM-MRP", "IN-LM-CARE", "IN-LM-MFD"]],
]) {
  const r = await postCheck({ text: "Granola bar", market });
  const got = r.body.report?.flags.map((f) => f.ruleId) ?? [];
  expect(`one-line label (${market}): every missing mandatory element flagged`, expected.every((id) => got.includes(id)), got.join(", ") || r.body.message);
}

console.log("\nTest 3: bad input asks for label text, no flags, no crash");
for (const [name, text] of [
  ["empty text", ""],
  ["pasta recipe", PASTA_RECIPE],
  ["pasta instructions", "Boil 200g pasta for 10 minutes, drain, and toss with olive oil and garlic."],
  ["random words", "banana keyboard purple sunset violin"],
]) {
  const r = await postCheck({ text });
  expect(name, asksForLabel(r), r.body.message);
}
for (const [name, bytes] of [
  ["blank image", blankPng()],
  ["corrupt image file", Buffer.from("this is not really a png")],
]) {
  const r = await postImage(bytes, "image/png");
  expect(name, asksForLabel(r), r.body.message);
}

console.log("\nTest 4: granola label + Blinkit rejection “Listing rejected: label information incomplete”");
const t4 = await postCheck({
  text: INPUT_B,
  market: "india",
  channels: ["blinkit"],
  rejection: "Listing rejected: label information incomplete",
});
const ex = t4.body.explanation;
const t4flags = t4.body.report?.flags ?? [];
const declarations = ["IN-FSSAI-LIC", "IN-LM-NET", "IN-LM-MRP", "IN-LM-DATE", "IN-LM-MFR"];
expect("gives a likely reason for rejection", t4.body.status === "ok" && ex?.likelyCause.length > 0, ex?.likelyCause ?? t4.body.message);
expect(
  "links the rejection to missing label declarations",
  ex?.ruleIds.some((id) => declarations.includes(id)),
  `rule IDs: ${ex?.ruleIds.join(", ")}`,
);
expect(
  "those flags are on the report",
  ex?.ruleIds.filter((id) => declarations.includes(id)).every((id) => t4flags.some((f) => f.ruleId === id)),
);
expect("Blinkit column in the channel matrix", t4.body.report?.channels.some((c) => c.id === "blinkit"));
expect("fix steps and a resubmission note", ex?.fixSteps.length > 0 && ex?.appealNote.length > 0);
expect("under 10 seconds", t4.seconds < 10, `${t4.seconds.toFixed(1)} s`);

console.log("\nRejection only, no label");
const onlyRejection = await postCheck({ market: "india", channels: ["blinkit"], rejection: "Listing rejected: label information incomplete" });
expect(
  "explains the likely cause and asks for the label",
  onlyRejection.body.status === "ok" && onlyRejection.body.explanation && !onlyRejection.body.report && /label text/i.test(onlyRejection.body.notice ?? ""),
  onlyRejection.body.notice ?? onlyRejection.body.message,
);

console.log("\nChannels: the same label can pass on one channel and fail on another");
const amazonUs = await postCheck({ text: INPUT_B, channels: ["amazon-us"] });
expect(
  'Amazon US flags "Supports healthy blood sugar" (AMZ-US-001), marked unverified',
  amazonUs.body.report?.flags.some((f) => f.ruleId === "AMZ-US-001" && f.quotedText === "Supports healthy blood sugar" && !f.verified),
);
const makhana =
  "Masala makhana. Veg. Net quantity: 80 g. MRP ₹99 (incl. of all taxes). Mfd. on: 10/2026. Best before 2 months from manufacture. Batch No.: MK2610.\nIngredients: fox nuts, rice bran oil, spices, salt.\nNutritional information per 100 g / per serve (20 g): Energy 480 kcal / 96 kcal, Protein 9 g / 1.8 g, Total fat 22 g / 4.4 g, Sodium 610 mg / 122 mg.\nManufactured by: Good Snacks Pvt Ltd, Pune. Country of origin: India. Customer care: 1800 123 4567 | care@goodsnacks.in\nFSSAI Lic. No. 11523999000123 · EAN 8901234567890";
const india = await postCheck({ text: makhana, market: "india", channels: ["amazon-in", "flipkart-minutes"] });
const shelf = india.body.report?.flags.find((f) => f.ruleId === "AMZ-IN-001");
expect("2-month shelf life flagged for Amazon India only", shelf && shelf.channels.join() === "amazon-in", shelf?.quotedText);
// Flipkart Minutes has no public rules of its own; it only gets the market rules and the FSSAI online-sales item to confirm.
const flipkart = india.body.report?.flags.filter((f) => f.channels.length === 0 || f.channels.includes("flipkart-minutes")) ?? [];
expect(
  "Flipkart Minutes: nothing fails, only items to confirm",
  flipkart.every((f) => f.confirmOnly),
  flipkart.map((f) => `${f.ruleId}${f.confirmOnly ? " (confirm)" : ""}`).join(", "),
);

console.log("\nv0.3: calculators, validators, multi-pack and listing copy");
const sized = await postCheck({ text: makhana, market: "india", dimensions: { shape: "rect", unit: "cm", width: 12, height: 18 } });
const sizes = sized.body.report?.printSizes;
expect("12 × 18 cm pouch → 216 cm², 2 mm numerals", sizes?.area === 216 && sizes.specs[0].minimum.startsWith("2 mm"), sizes?.specs[0].minimum);
const usSized = await postCheck({ text: LABEL, dimensions: { shape: "rect", unit: "in", width: 4, height: 6 } });
expect("4 × 6 in box → 24 in², 1/8 in type", usSized.body.report?.printSizes?.specs[0].minimum.startsWith("1/8 in"));
expect("EAN 8901234567890 passes the check digit (GS1 India)", sized.body.report?.barcodes[0]?.valid && sized.body.report.barcodes[0].prefix === "GS1 India");
const badNumbers = await postCheck({ text: makhana.replace("11523999000123", "15523999000123").replace("8901234567890", "8901234567891"), market: "india" });
const badIds = badNumbers.body.report?.flags.map((f) => f.ruleId) ?? [];
expect("Bad state code and bad barcode check digit are flagged", badIds.includes("IN-FSSAI-LIC-FMT") && badIds.includes("GS1-CHK-001"), badIds.join(", "));
const additive = await postCheck({ text: makhana.replace("spices, salt", "spices, salt, citric acid"), market: "india" });
const addFlag = additive.body.report?.flags.find((f) => f.ruleId === "IN-FSSAI-ADD-001");
expect("Bare citric acid → Acidity regulator (INS 330)", addFlag?.suggestedRewrite === "Acidity regulator (INS 330)");
const multi = await postCheck({ text: makhana, market: "india", packType: "multi" });
expect("Multi-pack mode asks for the N × quantity declaration", multi.body.report?.flags.some((f) => f.ruleId === "IN-LM-MULTI-001"));
const listing = await fetch(`${BASE}/api/listing`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ labelText: LABEL, market: "us", productName: "protein bar", flaggedClaims: ["helps manage diabetes"], avoidWords: [] }),
}).then((r) => r.json());
expect(
  "Listing copy never repeats the diabetes claim",
  listing.status === "ok" && ![listing.title, ...listing.highlights].some((l) => /diabet/i.test(l)),
  listing.status === "ok" ? listing.title : listing.message,
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

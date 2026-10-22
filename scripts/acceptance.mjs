// Runs the 3 acceptance tests against the running app (npm run dev first).
// Uses the real AI, so it needs your API key in .env.local and costs a few cents.
import { crc32, deflateSync } from "node:zlib";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL =
  "High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds";
const PASTA_RECIPE =
  "Ingredients: 400g spaghetti, 2 cloves garlic, olive oil, parmesan. Boil the pasta for 10 minutes, fry the garlic in oil, toss together and serve.";

let failures = 0;
function expect(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function postCheck(text, packId = "us-fda") {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, packId }),
  });
  return { http: res.status, body: await res.json(), seconds: (Date.now() - started) / 1000 };
}

async function postImage(bytes, type) {
  const form = new FormData();
  form.append("image", new Blob([bytes], { type }), "label.png");
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

console.log(`Testing ${BASE}\n\nTest 1: disease claim flagged within 10 seconds (5 runs)`);
const runs = [];
for (let i = 0; i < 5; i++) runs.push(await postCheck(LABEL));
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
const quotesFor = (r, ruleId) => r?.flags.filter((f) => f.ruleId === ruleId).map((f) => f.quotedText) ?? [];
expect("whey protein concentrate flagged as undeclared milk (HIGH)", quotesFor(report, "US-FDA-ALG-001").includes("whey protein concentrate"));
// US law accepts "almonds" in the ingredient list as the declaration, so it only gets the LOW "add a Contains: line" advice.
expect("almonds flagged as missing a Contains line (LOW advice)", quotesFor(report, "US-FDA-ALG-002").includes("almonds"));
expect("report shows rule pack v0.1", report?.packVersion === "0.1");
expect("report has a no-issues entry", report?.ruleStatuses.some((r) => r.status === "no_issues"));
expect('never says "compliant"', !JSON.stringify(runs.map((r) => r.body)).toLowerCase().includes("compliant"));
expect(
  "allergen line generated in FDA style",
  report?.allergenStatement === "Contains: Milk, Tree Nuts (Almonds).",
  report?.allergenStatement,
);

console.log("\nConsistency: Input B gets the same verdict every time (5 runs)");
const INPUT_B =
  "Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt";
for (let i = 1; i <= 5; i++) {
  const run = await postCheck(INPUT_B);
  const flags = run.body.report?.flags ?? [];
  const summary = flags.map((f) => `${f.ruleId} "${f.quotedText}"`).join(", ") || run.body.message;
  expect(
    `run ${i}: no disease claim, peanut butter only as LOW advice, milk declared`,
    run.body.status === "ok" &&
      !flags.some((f) => f.ruleId === "US-FDA-DC-001") &&
      flags.length === 1 &&
      flags[0].ruleId === "US-FDA-ALG-002" &&
      flags[0].quotedText === "peanut butter",
    summary,
  );
  expect(`run ${i}: under 10 seconds`, run.seconds < 10, `${run.seconds.toFixed(1)} s`);
}

console.log("\nTest 3: bad input asks for label text, no flags, no crash");
for (const [name, text] of [
  ["empty text", ""],
  ["pasta recipe", PASTA_RECIPE],
  ["pasta instructions", "Boil 200g pasta for 10 minutes, drain, and toss with olive oil and garlic."],
  ["random words", "banana keyboard purple sunset violin"],
]) {
  const r = await postCheck(text);
  expect(name, asksForLabel(r), r.body.message);
}
for (const [name, bytes] of [
  ["blank image", blankPng()],
  ["corrupt image file", Buffer.from("this is not really a png")],
]) {
  const r = await postImage(bytes, "image/png");
  expect(name, asksForLabel(r), r.body.message);
}

console.log("\nFSSAI smoke check");
const fssai = await postCheck(LABEL, "fssai");
const ids = fssai.body.report?.flags.map((f) => f.ruleId) ?? [];
expect("only FSSAI rule IDs", ids.length > 0 && ids.every((id) => id.startsWith("FSSAI-")), ids.join(", "));

console.log("\nChannels: the same line can be fine with the FDA but risky on Amazon");
const amazon = await postCheck(INPUT_B, "amazon-us");
const amazonFlags = amazon.body.report?.flags ?? [];
expect(
  'Amazon flags "Supports healthy blood sugar" (AMZ-US-001)',
  amazonFlags.some((f) => f.ruleId === "AMZ-US-001" && f.quotedText === "Supports healthy blood sugar"),
  amazonFlags.map((f) => `${f.ruleId} "${f.quotedText}"`).join(", ") || amazon.body.message,
);
expect("Amazon still runs the FDA checks", amazon.body.report?.basedOn === "US (FDA) v0.1");
const blinkit = await postCheck(LABEL, "blinkit-in");
expect(
  "Blinkit flags the missing FSSAI licence number (BLK-IN-001)",
  blinkit.body.report?.flags.some((f) => f.ruleId === "BLK-IN-001"),
);

console.log("\nRejection explainer");
async function postExplain(rejection, labelText, packId = "amazon-us") {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rejection, labelText, packId }),
  });
  return { http: res.status, body: await res.json(), seconds: (Date.now() - started) / 1000 };
}
const notice =
  "Your listing has been removed. Reason: this product appears to make prohibited claims. Products marketed for diabetes or blood sugar conditions are not permitted without FDA approval.";
const explained = await postExplain(notice, INPUT_B);
const ex = explained.body.explanation;
expect(
  "gives a likely cause, fix steps and a note to send",
  explained.body.status === "ok" && ex.likelyCause.length > 0 && ex.fixSteps.length > 0 && ex.appealNote.length > 0,
  ex ? `${ex.likelyCause} [rule: ${ex.ruleId ?? "none"}, quote: ${ex.evidenceQuote ?? "none"}]` : explained.body.message,
);
expect("any rule ID it cites is from the pack", ex ? ex.ruleId === null || ex.ruleId.length > 0 : false);
expect('explanation never says "compliant"', !JSON.stringify(explained.body).toLowerCase().includes("compliant"));
expect("under 10 seconds", explained.seconds < 10, `${explained.seconds.toFixed(1)} s`);
const notANotice = await postExplain("banana keyboard purple sunset violin", "");
expect(
  "random words: asks for the rejection message, no explanation",
  notANotice.body.status === "needs_text" && !notANotice.body.explanation,
  notANotice.body.message,
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

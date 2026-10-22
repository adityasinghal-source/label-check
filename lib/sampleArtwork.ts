// A mock makhana pack (front and back panel side by side) drawn on a canvas, so the artwork inspector
// can be tried without uploading a file. It has deliberate problems: a disease claim, a bare additive
// and a barcode with the wrong check digit.

const W = 1400;
const H = 900;

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, opts: { bold?: boolean; color?: string; center?: boolean } = {}) {
  ctx.font = `${opts.bold ? "700" : "400"} ${size}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = opts.color ?? "#1d1d1b";
  ctx.textAlign = opts.center ? "center" : "left";
  ctx.fillText(s, x, y);
}

function front(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#f6d78b";
  ctx.fillRect(0, 0, W / 2, H);
  ctx.fillStyle = "#b5371f";
  ctx.fillRect(0, 0, W / 2, 120);
  text(ctx, "GOOD SNACKS", W / 4, 80, 52, { bold: true, color: "#ffffff", center: true });

  // Veg mark: green square outline with a filled green circle.
  ctx.strokeStyle = "#1a8f3c";
  ctx.lineWidth = 5;
  ctx.strokeRect(560, 160, 70, 70);
  ctx.fillStyle = "#1a8f3c";
  ctx.beginPath();
  ctx.arc(595, 195, 20, 0, Math.PI * 2);
  ctx.fill();

  text(ctx, "Masala Makhana", W / 4, 300, 72, { bold: true, center: true });
  text(ctx, "Roasted fox nuts with Indian spices", W / 4, 360, 32, { center: true });

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(W / 4, 540, 120, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    ctx.fillStyle = "#efe6d2";
    ctx.beginPath();
    ctx.arc(W / 4 + Math.cos(a) * 70, 540 + Math.sin(a) * 70, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#b5371f";
  ctx.fillRect(60, 690, W / 2 - 120, 70);
  text(ctx, "Helps control diabetes naturally", W / 4, 737, 34, { bold: true, color: "#ffffff", center: true });
  text(ctx, "Net quantity: 80 g", W / 4, 850, 40, { bold: true, center: true });
}

function back(ctx: CanvasRenderingContext2D) {
  const x0 = W / 2;
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(x0, 0, W / 2, H);
  ctx.fillStyle = "#cccccc";
  ctx.fillRect(x0, 0, 3, H);

  const left = x0 + 40;
  text(ctx, "Ingredients: fox nuts (85%), rice bran oil, spices,", left, 60, 24, { bold: true });
  text(ctx, "salt, citric acid.", left, 92, 24, { bold: true });

  // Nutrition table.
  ctx.strokeStyle = "#1d1d1b";
  ctx.lineWidth = 2;
  ctx.strokeRect(left, 120, 600, 220);
  text(ctx, "Nutritional information", left + 15, 155, 24, { bold: true });
  text(ctx, "per 100 g / per serve (20 g)", left + 330, 155, 20);
  const rows = [
    ["Energy", "480 kcal / 96 kcal"],
    ["Protein", "9 g / 1.8 g"],
    ["Total fat", "22 g / 4.4 g"],
    ["Sodium", "610 mg / 122 mg"],
  ];
  rows.forEach(([k, v], i) => {
    const y = 200 + i * 38;
    ctx.beginPath();
    ctx.moveTo(left, y - 26);
    ctx.lineTo(left + 600, y - 26);
    ctx.stroke();
    text(ctx, k, left + 15, y, 22);
    text(ctx, v, left + 330, y, 22);
  });

  const lines = [
    "MRP ₹99 (incl. of all taxes)",
    "Mfd. on: 10/2026   Best before 4 months from manufacture",
    "Batch No.: MK2610",
    "Manufactured by: Good Snacks Pvt Ltd, Pune 411001",
    "Customer care: 1800 123 4567 | care@goodsnacks.in",
    "Country of origin: India",
  ];
  lines.forEach((l, i) => text(ctx, l, left, 390 + i * 36, 22));

  // FSSAI logo block and licence number.
  ctx.fillStyle = "#2b5aa8";
  ctx.font = "italic 700 46px Georgia, serif";
  ctx.textAlign = "left";
  ctx.fillText("fssai", left, 660);
  text(ctx, "Lic. No. 11523999000123", left + 130, 655, 24, { bold: true });

  // Barcode: bars from a fixed pattern (a mock, not a scannable symbol) with its number underneath.
  const bx = left + 330;
  const by = 700;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx - 10, by - 10, 260, 150);
  ctx.fillStyle = "#000000";
  const pattern = "1010110011010111011001011011101001010110011011011001010101110100110110010110111001010101";
  for (let i = 0; i < pattern.length; i++) if (pattern[i] === "1") ctx.fillRect(bx + i * 2.6, by, 2.6, 100);
  text(ctx, "8 901234 567891", bx + 115, by + 128, 22, { center: true });
  text(ctx, "EAN 8901234567891", left, 760, 20);
}

export async function sampleArtworkFile(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  front(ctx);
  back(ctx);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
  return new File([blob], "sample-makhana-pack.png", { type: "image/png" });
}

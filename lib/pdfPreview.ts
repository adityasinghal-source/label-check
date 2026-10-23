// Turns page 1 of an uploaded PDF into an image, in the browser, so a PDF label gets a thumbnail and
// the annotated artwork preview like a photo does. The vision model reads the same page, so its boxes line up.

const TARGET_WIDTH = 1400;

export async function pdfFirstPageImage(file: File): Promise<string | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    // Small labels (a 35 mm stick pack) are scaled up; big dielines are capped so the image stays light.
    const viewport = page.getViewport({ scale: Math.min(8, TARGET_WIDTH / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // PDFs often have a transparent background; paint white so dark mode doesn't show through.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    await doc.destroy();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? URL.createObjectURL(blob) : null;
  } catch (error) {
    console.warn("Couldn't draw a preview of the PDF:", error);
    return null;
  }
}

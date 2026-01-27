import { createRequire } from "module";

const require = createRequire(import.meta.url);

function getPdfParseFn(): (buffer: Buffer) => Promise<{ text?: string }> {
  // pdf-parse is CJS-first; Turbopack/ESM may not expose a default export.
  const mod = require("pdf-parse") as unknown;
  if (typeof mod === "function") return mod as (buffer: Buffer) => Promise<{ text?: string }>;
  if (mod && typeof (mod as { default?: unknown }).default === "function") {
    return (mod as { default: (buffer: Buffer) => Promise<{ text?: string }> }).default;
  }
  throw new Error("pdf-parse: unsupported module shape");
}

export async function extractTextFromPdf(buffer: Buffer) {
  const pdfParse = getPdfParseFn();
  const data = await pdfParse(buffer);
  return data.text ?? "";
}



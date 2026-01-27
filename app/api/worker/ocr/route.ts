import { NextResponse } from "next/server";
import { runOneOcrJob } from "@/app/lib/ocr/worker";

export const runtime = "nodejs";

// Kicks the OCR queue. Safe to call frequently.
export async function POST() {
  const res = await runOneOcrJob();
  return NextResponse.json(res);
}


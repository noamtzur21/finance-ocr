import { NextResponse } from "next/server";
import { runOneOcrJob } from "@/app/lib/ocr/worker";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return unauthorized();

  const started = Date.now();
  let processed = 0;

  // Process multiple jobs per tick (bounded by time + count) to catch up quickly.
  while (processed < 20 && Date.now() - started < 25_000) {
    const res = await runOneOcrJob();
    if (!res.processed) break;
    if (!res.ok) {
      return NextResponse.json({ ok: false, processed, error: res.error }, { status: 500 });
    }
    processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}


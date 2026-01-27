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
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret") ?? "";
  // Support both Vercel Cron auth header and simple external cron query param.
  if (auth !== `Bearer ${secret}` && querySecret !== secret) return unauthorized();

  const started = Date.now();
  let processed = 0;

  // Process multiple jobs per tick (bounded by time + count) to catch up quickly.
  while (processed < 20 && Date.now() - started < 25_000) {
    const res = await runOneOcrJob();
    if (!res.processed) break;
    if (!res.ok) {
      // Return 200 so external cron services don't disable the job.
      // We'll still include error details in the JSON body.
      return NextResponse.json({ ok: false, processed, error: res.error });
    }
    processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}


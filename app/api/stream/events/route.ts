import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export const runtime = "nodejs";

function sse(data: unknown, event = "changed") {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

type Entity = "document" | "category" | "budget" | "credential" | "transaction" | "investment";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const write = async (chunk: string) => writer.write(encoder.encode(chunk));

  let last = new Date();
  await write(sse({ ok: true }, "hello"));

  const signal = req.signal;
  try {
    while (!signal.aborted) {
      await write(`: ping\n\n`);

      const candidates: Array<{ entity: Entity; id: string; at: Date; extra?: unknown }> = [];

      const doc = await prisma.document.findFirst({
        where: { userId: user.id, updatedAt: { gt: last } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true, ocrStatus: true },
      });
      if (doc) candidates.push({ entity: "document", id: doc.id, at: doc.updatedAt, extra: { ocrStatus: doc.ocrStatus } });

      const cat = await prisma.category.findFirst({
        where: { userId: user.id, updatedAt: { gt: last } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true },
      });
      if (cat) candidates.push({ entity: "category", id: cat.id, at: cat.updatedAt });

      const bud = await prisma.budget.findFirst({
        where: { userId: user.id, updatedAt: { gt: last } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true },
      });
      if (bud) candidates.push({ entity: "budget", id: bud.id, at: bud.updatedAt });

      const cred = await prisma.credential.findFirst({
        where: { userId: user.id, updatedAt: { gt: last } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true },
      });
      if (cred) candidates.push({ entity: "credential", id: cred.id, at: cred.updatedAt });

      const tx = await prisma.transaction.findFirst({
        where: { userId: user.id, updatedAt: { gt: last } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true },
      });
      if (tx) candidates.push({ entity: "transaction", id: tx.id, at: tx.updatedAt });

      const invAcc = await prisma.investmentAccount.findFirst({
        where: { userId: user.id, updatedAt: { gt: last } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true },
      });
      if (invAcc) candidates.push({ entity: "investment", id: invAcc.id, at: invAcc.updatedAt });

      const invYear = await prisma.investmentYear.findFirst({
        where: { userId: user.id, updatedAt: { gt: last } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true },
      });
      if (invYear) candidates.push({ entity: "investment", id: invYear.id, at: invYear.updatedAt });

      const invEntry = await prisma.investmentEntry.findFirst({
        where: { userId: user.id, updatedAt: { gt: last } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, updatedAt: true },
      });
      if (invEntry) candidates.push({ entity: "investment", id: invEntry.id, at: invEntry.updatedAt });

      if (candidates.length) {
        candidates.sort((a, b) => a.at.getTime() - b.at.getTime());
        const c = candidates[0]!;
        last = new Date(c.at.getTime() + 1);
        await write(sse({ entity: c.entity, id: c.id, updatedAt: c.at.toISOString(), ...((c.extra as object) ?? {}) }, "changed"));
      }

      await sleep(1500);
    }
  } catch {
    // ignore
  } finally {
    try {
      await writer.close();
    } catch {
      // ignore
    }
  }

  return new Response(stream.readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}


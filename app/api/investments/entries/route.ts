import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

const getSchema = z.object({
  accountId: z.string().min(1),
  year: z.coerce.number().int().min(2024).max(2100).optional(),
});

const createSchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(["deposit", "withdrawal", "fee", "tax"]),
  date: z.string().min(10), // YYYY-MM-DD
  amount: z.string().min(1),
  note: z.string().max(200).optional().nullable(),
});

function toMoney(s: string): string | null {
  const n = Number(String(s).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000_000) return null;
  return n.toFixed(2);
}

function parseDateOnly(iso: string): Date | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = getSchema.safeParse({
    accountId: url.searchParams.get("accountId"),
    year: url.searchParams.get("year") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const account = await prisma.investmentAccount.findFirst({
    where: { id: parsed.data.accountId, userId: user.id },
    select: { id: true },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const where: Record<string, unknown> = { userId: user.id, accountId: parsed.data.accountId };
  if (parsed.data.year != null) {
    where.date = { gte: new Date(parsed.data.year, 0, 1), lt: new Date(parsed.data.year + 1, 0, 1) };
  }

  const entries = await prisma.investmentEntry.findMany({
    where,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: { id: true, type: true, date: true, amount: true, note: true, updatedAt: true },
  });

  return NextResponse.json(
    entries.map((e) => ({
      id: e.id,
      type: e.type,
      date: e.date.toISOString().slice(0, 10),
      amount: e.amount.toString(),
      note: e.note,
      updatedAt: e.updatedAt.toISOString(),
    })),
  );
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const account = await prisma.investmentAccount.findFirst({
    where: { id: parsed.data.accountId, userId: user.id },
    select: { id: true },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const date = parseDateOnly(parsed.data.date);
  if (!date) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const amount = toMoney(parsed.data.amount);
  if (!amount) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const row = await prisma.investmentEntry.create({
    data: {
      userId: user.id,
      accountId: parsed.data.accountId,
      type: parsed.data.type,
      date,
      amount,
      note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: row.id });
}


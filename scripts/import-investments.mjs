import { PrismaClient } from "@prisma/client";

function money(n) {
  const x = Number(String(n).replace(/,/g, ""));
  if (!Number.isFinite(x)) throw new Error(`Invalid money: ${n}`);
  return x.toFixed(2);
}

function dateOnly(iso) {
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Invalid date: ${iso}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) throw new Error(`Invalid date: ${iso}`);
  return dt;
}

const prisma = new PrismaClient();

async function upsertAccount(userId, slug, patch) {
  return await prisma.investmentAccount.upsert({
    where: { userId_slug: { userId, slug } },
    update: patch,
    create: { userId, slug, currency: "ILS", ...patch },
    select: { id: true, slug: true, name: true },
  });
}

async function ensureEntry(userId, accountId, entry) {
  const existing = await prisma.investmentEntry.findFirst({
    where: {
      userId,
      accountId,
      type: entry.type,
      date: entry.date,
      amount: entry.amount,
      note: entry.note ?? null,
    },
    select: { id: true },
  });
  if (existing) return { created: false, id: existing.id };

  const row = await prisma.investmentEntry.create({
    data: {
      userId,
      accountId,
      type: entry.type,
      date: entry.date,
      amount: entry.amount,
      note: entry.note ?? null,
    },
    select: { id: true },
  });
  return { created: true, id: row.id };
}

async function upsertYearTotals(userId, accountId, year, totals) {
  await prisma.investmentYear.upsert({
    where: { accountId_year: { accountId, year } },
    update: totals,
    create: { userId, accountId, year, ...totals },
    select: { id: true },
  });
}

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, email: true } });
  if (!user) throw new Error("No users found in DB. Please register/login once, then re-run.");

  const now = new Date();

  // BTB
  const btb = await upsertAccount(user.id, "btb", {
    name: "BTB",
    type: "btb",
    provider: "BTB",
    strategy: "B-match",
    notes: null,
    currentBalance: money(20667),
    currentBalanceUpdatedAt: now,
  });

  const btbDeposits = [
    { date: "2024-12-11", amount: 15000 },
    { date: "2025-06-15", amount: 2500 },
    { date: "2025-09-09", amount: 2000 },
  ];

  // Migdal
  const migdal = await upsertAccount(user.id, "migdal-gemel-sp500", {
    name: "קופת גמל (S&P 500)",
    type: "gemel",
    provider: "מגדל",
    strategy: "עוקב מדד S&P 500",
    notes: "דמי ניהול מהפקדה: 0% | דמי ניהול מחיסכון: 0.7%",
    currentBalance: money(37696),
    currentBalanceUpdatedAt: now,
  });

  const migdalDeposits = [
    { date: "2024-12-12", amount: 15000 },
    { date: "2025-06-15", amount: 5500 },
    { date: "2025-07-15", amount: 5500 },
    { date: "2025-09-09", amount: 8000 },
    { date: "2025-09-14", amount: 3000 },
  ];

  let created = 0;
  let skipped = 0;

  for (const d of btbDeposits) {
    const res = await ensureEntry(user.id, btb.id, {
      type: "deposit",
      date: dateOnly(d.date),
      amount: money(d.amount),
      note: null,
    });
    if (res.created) created++;
    else skipped++;
  }

  for (const d of migdalDeposits) {
    const res = await ensureEntry(user.id, migdal.id, {
      type: "deposit",
      date: dateOnly(d.date),
      amount: money(d.amount),
      note: null,
    });
    if (res.created) created++;
    else skipped++;
  }

  // Fill year totals for backwards compatibility / quick view.
  const sumByYear = (list) =>
    list.reduce((m, x) => {
      const y = Number(String(x.date).slice(0, 4));
      m.set(y, (m.get(y) ?? 0) + Number(money(x.amount)));
      return m;
    }, new Map());

  const btbYear = sumByYear(btbDeposits.map((x) => ({ ...x, date: x.date, amount: x.amount })));
  for (const [year, sum] of btbYear.entries()) {
    await upsertYearTotals(user.id, btb.id, year, { deposits: sum.toFixed(2), withdrawals: "0.00" });
  }

  const migdalYear = sumByYear(migdalDeposits.map((x) => ({ ...x, date: x.date, amount: x.amount })));
  for (const [year, sum] of migdalYear.entries()) {
    await upsertYearTotals(user.id, migdal.id, year, { deposits: sum.toFixed(2), withdrawals: "0.00" });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        user: { email: user.email },
        accounts: [btb, migdal],
        entries: { created, skipped },
      },
      null,
      2,
    ),
  );
}

await main().finally(async () => {
  await prisma.$disconnect().catch(() => {});
});


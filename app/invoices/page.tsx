import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import LiveRefresh from "@/app/ui/LiveRefresh";
import OcrStatusCell from "@/app/ui/OcrStatusCell";

export default async function InvoicesPage(props: { searchParams?: Promise<{ all?: string }> }) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const sp = (await props.searchParams) ?? {};
  const showAll = sp.all === "1";

  const where = showAll ? { userId: user.id, type: "income" as const } : { userId: user.id, type: "income" as const };

  const [docs, agg] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        date: true,
        vendor: true,
        amount: true,
        currency: true,
        description: true,
        docNumber: true,
        ocrStatus: true,
      },
    }),
    prisma.document.aggregate({
      where: { userId: user.id, type: "income" },
      _sum: { amount: true },
    }),
  ]);

  const sum = agg._sum.amount?.toString() ?? "0";

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">חשבוניות</h1>
          <p className="mt-1 text-sm text-zinc-600">
            מציג עד 200 חשבוניות — סה״כ הכנסות (כל הזמן): <span className="font-semibold text-zinc-900">{sum}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a className="btn btn-primary" href="/invoices/upload">
            חשבונית חדשה
          </a>
          <a className="btn" href={showAll ? "/invoices" : "/invoices?all=1"}>
            {showAll ? "הצג החודש" : "הצג הכל"}
          </a>
          <a className="btn" href="/dashboard">
            דשבורד
          </a>
        </div>
      </div>

      <div className="card p-4">
        <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="px-3 py-2 text-right font-medium">תאריך</th>
                <th className="px-3 py-2 text-right font-medium">לקוח/ספק</th>
                <th className="px-3 py-2 text-right font-medium">תיאור</th>
                <th className="px-3 py-2 text-right font-medium">מס׳ חשבונית</th>
                <th className="px-3 py-2 text-right font-medium">סכום</th>
                <th className="px-3 py-2 text-right font-medium">OCR</th>
                <th className="px-3 py-2 text-right font-medium">פעולה</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td className="px-3 py-12 text-center text-zinc-600" colSpan={7}>
                    אין חשבוניות החודש. <a className="underline" href="/invoices/upload">העלה חשבונית</a>
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
                  <tr key={d.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                    <td className="px-3 py-2">{d.date.toISOString().slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      <a
                        className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2"
                        href={`/documents/${d.id}?from=invoices`}
                      >
                        {d.vendor}
                      </a>
                    </td>
                    <td className="px-3 py-2">{d.description ?? "—"}</td>
                    <td className="px-3 py-2">{d.docNumber ?? "—"}</td>
                    <td className="px-3 py-2">
                      {d.amount.toString()} <span className="text-xs text-zinc-600">{d.currency}</span>
                    </td>
                    <td className="px-3 py-2">
                      <OcrStatusCell docId={d.id} status={d.ocrStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <a className="btn" href={`/documents/${d.id}?from=invoices`}>
                        ערוך
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


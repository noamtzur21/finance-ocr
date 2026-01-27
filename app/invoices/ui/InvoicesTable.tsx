import { prisma } from "@/app/lib/prisma";
import OcrStatusCell from "@/app/ui/OcrStatusCell";
import Link from "next/link";

export default async function InvoicesTable(props: { userId: string; showAll: boolean }) {
  const where = { userId: props.userId, type: "income" as const };

  const [docs, agg] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: props.showAll ? 200 : 50,
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
      where,
      _sum: { amount: true },
    }),
  ]);

  const sum = agg._sum.amount?.toString() ?? "0";

  return (
    <div className="card p-4">
      <div className="mb-3 text-sm text-zinc-600">
        סה״כ הכנסות (כל הזמן): <span className="font-semibold text-zinc-900">{sum}</span>
      </div>

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
                  אין חשבוניות עדיין. <Link className="underline" href="/invoices/upload">העלה חשבונית</Link>
                </td>
              </tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                  <td className="px-3 py-2">{d.date.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2"
                      href={`/documents/${d.id}?from=invoices`}
                    >
                      {d.vendor}
                    </Link>
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
                    <Link className="btn" href={`/documents/${d.id}?from=invoices`}>
                      ערוך
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


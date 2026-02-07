import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import DocumentEditor from "./ui/DocumentEditor";

export default async function DocumentPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const { id } = await props.params;
  const sp = (await props.searchParams) ?? {};
  const from = sp.from ?? "";

  const [doc, dbUser, categories] = await Promise.all([
    prisma.document.findFirst({
      where: { id, userId: user.id },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { vatPercent: true },
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!doc || !dbUser) redirect("/dashboard");

  const backHref =
    from === "receipts" || doc.type === "expense"
      ? "/receipts"
      : from === "invoices" || doc.type === "income"
        ? "/invoices"
        : from === "payment-receipts" || doc.type === "payment_receipt"
          ? "/payment-receipts"
          : "/dashboard";

  const backLabel =
    backHref === "/receipts"
      ? "חזרה לקבלות החזר מס"
      : backHref === "/invoices"
        ? "חזרה לחשבוניות"
        : backHref === "/payment-receipts"
          ? "חזרה לקבלות על תשלום"
          : "חזרה לדשבורד";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {doc.type === "expense"
            ? "קבלת החזר מס"
            : doc.type === "payment_receipt"
              ? "קבלה על תשלום"
              : "חשבונית"}
        </h1>
        <a className="btn" href={backHref}>
          {backLabel}
        </a>
      </div>

      <DocumentEditor
        vatPercent={dbUser.vatPercent.toNumber()}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        defaultBackHref={backHref}
        doc={{
          id: doc.id,
          type: doc.type,
          date: doc.date.toISOString().slice(0, 10),
          amount: doc.amount.toString(),
          vatAmount: doc.vatAmount.toString(),
          preVatAmount: doc.preVatAmount.toString(),
          isRecognized: doc.isRecognized.toString(),
          currency: doc.currency,
          vendor: doc.vendor,
          categoryId: doc.categoryId,
          description: doc.description,
          docNumber: doc.docNumber,
          fileName: doc.fileName,
          fileKey: doc.fileKey,
          fileMime: doc.fileMime,
          ocrStatus: doc.ocrStatus,
          ocrText: doc.ocrText,
        }}
      />
    </div>
  );
}

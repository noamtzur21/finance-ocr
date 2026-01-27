import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import DocumentEditor from "./ui/DocumentEditor";

export default async function DocumentPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string }>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const { id } = await props.params;
  const sp = (await props.searchParams) ?? {};
  const from = sp.from ?? "";

  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id },
    select: { id: true, type: true },
  });
  if (!doc) redirect("/dashboard");

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const backHref =
    from === "receipts" || doc.type === "expense" ? "/receipts" : from === "invoices" || doc.type === "income" ? "/invoices" : "/dashboard";
  const backLabel = backHref === "/receipts" ? "חזרה לקבלות" : backHref === "/invoices" ? "חזרה לחשבוניות" : "חזרה לדשבורד";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{doc.type === "expense" ? "קבלה" : "חשבונית"}</h1>
          <p className="mt-1 text-sm text-zinc-600">בדיקה/תיקון מהיר של מה שה‑OCR חילץ.</p>
        </div>
        <a className="btn" href={backHref}>{backLabel}</a>
      </div>

      <DocumentEditor categories={categories} defaultBackHref={backHref} />
    </div>
  );
}



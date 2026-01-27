import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import CredentialsClient from "./ui/CredentialsClient";
import LiveRefresh from "@/app/ui/LiveRefresh";

export default async function CredentialsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const initial = await prisma.credential.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
  });

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">סיסמאות</h1>
          <p className="mt-1 text-sm text-zinc-600">כספת אישית מוצפנת — לשמירת פרטי התחברות.</p>
        </div>
        <a className="btn" href="/dashboard">
          חזרה לדשבורד
        </a>
      </div>

      <div className="card p-4">
        <CredentialsClient
          initial={initial.map((x) => ({
            ...x,
            createdAt: x.createdAt.toISOString(),
            updatedAt: x.updatedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}



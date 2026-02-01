import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import SettingsClient from "./ui/SettingsClient";
import LiveRefresh from "@/app/ui/LiveRefresh";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      businessType: true,
      businessName: true,
      taxId: true,
      vatPercent: true,
    },
  });

  if (!dbUser) redirect("/login");

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">הגדרות עסק</h1>
        <p className="mt-1 text-sm text-zinc-600">הגדר את סוג העסק שלך לצורך חישובי מע&quot;מ ודו&quot;חות לרו&quot;ח.</p>
      </div>

      <div className="card p-6">
        <SettingsClient
          initial={{
            businessType: dbUser.businessType,
            businessName: dbUser.businessName ?? "",
            taxId: dbUser.taxId ?? "",
            vatPercent: dbUser.vatPercent.toString(),
          }}
        />
      </div>
    </div>
  );
}

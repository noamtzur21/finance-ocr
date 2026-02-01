import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

const patchSchema = z.object({
  businessType: z.enum(["exempt", "licensed", "company"]),
  businessName: z.string().max(100).optional(),
  taxId: z.string().max(20).optional(),
  vatPercent: z.string().optional(),
});

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { businessType, businessName, taxId, vatPercent } = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      businessType,
      businessName: businessName || null,
      taxId: taxId || null,
      vatPercent: vatPercent ? parseFloat(vatPercent) : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}

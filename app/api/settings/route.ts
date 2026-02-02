import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

function normalizePhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return "972" + digits.slice(-9);
}

const patchSchema = z.object({
  businessType: z.enum(["exempt", "licensed", "company"]),
  businessName: z.string().max(100).optional(),
  taxId: z.string().max(20).optional(),
  vatPercent: z.string().optional(),
  phoneNumber: z.string().max(20).optional(),
  whatsappIncomingNumber: z.string().max(25).optional(),
});

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { businessType, businessName, taxId, vatPercent, phoneNumber, whatsappIncomingNumber } = parsed.data;
  const phoneE164 = phoneNumber?.trim() ? normalizePhoneE164(phoneNumber.trim()) : null;
  const incomingE164 = whatsappIncomingNumber?.trim() ? normalizePhoneE164(whatsappIncomingNumber.trim()) : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      businessType,
      businessName: businessName || null,
      taxId: taxId || null,
      vatPercent: vatPercent ? parseFloat(vatPercent) : undefined,
      phoneNumber: phoneE164,
      whatsappIncomingNumber: incomingE164,
    },
  });

  return NextResponse.json({ ok: true });
}

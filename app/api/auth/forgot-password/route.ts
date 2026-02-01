import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/app/lib/prisma";

const bodySchema = z.object({
  email: z.string().email(),
});

const RESET_EXPIRY_HOURS = 24;

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // Always return 200 so we don't leak whether the email exists
  if (!user) {
    return NextResponse.json({ ok: true, message: "If this email is registered, you will receive a reset link." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
  await prisma.passwordReset.create({
    data: { userId: user.id, token, expiresAt },
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://finance-ocr-tan.vercel.app");
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  // Optional: send email via Resend or other provider
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? "Finance OCR <noreply@resend.dev>",
          to: [email],
          subject: "איפוס סיסמה – Finance OCR",
          html: `להגדרת סיסמה חדשה לחץ כאן: <a href="${resetLink}">${resetLink}</a>. הקישור תקף ל־${RESET_EXPIRY_HOURS} שעות.`,
        }),
      });
      if (!res.ok) {
        console.error("[forgot-password] Resend failed", await res.text());
      }
    } catch (e) {
      console.error("[forgot-password] Send email failed", e);
    }
  }

  // If no email sent, return link for admin to forward (e.g. in dev or when RESEND not set)
  return NextResponse.json({
    ok: true,
    message: resendKey ? "If this email is registered, you will receive a reset link." : "Reset link created.",
    ...(resendKey ? {} : { resetLink }),
  });
}

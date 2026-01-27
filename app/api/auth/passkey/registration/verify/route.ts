import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getWebAuthnHost, getWebAuthnRelyingParty } from "@/app/lib/auth/webauthn";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const bodySchema = z.object({
  response: z.any(),
  deviceName: z.string().max(80).optional().nullable(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "AUTH_SECRET is missing" }, { status: 500 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const cs = await cookies();
  const challenge = cs.get("webauthn_reg_challenge")?.value ?? "";
  if (!challenge) return NextResponse.json({ error: "Missing challenge" }, { status: 400 });

  const { rpID, origin } = await getWebAuthnHost();
  if (!rpID) return NextResponse.json({ error: "Invalid host" }, { status: 400 });

  const verification = await verifyRegistrationResponse({
    response: parsed.data.response as RegistrationResponseJSON,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Not verified" }, { status: 400 });
  }

  const info = verification.registrationInfo;
  const deviceName = parsed.data.deviceName?.trim() ? parsed.data.deviceName.trim() : null;

  const credId = info.credential?.id;
  const pubKey = info.credential?.publicKey;
  const counter = info.credential?.counter ?? 0;
  if (!credId || !pubKey) return NextResponse.json({ error: "Missing credential" }, { status: 400 });

  await prisma.passkeyCredential.create({
    data: {
      userId: user.id,
      credentialId: Buffer.from(credId),
      publicKey: Buffer.from(pubKey),
      counter,
      transports: info.credential?.transports ? JSON.stringify(info.credential.transports) : null,
      deviceName,
    },
    select: { id: true },
  });

  // Clear challenge
  cs.set("webauthn_reg_challenge", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ ok: true, rpName: getWebAuthnRelyingParty().name });
}


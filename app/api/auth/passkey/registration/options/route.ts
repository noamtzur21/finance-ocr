import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getWebAuthnHost, getWebAuthnRelyingParty } from "@/app/lib/auth/webauthn";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rpID } = await getWebAuthnHost();
  if (!rpID) return NextResponse.json({ error: "Invalid host" }, { status: 400 });

  const existing = await prisma.passkeyCredential.findMany({
    where: { userId: user.id },
    select: { credentialId: true },
  });

  const userIdBytes = new TextEncoder().encode(user.id);
  const opts = await generateRegistrationOptions({
    rpName: getWebAuthnRelyingParty().name,
    rpID,
    userID: userIdBytes,
    userName: user.email || user.id,
    attestationType: "none",
    authenticatorSelection: {
      // Make it discoverable so user can login with one tap (no email).
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
    excludeCredentials: existing.map((c: { credentialId: Uint8Array }) => ({
      id: Buffer.from(c.credentialId).toString("base64url"),
    })),
  });

  const cs = await cookies();
  cs.set("webauthn_reg_challenge", opts.challenge, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.json(opts);
}


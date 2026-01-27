import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getWebAuthnHost, getWebAuthnRelyingParty } from "@/app/lib/auth/webauthn";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function toBytes(v: unknown): Uint8Array<ArrayBuffer> | null {
  if (!v) return null;
  if (v instanceof Uint8Array) {
    // Ensure it's backed by a real ArrayBuffer (not SharedArrayBuffer)
    const out: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(v.byteLength));
    out.set(v);
    return out;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    try {
      const b = Buffer.from(s, "base64url");
      const out: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(b.length));
      out.set(b);
      return out;
    } catch {
      try {
        const b = Buffer.from(s, "base64");
        const out: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(b.length));
        out.set(b);
        return out;
      } catch {
        return null;
      }
    }
  }
  return null;
}

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

  const credId = toBytes(info.credential?.id);
  const pubKey = toBytes(info.credential?.publicKey);
  const counter = info.credential?.counter ?? 0;
  if (!credId || !pubKey) return NextResponse.json({ error: "Missing credential" }, { status: 400 });

  // Keep multiple credentials (e.g. Mac Touch ID + iPhone Face ID).
  // If the same passkey is synced across devices, this will update the existing row.
  await prisma.passkeyCredential.upsert({
    where: { credentialId: credId },
    update: {
      userId: user.id,
      publicKey: pubKey,
      counter,
      transports: info.credential?.transports ? JSON.stringify(info.credential.transports) : null,
      deviceName,
    },
    create: {
      userId: user.id,
      credentialId: credId,
      publicKey: pubKey,
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


import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getWebAuthnHost } from "@/app/lib/auth/webauthn";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().optional().nullable(),
});

export async function POST(req: Request) {
  const { rpID } = await getWebAuthnHost();
  if (!rpID) return NextResponse.json({ error: "Invalid host" }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // If we know the user (email), send allowCredentials to support non-discoverable passkeys.
  const email = parsed.data.email?.toLowerCase().trim() ?? "";
  let allowCredentials: Array<{ id: string }> | undefined;
  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const creds = await prisma.passkeyCredential.findMany({
        where: { userId: user.id },
        select: { credentialId: true },
      });
      if (creds.length) {
        allowCredentials = creds.map((c) => ({ id: Buffer.from(c.credentialId).toString("base64url") }));
      }
    }
  }

  const opts = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    // If allowCredentials is omitted, the client can use discoverable credentials.
    ...(allowCredentials ? { allowCredentials } : {}),
  });

  const cs = await cookies();
  cs.set("webauthn_auth_challenge", opts.challenge, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  // IMPORTANT: Return only the WebAuthn options object (no extra fields),
  // because the browser helper may be strict about the shape.
  return NextResponse.json(opts);
}


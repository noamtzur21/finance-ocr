import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { getWebAuthnHost, getWebAuthnRelyingParty } from "@/app/lib/auth/webauthn";

export const runtime = "nodejs";

export async function POST() {
  const { rpID } = await getWebAuthnHost();
  if (!rpID) return NextResponse.json({ error: "Invalid host" }, { status: 400 });

  const opts = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    // no allowCredentials: allow "discoverable" credentials (Face ID / Touch ID)
  });

  const cs = await cookies();
  cs.set("webauthn_auth_challenge", opts.challenge, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.json({ ...opts, rpName: getWebAuthnRelyingParty().name });
}


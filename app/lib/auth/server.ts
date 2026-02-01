import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/prisma";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  return await verifySessionToken(token, secret);
}

export async function requireUser() {
  const session = await getSession();
  const userId = session?.sub;
  if (!userId) return null;

  // Avoid hitting the DB on every request just to load the user.
  // The session token is already verified and contains the email.
  return {
    id: userId,
    email: session?.email ?? "",
  };
}

/** Returns user with isAdmin; use for admin-only routes. Returns null if not logged in or not admin. */
export async function requireAdmin() {
  const session = await getSession();
  const userId = session?.sub;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, isAdmin: true },
  });
  if (!user?.isAdmin) return null;
  return { id: user.id, email: user.email };
}



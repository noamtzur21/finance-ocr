import { cookies } from "next/headers";
import { prisma } from "@/app/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/app/lib/auth/session";

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  return user;
}



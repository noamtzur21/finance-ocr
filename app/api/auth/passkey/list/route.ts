import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.passkeyCredential.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, deviceName: true, createdAt: true },
  });

  return NextResponse.json(
    rows.map((r: { id: string; deviceName: string | null; createdAt: Date }) => ({
      id: r.id,
      deviceName: r.deviceName,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}


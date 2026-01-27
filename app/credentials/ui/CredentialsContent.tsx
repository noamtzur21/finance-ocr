import { prisma } from "@/app/lib/prisma";
import CredentialsClient from "./CredentialsClient";

export default async function CredentialsContent(props: { userId: string }) {
  const initial = await prisma.credential.findMany({
    where: { userId: props.userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
  });

  return (
    <div className="card p-4">
      <CredentialsClient
        initial={initial.map((x) => ({
          ...x,
          createdAt: x.createdAt.toISOString(),
          updatedAt: x.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}


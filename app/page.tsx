import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth/server";

export default async function Home() {
  const session = await getSession();
  if (session?.sub) redirect("/dashboard");
  redirect("/login");
}

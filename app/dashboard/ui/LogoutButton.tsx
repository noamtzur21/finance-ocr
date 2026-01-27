"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setLoading(false);
    router.replace("/login");
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="btn"
      type="button"
    >
      {loading ? "מתנתק..." : "התנתק"}
    </button>
  );
}



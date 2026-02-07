import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppFrame from "@/app/ui/AppFrame";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finance OCR",
  description: "כספת דיגיטלית לניהול קבלות וחשבוניות",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finance OCR",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Make all pages dynamic to avoid stale/cached data between devices.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const vercelEnv = process.env.VERCEL_ENV;
  const isNonProd = vercelEnv && vercelEnv !== "production";
  return (
    <html lang="he" dir="rtl">
      <body className={inter.className}>
        {isNonProd ? (
          <div className="w-full bg-amber-100 text-amber-900 border-b border-amber-200 px-4 py-2 text-xs">
            אתה נמצא בסביבת בדיקה ({vercelEnv}). ייתכן שתראה נתונים שונים מ-Production אם ה-DB שונה.
          </div>
        ) : null}
        <Suspense fallback={<div />}>
          <AppFrame>{children}</AppFrame>
        </Suspense>
      </body>
    </html>
  );
}

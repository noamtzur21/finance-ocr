"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import OcrWorkerRunner from "@/app/ui/OcrWorkerRunner";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactNode;
};

const nav: NavItem[] = [
  {
    href: "/dashboard",
    label: "דשבורד",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-10h8V3h-8v8Z" />
      </svg>
    ),
  },
  {
    href: "/transactions",
    label: "תנועות אחרונות",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7h18M7 3h10M6 11h12M6 15h12M6 19h8" />
      </svg>
    ),
  },
  {
    href: "/invoices",
    label: "חשבוניות",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 3h7l3 3v15a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v4h4" />
        <path d="M8 11h8M8 15h8M8 19h6" />
      </svg>
    ),
  },
  {
    href: "/receipts",
    label: "קבלות",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
    ),
  },
  {
    href: "/investments",
    label: "השקעות",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17l6-6 4 4 7-7" />
        <path d="M21 7v6h-6" />
      </svg>
    ),
  },
  {
    href: "/budget",
    label: "תקציב",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1v22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    href: "/credentials",
    label: "סיסמאות",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 10V7a5 5 0 0 1 10 0v3" />
        <path d="M5 10h14v11H5z" />
      </svg>
    ),
  },
  {
    href: "/export",
    label: "ייצוא",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3v12" />
        <path d="M8 11l4 4 4-4" />
        <path d="M4 21h16" />
      </svg>
    ),
  },
];

export default function AppFrame(props: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const sp = useSearchParams();
  const isPreview = sp?.get("preview") === "1";
  const isAuthPage = pathname === "/login" || pathname === "/setup";
  const enableBrowserRunner =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_OCR_BROWSER_RUNNER === "1";

  // Small-screen drawer
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const spKey = sp?.toString() ?? "";
  const active = useMemo(() => {
    const direct = nav.find((n) => pathname.startsWith(n.href))?.href;
    if (direct) return direct;
    if (pathname.startsWith("/documents")) {
      const from = new URLSearchParams(spKey).get("from");
      if (from === "receipts") return "/receipts";
      if (from === "invoices") return "/invoices";
    }
    return "/dashboard";
  }, [pathname, spKey]);

  const previewUrl = useMemo(() => {
    const p = new URLSearchParams(sp?.toString());
    p.set("preview", "1");
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, sp]);

  if (isAuthPage) return <>{props.children}</>;

  return (
    <div className="app-shell">
      {enableBrowserRunner ? <OcrWorkerRunner intervalMs={2000} /> : null}
      {/* Top bar */}
      <div className="app-topbar">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="btn btn-ghost md:hidden"
            onClick={() => setOpen(true)}
            aria-label="פתח תפריט"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="brand-badge" aria-hidden />
            <span className="text-sm font-semibold tracking-tight text-zinc-900">Finance OCR</span>
          </Link>

          <div className="flex-1" />

          {!isPreview ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPreviewOpen(true)}
                aria-label="תצוגת מובייל (iPhone 15 Pro)"
                title="תצוגת מובייל (iPhone 15 Pro)"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
                  <path d="M11 19h2" />
                </svg>
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[280px_1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:block">
          <nav className="card card-soft p-2">
            <div className="px-3 pb-2 pt-3 text-xs font-medium text-zinc-500">ניווט</div>
            <div className="flex flex-col gap-1">
              {nav.map((item) => {
                const isActive = active === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx("nav-link", isActive && "nav-link-active")}
                  >
                    <span className={cx("nav-icon", isActive && "nav-icon-active")}>
                      {item.icon({ className: "h-5 w-5" })}
                    </span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
          <div className="mt-3 text-xs text-zinc-500">
            טיפ: העלאה → OCR → תיקון ידני → ייצוא לרו״ח.
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0">{props.children}</main>
      </div>

      {/* Drawer (mobile) */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="סגור תפריט"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[86%] max-w-sm bg-white p-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="brand-badge" aria-hidden />
                <span className="text-sm font-semibold tracking-tight text-zinc-900">Finance OCR</span>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} aria-label="סגור">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              {nav.map((item) => {
                const isActive = active === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cx("nav-link", isActive && "nav-link-active")}
                  >
                    <span className={cx("nav-icon", isActive && "nav-icon-active")}>
                      {item.icon({ className: "h-5 w-5" })}
                    </span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* iPhone preview modal */}
      {previewOpen ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="סגור תצוגה"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="absolute inset-x-0 top-8 mx-auto w-[min(980px,92vw)]">
            <div className="card card-soft overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-200/70 bg-white/70 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="brand-badge" aria-hidden />
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">תצוגת מובייל</div>
                    <div className="text-xs text-zinc-600">iPhone 15 Pro (393×852)</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a className="btn" href={previewUrl} target="_blank" rel="noreferrer">
                    פתח בטאב
                  </a>
                  <button type="button" className="btn" onClick={() => setPreviewOpen(false)}>
                    סגור
                  </button>
                </div>
              </div>

              <div className="flex justify-center bg-zinc-50/40 p-6">
                <div className="device-iphone">
                  <div className="device-notch" aria-hidden />
                  <iframe title="Mobile preview" className="device-screen" src={previewUrl} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


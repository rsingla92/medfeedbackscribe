"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DebriefWordmark } from "./content";

const NAV_LINKS = [
  { href: "/for-programs", label: "For programs" },
  { href: "/about", label: "About" },
  { href: "/security", label: "Security" },
];

export function SiteNav({
  isAuthenticated = false,
}: {
  isAuthenticated?: boolean;
} = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);

  const primaryHref = isAuthenticated ? "/dashboard" : "/auth";
  const primaryLabel = isAuthenticated ? "Dashboard" : "Sign in";

  return (
    <header className="border-b border-border-light bg-background">
      <nav
        className="mx-auto flex max-w-[960px] items-center justify-between gap-3 px-6 py-4"
        aria-label="Site navigation"
      >
        <DebriefWordmark href="/" />

        <ul
          className="hidden items-center gap-7 md:flex"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "text-sm transition-colors " +
                    (active
                      ? "text-foreground font-medium"
                      : "text-muted hover:text-foreground")
                  }
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href={primaryHref}
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-border-light"
          >
            {primaryLabel}
          </Link>
          <Link
            href="/demo"
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Try it free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-nav-mobile"
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-foreground transition-colors hover:bg-border-light md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className="h-5 w-5"
            aria-hidden="true"
          >
            {open ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 6l12 12M6 18L18 6"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7h16M4 12h16M4 17h16"
              />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div
          id="site-nav-mobile"
          className="border-t border-border-light bg-background md:hidden"
        >
          <ul className="mx-auto flex max-w-[960px] flex-col gap-1 px-6 py-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={closeMenu}
                  className="block rounded-[var(--radius-md)] px-3 py-2 text-base text-foreground transition-colors hover:bg-border-light"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 flex flex-col gap-2 border-t border-border-light pt-3">
              <Link
                href={primaryHref}
                onClick={closeMenu}
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-border-light"
              >
                {primaryLabel}
              </Link>
              <Link
                href="/demo"
                onClick={closeMenu}
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Try it free
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

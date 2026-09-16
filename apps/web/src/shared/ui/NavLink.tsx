"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
        active
          ? "bg-white/20 text-white"
          : "text-white/70 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </Link>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const path = usePathname();
  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/products", label: "Products" },
    { href: "/import", label: "Import CSV" },
  ];
  return (
    <nav className="bg-white border-b px-8 py-3 flex items-center gap-6">
      <span className="font-bold text-gray-900 mr-4">OPM</span>
      {links.map(l => (
        <Link key={l.href} href={l.href}
          className={`text-sm font-medium ${path === l.href ? "text-blue-600 border-b-2 border-blue-600 pb-0.5" : "text-gray-500 hover:text-gray-900"}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

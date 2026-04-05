"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabItem = {
  href: string;
  label: string;
};

export default function MobileTabBar({
  items,
}: {
  items: TabItem[];
}) {
  const pathname = usePathname();

  return (
    <nav
      className="mobile-tabbar"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: "#0f172a",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        padding: "8px 6px calc(8px + env(safe-area-inset-bottom))",
      }}
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              textDecoration: "none",
              color: active ? "#ffffff" : "rgba(255,255,255,0.65)",
              fontSize: 12,
              textAlign: "center",
              padding: "8px 4px",
              borderRadius: 10,
              background: active ? "rgba(255,255,255,0.08)" : "transparent",
              fontWeight: active ? 700 : 500,
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
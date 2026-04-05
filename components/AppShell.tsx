"use client";

import MobileTabBar from "@/components/MobileTabBar";

const coachTabs = [
  { href: "/dashboard", label: "Home" },
  { href: "/coach", label: "Athleten" },
  { href: "/coach/messages", label: "Nachrichten" },
  { href: "/coach/checkins", label: "Check-ins" },
  { href: "/coach/more", label: "Mehr" },
];

const athleteTabs = [
  { href: "/athlete", label: "Home" },
  { href: "/athlete/messages", label: "Nachrichten" },
  { href: "/athlete/checkin", label: "Check-in" },
  { href: "/athlete/plans", label: "Pläne" },
  { href: "/athlete/profile", label: "Profil" },
];

export default function AppShell({
  role,
  children,
}: {
  role: "coach" | "admin" | "athlete";
  children: React.ReactNode;
}) {
  const tabs = role === "athlete" ? athleteTabs : coachTabs;

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          paddingBottom: 90,
        }}
      >
        {children}
      </div>

      <div className="show-mobile-only">
        <MobileTabBar items={tabs} />
      </div>
    </>
  );
}
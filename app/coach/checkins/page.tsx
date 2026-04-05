"use client";

import AppShell from "@/components/AppShell";
import { Header } from "@/components/Header";

export default function CoachCheckinsPage() {
  return (
    <AppShell role="coach">
      <main className="page">
        <Header title="Check-ins" subtitle="Alle Check-ins deiner Athleten" />

        <section className="card">
          <p className="muted">Hier kommen Check-ins rein</p>
        </section>
      </main>
    </AppShell>
  );
}
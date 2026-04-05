"use client";

import AppShell from "@/components/AppShell";
import { Header } from "@/components/Header";

export default function CoachMessagesPage() {
  return (
    <AppShell role="coach">
      <main className="page">
        <Header title="Nachrichten" subtitle="Alle Nachrichten mit Athleten" />

        <section className="card">
          <p className="muted">Hier kommen später alle Nachrichten rein</p>
        </section>
      </main>
    </AppShell>
  );
}
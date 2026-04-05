"use client";

import AppShell from "@/components/AppShell";
import { Header } from "@/components/Header";

export default function AthleteCheckinPage() {
  return (
    <AppShell role="athlete">
      <main className="page">
        <Header title="Check-in" subtitle="Deinen nächsten Check-in schnell erfassen" />

        <section className="card">
          <p className="muted">Hier kommt gleich die eigene Check-in-Seite rein.</p>
        </section>
      </main>
    </AppShell>
  );
}
"use client";

import AppShell from "@/components/AppShell";
import { Header } from "@/components/Header";

export default function AthletePlansPage() {
  return (
    <AppShell role="athlete">
      <main className="page">
        <Header title="Pläne" subtitle="Trainings- und Ernährungspläne" />

        <section className="card">
          <p className="muted">Hier kommen gleich die Pläne sauber getrennt rein.</p>
        </section>
      </main>
    </AppShell>
  );
}
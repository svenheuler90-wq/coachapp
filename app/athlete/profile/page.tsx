"use client";

import AppShell from "@/components/AppShell";
import { Header } from "@/components/Header";

export default function AthleteProfilePage() {
  return (
    <AppShell role="athlete">
      <main className="page">
        <Header title="Profil" subtitle="Deine Daten und Einstellungen" />

        <section className="card">
          <p className="muted">Hier kommen gleich Profil, Phase und Check-in-Infos rein.</p>
        </section>
      </main>
    </AppShell>
  );
}
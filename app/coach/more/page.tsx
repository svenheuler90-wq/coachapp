"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Header } from "@/components/Header";

export default function CoachMorePage() {
  const [text, setText] = useState("");

  const sendBroadcast = async () => {
    if (!text.trim()) return;

    await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "broadcast_message",
        title: "Info vom Coach",
        message: text,
      }),
    });

    setText("");
    alert("Gesendet");
  };

  return (
    <AppShell role="coach">
      <main className="page">
        <Header title="Mehr" subtitle="Einstellungen & Broadcast" />

        <section className="card">
          <h3>Nachricht an alle</h3>

          <textarea
            placeholder="Nachricht an alle Athleten..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <button className="btn btn-primary" onClick={sendBroadcast}>
            An alle senden
          </button>
        </section>
      </main>
    </AppShell>
  );
}
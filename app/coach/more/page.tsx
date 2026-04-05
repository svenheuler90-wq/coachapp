"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Header } from "@/components/Header";
import { supabase } from "@/lib/supabase";

function noticeStyle(message: string) {
  const isError =
    message.toLowerCase().includes("fehler") ||
    message.toLowerCase().includes("error") ||
    message.toLowerCase().includes("ungültig");

  return {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    color: "white",
    background: isError ? "#7f1d1d" : "#065f46",
  };
}

export default function CoachMorePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [text, setText] = useState("");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error || !profile || (profile.role !== "coach" && profile.role !== "admin")) {
        router.replace("/login");
        return;
      }

      setMe(profile);
    };

    init();
  }, [router]);

  const sendBroadcast = async () => {
    if (!text.trim()) {
      setInfo("Fehler: Bitte zuerst eine Nachricht eingeben.");
      return;
    }

    setSending(true);
    setInfo("");

    try {
      const localCreatedAt = new Date().toLocaleString("de-DE");

      const { error } = await supabase.from("messages").insert({
        athlete_id: null,
        sender_role: "coach",
        content: text.trim(),
        is_seen: false,
        local_created_at: localCreatedAt,
      });

      if (error) {
        setInfo("Fehler: " + error.message);
        return;
      }

      await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "broadcast_message",
          senderUserId: me?.id || null,
          title: "Neue Nachricht an alle",
          message: text.trim(),
          url: `/athlete/messages`,
        }),
      });

      setText("");
      setInfo("Nachricht an alle gesendet.");
    } finally {
      setSending(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <AppShell role={me?.role === "admin" ? "admin" : "coach"}>
      <main className="page">
        <Header title="Mehr" subtitle="Broadcast und weitere Aktionen" />

        {info ? <div style={noticeStyle(info)}>{info}</div> : null}

        <section className="card">
          <h3>Nachricht an alle Athleten</h3>
          <textarea
            placeholder="Nachricht an alle Athleten..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="button-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={sendBroadcast} disabled={sending}>
              {sending ? "Sende..." : "An alle senden"}
            </button>
          </div>
        </section>

        <section className="card" style={{ marginTop: 12 }}>
          <h3>Account</h3>
          <div className="button-row" style={{ marginTop: 12 }}>
            <button className="btn btn-secondary" onClick={logout}>
              Logout
            </button>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
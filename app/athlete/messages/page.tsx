"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Header } from "@/components/Header";
import { supabase } from "@/lib/supabase";

function formatDateTimeDE(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("de-DE");
}

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

export default function AthleteMessagesPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: me, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error || !me || me.role !== "athlete") {
        router.replace("/login");
        return;
      }

      setProfile(me);
      await loadMessages(me.id);
      setLoading(false);
    };

    init();
  }, [router]);

  const loadMessages = async (athleteId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`athlete_id.eq.${athleteId},athlete_id.is.null`)
      .order("created_at", { ascending: true });

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setMessages(data || []);
  };

  const sendMessage = async () => {
    if (!profile) return;

    setInfo("");

    if (!messageText.trim()) {
      setInfo("Fehler: Bitte zuerst eine Nachricht eingeben.");
      return;
    }

    setSending(true);

    try {
      const localCreatedAt = new Date().toLocaleString("de-DE");

      const { error } = await supabase.from("messages").insert({
        athlete_id: profile.id,
        sender_role: "athlete",
        content: messageText.trim(),
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
          type: "message_from_athlete",
          athleteId: profile.id,
          senderUserId: profile.id,
          title: "Neue Nachricht vom Athleten",
          message: messageText.trim(),
          url: `/coach?athlete=${profile.id}`,
        }),
      });

      setMessageText("");
      setInfo("Nachricht gesendet.");
      await loadMessages(profile.id);
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell role="athlete">
      <main className="page">
        <Header title="Nachrichten" subtitle="Chat mit deinem Coach" />

        {info ? <div style={noticeStyle(info)}>{info}</div> : null}

        {loading ? (
          <section className="card">
            <p className="muted">Lade Nachrichten...</p>
          </section>
        ) : (
          <>
            <section
              className="card"
              style={{
                minHeight: 320,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {messages.length === 0 ? (
                <p className="muted">Noch keine Nachrichten vorhanden.</p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_role === "athlete";
                  const isBroadcast = !msg.athlete_id;

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: isBroadcast ? "center" : isMine ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "82%",
                          padding: 12,
                          borderRadius: 16,
                          background: isBroadcast
                            ? "#3f3f46"
                            : isMine
                              ? "#2563eb"
                              : "#1f2937",
                          color: "white",
                        }}
                      >
                        {isBroadcast ? (
                          <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 6 }}>
                            📢 Nachricht an alle
                          </div>
                        ) : null}

                        <div style={{ fontWeight: 700, marginBottom: 6 }}>
                          {isBroadcast ? "CoachFlow" : isMine ? "Du" : "Coach"}
                        </div>

                        <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>

                        <div
                          style={{
                            fontSize: 11,
                            opacity: 0.75,
                            marginTop: 8,
                          }}
                        >
                          {msg.local_created_at || formatDateTimeDE(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            <section className="card" style={{ marginTop: 12 }}>
              <label>Neue Nachricht</label>
              <textarea
                placeholder="Nachricht an deinen Coach..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />

              <div className="button-row" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" onClick={sendMessage} disabled={sending}>
                  {sending ? "Sende..." : "Senden"}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
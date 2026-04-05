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

export default function CoachMessagesPage() {
  const router = useRouter();

  const [me, setMe] = useState<any>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);

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

      let athleteQuery = supabase.from("profiles").select("*").eq("role", "athlete");
      if (profile.role === "coach") {
        athleteQuery = athleteQuery.eq("coach_id", profile.id);
      }

      const { data: athleteData, error: athleteError } = await athleteQuery.order("full_name", {
        ascending: true,
      });

      if (athleteError) {
        setInfo("Fehler: " + athleteError.message);
        setLoading(false);
        return;
      }

      const athleteList = athleteData || [];
      setAthletes(athleteList);

      if (athleteList.length > 0) {
        setSelectedAthleteId(athleteList[0].id);
        await loadMessages(athleteList[0].id);
      }

      setLoading(false);
    };

    init();
  }, [router]);

  const loadMessages = async (athleteId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: true });

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setMessages(data || []);
  };

  const handleChangeAthlete = async (athleteId: string) => {
    setSelectedAthleteId(athleteId);
    await loadMessages(athleteId);
  };

  const sendMessage = async () => {
    if (!selectedAthleteId || !messageText.trim()) {
      setInfo("Fehler: Bitte Athlet wählen und Nachricht eingeben.");
      return;
    }

    setSending(true);
    setInfo("");

    try {
      const localCreatedAt = new Date().toLocaleString("de-DE");

      const { error } = await supabase.from("messages").insert({
        athlete_id: selectedAthleteId,
        sender_role: "coach",
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
          type: "message_from_coach",
          athleteId: selectedAthleteId,
          senderUserId: me?.id || null,
          title: "Neue Nachricht vom Coach",
          message: messageText.trim(),
          url: `/athlete/messages`,
        }),
      });

      setMessageText("");
      await loadMessages(selectedAthleteId);
      setInfo("Nachricht gesendet.");
    } finally {
      setSending(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) {
      setInfo("Fehler: Bitte Nachricht an alle eingeben.");
      return;
    }

    setSendingBroadcast(true);
    setInfo("");

    try {
      const localCreatedAt = new Date().toLocaleString("de-DE");

      const { error } = await supabase.from("messages").insert({
        athlete_id: null,
        sender_role: "coach",
        content: broadcastText.trim(),
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
          message: broadcastText.trim(),
          url: `/athlete/messages`,
        }),
      });

      setBroadcastText("");
      setInfo("Nachricht an alle gesendet.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const selectedAthlete = athletes.find((a) => a.id === selectedAthleteId);

  return (
    <AppShell role={me?.role === "admin" ? "admin" : "coach"}>
      <main className="page">
        <Header title="Nachrichten" subtitle="Athleten-Nachrichten und Broadcast" />

        {info ? <div style={noticeStyle(info)}>{info}</div> : null}

        {loading ? (
          <section className="card">
            <p className="muted">Lade Nachrichten...</p>
          </section>
        ) : (
          <>
            <section className="card">
              <label>Athlet auswählen</label>
              <select
                value={selectedAthleteId}
                onChange={(e) => handleChangeAthlete(e.target.value)}
              >
                {athletes.length === 0 ? <option value="">Keine Athleten</option> : null}
                {athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {athlete.full_name || "-"}
                  </option>
                ))}
              </select>
            </section>

            <section className="card" style={{ marginTop: 12 }}>
              <strong>Nachricht an alle Athleten</strong>
              <textarea
                placeholder="Broadcast Nachricht..."
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                style={{ marginTop: 10 }}
              />
              <div className="button-row" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" onClick={sendBroadcast} disabled={sendingBroadcast}>
                  {sendingBroadcast ? "Sende..." : "An alle senden"}
                </button>
              </div>
            </section>

            <section
              className="card"
              style={{
                marginTop: 12,
                minHeight: 320,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <strong>{selectedAthlete?.full_name || "Nachrichten"}</strong>

              {messages.length === 0 ? (
                <p className="muted">Keine Nachrichten vorhanden.</p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_role === "coach";

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: isMine ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "82%",
                          padding: 12,
                          borderRadius: 16,
                          background: isMine ? "#2563eb" : "#1f2937",
                          color: "white",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>
                          {isMine ? "Du" : "Athlet"}
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
                placeholder="Nachricht an den Athleten..."
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
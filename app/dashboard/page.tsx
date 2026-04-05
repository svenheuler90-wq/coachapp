"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import LayoutEditor from "@/components/LayoutEditor";
import {
  defaultLayouts,
  getLayoutItemWidthClass,
  normalizeLayout,
  sortSectionsByLayout,
  type LayoutItem,
} from "@/lib/layout";

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setHours(23, 59, 59, 999);
  sunday.setDate(monday.getDate() + 6);

  return { monday, sunday };
}

function formatGermanDate(date: Date) {
  return date.toLocaleDateString("de-DE");
}

function getCheckinDateValue(checkin: any) {
  if (checkin?.date) return checkin.date;
  if (checkin?.local_datetime) return String(checkin.local_datetime).slice(0, 10);
  if (checkin?.created_at) return new Date(checkin.created_at).toISOString().slice(0, 10);
  return null;
}

function statusBadge(done: boolean) {
  return {
    background: done ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
    color: done ? "#86efac" : "#fca5a5",
    border: done ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(239,68,68,0.4)",
    borderRadius: 999,
    padding: "4px 10px",
    display: "inline-block" as const,
    fontSize: 12,
    fontWeight: 700,
  };
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

const layoutLabels: Record<string, string> = {
  broadcast: "Nachricht an alle",
  openAthlete: "Athlet öffnen",
  doneCheckins: "Check-in erledigt",
  missingCheckins: "Check-in fehlt",
  latestCheckins: "Letzte Check-ins",
  latestMessages: "Neueste Nachrichten",
};

export default function DashboardPage() {
  const router = useRouter();

  const [athletes, setAthletes] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [broadcast, setBroadcast] = useState("");
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [editingBroadcastId, setEditingBroadcastId] = useState<string | null>(null);
  const [editBroadcastText, setEditBroadcastText] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);

  const [layout, setLayout] = useState<LayoutItem[]>(defaultLayouts.dashboard);
  const [editingLayout, setEditingLayout] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  const weekRange = useMemo(() => getCurrentWeekRange(), []);

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error || !profile) {
        setInfo("Fehler: Profil konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      if (profile.role !== "admin" && profile.role !== "coach") {
        router.replace("/athlete");
        return;
      }

      setMe(profile);
      await Promise.all([loadData(profile), loadLayout()]);
      setLoading(false);
    };

    init();
  }, [router]);

  const loadLayout = async () => {
    const { data } = await supabase
      .from("app_layouts")
      .select("layout")
      .eq("page_key", "dashboard")
      .maybeSingle();

    setLayout(normalizeLayout("dashboard", data?.layout));
  };

  const saveLayout = async () => {
    setSavingLayout(true);
    setInfo("");

    const normalized = normalizeLayout("dashboard", layout);

    const { error } = await supabase
      .from("app_layouts")
      .upsert(
        {
          page_key: "dashboard",
          layout: normalized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "page_key" }
      );

    setSavingLayout(false);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setLayout(normalized);
    setInfo("Layout gespeichert.");
  };

  const loadData = async (profileArg?: any) => {
    const profile = profileArg || me;
    if (!profile) return;

    let athleteQuery = supabase.from("profiles").select("*").eq("role", "athlete");

    if (profile.role === "coach") {
      athleteQuery = athleteQuery.eq("coach_id", profile.id);
    }

    const { data: athletesData } = await athleteQuery.order("full_name", { ascending: true });
    const athleteIds = (athletesData || []).map((a) => a.id);

    let checkinsData: any[] = [];
    let messagesData: any[] = [];

    if (athleteIds.length > 0) {
      const { data: c } = await supabase
        .from("checkins")
        .select("*")
        .in("athlete_id", athleteIds)
        .order("created_at", { ascending: false })
        .limit(200);

      checkinsData = c || [];

      const { data: m } = await supabase
        .from("messages")
        .select("*")
        .or(`athlete_id.is.null,athlete_id.in.(${athleteIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(100);

      messagesData = m || [];
    } else {
      const { data: m } = await supabase
        .from("messages")
        .select("*")
        .is("athlete_id", null)
        .order("created_at", { ascending: false })
        .limit(50);

      messagesData = m || [];
    }

    setAthletes(athletesData || []);
    setCheckins(checkinsData);
    setMessages(messagesData || []);
  };

  const sendBroadcast = async () => {
    setInfo("");

    if (!broadcast.trim()) {
      setInfo("Fehler: Bitte zuerst eine Nachricht eingeben.");
      return;
    }

    const localCreatedAt = new Date().toLocaleString("de-DE");

    const { error } = await supabase.from("messages").insert({
      athlete_id: null,
      sender_role: "coach",
      content: broadcast.trim(),
      is_seen: false,
      local_created_at: localCreatedAt,
    });

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setBroadcast("");
    setInfo("Nachricht an alle gespeichert.");
    await loadData();
  };

  const startEditBroadcast = (message: any) => {
    setEditingBroadcastId(message.id);
    setEditBroadcastText(message.content || "");
  };

  const saveBroadcastEdit = async () => {
    if (!editingBroadcastId) return;

    if (!editBroadcastText.trim()) {
      setInfo("Fehler: Nachricht darf nicht leer sein.");
      return;
    }

    const { error } = await supabase
      .from("messages")
      .update({
        content: editBroadcastText.trim(),
      })
      .eq("id", editingBroadcastId);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setEditingBroadcastId(null);
    setEditBroadcastText("");
    setInfo("Nachricht an alle bearbeitet.");
    await loadData();
  };

  const deleteBroadcast = async (messageId: string) => {
    const confirmed = window.confirm("Diese Nachricht an alle wirklich löschen?");
    if (!confirmed) return;

    const { error } = await supabase.from("messages").delete().eq("id", messageId);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setInfo("Nachricht an alle gelöscht.");
    await loadData();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const athleteMap = useMemo(() => {
    const map = new Map<string, any>();
    athletes.forEach((a) => map.set(a.id, a));
    return map;
  }, [athletes]);

  const mondayStr = weekRange.monday.toISOString().slice(0, 10);
  const sundayStr = weekRange.sunday.toISOString().slice(0, 10);

  const checkedInAthleteIdsThisWeek = useMemo(() => {
    const ids = new Set<string>();

    checkins.forEach((checkin) => {
      const dateValue = getCheckinDateValue(checkin);
      if (!dateValue) return;
      if (dateValue >= mondayStr && dateValue <= sundayStr) {
        ids.add(checkin.athlete_id);
      }
    });

    return ids;
  }, [checkins, mondayStr, sundayStr]);

  const athletesDone = athletes.filter((a) => checkedInAthleteIdsThisWeek.has(a.id));
  const athletesMissing = athletes.filter((a) => !checkedInAthleteIdsThisWeek.has(a.id));

  const latestCheckinsWithNames = checkins.map((checkin) => ({
    ...checkin,
    athlete_name: athleteMap.get(checkin.athlete_id)?.full_name || "Unbekannt",
  }));

  const latestMessagesWithNames = messages.map((msg) => ({
    ...msg,
    athlete_name: msg.athlete_id ? athleteMap.get(msg.athlete_id)?.full_name || "Athlet" : "Alle Athleten",
  }));

  const broadcastMessages = latestMessagesWithNames.filter((m) => !m.athlete_id);

  const sections = sortSectionsByLayout(
    [
      {
        id: "broadcast",
        content: (
          <div
            className="card"
            style={{ borderLeft: "4px solid #60a5fa", minWidth: 0 }}
          >
            <h2>Nachricht an alle</h2>
            <textarea
              placeholder="Nachricht an alle Athleten..."
              value={broadcast}
              onChange={(e) => setBroadcast(e.target.value)}
            />
            <div className="button-row">
              <button className="btn btn-primary" onClick={sendBroadcast}>
                Nachricht senden
              </button>
            </div>

            {broadcastMessages.length > 0 ? (
              <>
                <h3 style={{ marginTop: 20 }}>Bisherige Nachrichten an alle</h3>
                <div className="stack">
                  {broadcastMessages.map((msg) => (
                    <div key={msg.id} className="item">
                      {editingBroadcastId === msg.id ? (
                        <>
                          <textarea
                            value={editBroadcastText}
                            onChange={(e) => setEditBroadcastText(e.target.value)}
                          />
                          <div className="button-row">
                            <button className="btn btn-primary" onClick={saveBroadcastEdit}>
                              Speichern
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setEditingBroadcastId(null);
                                setEditBroadcastText("");
                              }}
                            >
                              Abbrechen
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 4 }}>
                            📢 Nachricht an alle
                          </div>
                          <strong>Coach</strong>
                          <div>{msg.content}</div>
                          <div className="muted">
                            {msg.local_created_at ||
                              (msg.created_at
                                ? new Date(msg.created_at).toLocaleString("de-DE")
                                : "-")}
                          </div>
                          <div className="button-row" style={{ marginTop: 10 }}>
                            <button className="btn btn-secondary" onClick={() => startEditBroadcast(msg)}>
                              Bearbeiten
                            </button>
                            <button className="btn btn-secondary" onClick={() => deleteBroadcast(msg.id)}>
                              Löschen
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ),
      },
      {
        id: "openAthlete",
        content: (
          <div
            className="card"
            style={{ borderLeft: "4px solid #60a5fa", minWidth: 0 }}
          >
            <h2>Athlet öffnen</h2>
            <div className="grid two">
              <select
                value={selectedAthleteId}
                onChange={(e) => setSelectedAthleteId(e.target.value)}
              >
                <option value="">Bitte wählen</option>
                {athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {athlete.full_name}
                  </option>
                ))}
              </select>

              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!selectedAthleteId) {
                    setInfo("Fehler: Bitte einen Athleten auswählen.");
                    return;
                  }
                  router.push(`/coach?athlete=${selectedAthleteId}`);
                }}
              >
                Athlet öffnen
              </button>
            </div>
          </div>
        ),
      },
      {
        id: "doneCheckins",
        content: (
          <div className="card" style={{ minWidth: 0 }}>
            <h2>Check-in erledigt</h2>

            {athletesDone.length === 0 ? (
              <p className="muted">Bisher niemand.</p>
            ) : (
              <div className="stack">
                {athletesDone.map((athlete) => (
                  <div key={athlete.id} className="item">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <strong>{athlete.full_name}</strong>
                      <span style={statusBadge(true)}>Erledigt</span>
                    </div>
                    <div className="muted">Phase: {athlete.current_phase || "-"}</div>
                    <div className="button-row" style={{ marginTop: 10 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => router.push(`/coach?athlete=${athlete.id}`)}
                      >
                        Öffnen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "missingCheckins",
        content: (
          <div className="card" style={{ minWidth: 0 }}>
            <h2>Check-in fehlt</h2>

            {athletesMissing.length === 0 ? (
              <p className="muted">Alle haben abgegeben.</p>
            ) : (
              <div className="stack">
                {athletesMissing.map((athlete) => (
                  <div key={athlete.id} className="item">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <strong>{athlete.full_name}</strong>
                      <span style={statusBadge(false)}>Offen</span>
                    </div>
                    <div className="muted">Phase: {athlete.current_phase || "-"}</div>
                    <div className="button-row" style={{ marginTop: 10 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => router.push(`/coach?athlete=${athlete.id}`)}
                      >
                        Öffnen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "latestCheckins",
        content: (
          <div className="card" style={{ minWidth: 0 }}>
            <h2>Letzte Check-ins</h2>

            {latestCheckinsWithNames.length === 0 ? (
              <p className="muted">Noch keine Check-ins vorhanden.</p>
            ) : (
              <div className="stack">
                {latestCheckinsWithNames.map((item) => (
                  <div
                    key={item.id}
                    className="item"
                    style={{ cursor: "pointer", borderLeft: "4px solid #22c55e" }}
                    onClick={() => router.push(`/coach?athlete=${item.athlete_id}`)}
                  >
                    <strong>{item.athlete_name}</strong>
                    <div className="muted">
                      {item.local_datetime ||
                        (item.created_at
                          ? new Date(item.created_at).toLocaleString("de-DE")
                          : item.date || "-")}
                    </div>
                    <div className="muted">Gewicht: {item.weight_kg ?? "-"} kg</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "latestMessages",
        content: (
          <div className="card" style={{ minWidth: 0 }}>
            <h2>Neueste Nachrichten</h2>

            {latestMessagesWithNames.length === 0 ? (
              <p className="muted">Noch keine Nachrichten vorhanden.</p>
            ) : (
              <div className="stack">
                {latestMessagesWithNames.map((msg) => (
                  <div
                    key={msg.id}
                    className="item"
                    style={{ cursor: msg.athlete_id ? "pointer" : "default", borderLeft: "4px solid #60a5fa" }}
                    onClick={() => {
                      if (msg.athlete_id) router.push(`/coach?athlete=${msg.athlete_id}`);
                    }}
                  >
                    {!msg.athlete_id ? (
                      <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 4 }}>
                        📢 Nachricht an alle
                      </div>
                    ) : null}
                    <strong>{msg.sender_role === "coach" ? "Coach" : msg.athlete_name}</strong>
                    <div>{msg.content}</div>
                    <div className="muted">
                      {msg.local_created_at ||
                        (msg.created_at
                          ? new Date(msg.created_at).toLocaleString("de-DE")
                          : "-")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
      },
    ],
    layout
  );

  return (
    <main className="page">
      <Header
        title="Coach Dashboard"
        subtitle={`Check-in-Woche: ${formatGermanDate(weekRange.monday)} bis ${formatGermanDate(weekRange.sunday)}`}
        actions={
          <>
            <Link href="/" className="btn btn-secondary">
              Startseite
            </Link>
            <button className="btn btn-secondary" onClick={logout}>
              Logout
            </button>
          </>
        }
      />

      {info ? <div style={noticeStyle(info)}>{info}</div> : null}

      <LayoutEditor
        isAdmin={me?.role === "admin"}
        editing={editingLayout}
        setEditing={setEditingLayout}
        layout={layout}
        setLayout={setLayout}
        onSave={saveLayout}
        labels={layoutLabels}
        saving={savingLayout}
      />

      <section className="grid three">
        <div className="card stat-card" style={{ borderLeft: "4px solid #60a5fa" }}>
          <div className="stat-label">Athleten gesamt</div>
          <div className="stat-value">{loading ? "..." : athletes.length}</div>
        </div>

        <div className="card stat-card" style={{ borderLeft: "4px solid #22c55e" }}>
          <div className="stat-label">Check-in gemacht</div>
          <div className="stat-value">
            {loading ? "..." : `${athletesDone.length} / ${athletes.length}`}
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: "4px solid #ef4444" }}>
          <div className="stat-label">Check-in fehlt</div>
          <div className="stat-value">
            {loading ? "..." : `${athletesMissing.length} / ${athletes.length}`}
          </div>
        </div>
      </section>

      <section className="grid two">
        {sections.map((section) => {
          const item = layout.find((x) => x.id === section.id);
          return (
            <div
              key={section.id}
              className={getLayoutItemWidthClass(item?.width || "half")}
            >
              {section.content}
            </div>
          );
        })}
      </section>
    </main>
  );
}
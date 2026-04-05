"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";
import LayoutEditor from "@/components/LayoutEditor";
import {
  defaultLayouts,
  getLayoutItemWidthClass,
  normalizeLayout,
  sortSectionsByLayout,
  type LayoutItem,
} from "@/lib/layout";

type Athlete = {
  id: string;
  full_name: string | null;
  goal: string | null;
  current_phase: string | null;
  coach_id: string | null;
  checkin_weekday: number | null;
  checkin_interval_days: number | null;
  role: string;
};

type Checkin = {
  id: string;
  athlete_id: string;
  date?: string | null;
  local_datetime?: string | null;
  created_at?: string | null;
  weight_kg?: number | null;
};

type Message = {
  id: string;
  athlete_id: string | null;
  sender_role: string | null;
  content: string | null;
  is_seen: boolean | null;
  created_at?: string | null;
  local_created_at?: string | null;
};

type Plan = {
  id: string;
  athlete_id: string;
  type?: string | null;
  created_at?: string | null;
  local_created_at?: string | null;
  file_name?: string | null;
  title?: string | null;
};

const layoutLabels: Record<string, string> = {
  kpis: "KPI Übersicht",
  priority: "Priorität",
  activity: "Neue Aktivitäten",
  athletes: "Athletenkarten",
};

function formatDateDE(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("de-DE");
}

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

function sectionStyle(color: string) {
  return { borderLeft: `4px solid ${color}` };
}

function getLatestByAthlete<T extends { athlete_id: string; created_at?: string | null; local_datetime?: string | null }>(
  items: T[]
) {
  const map = new Map<string, T>();

  for (const item of items) {
    const current = map.get(item.athlete_id);
    const currentTime = current
      ? new Date(current.local_datetime || current.created_at || 0).getTime()
      : 0;
    const nextTime = new Date(item.local_datetime || item.created_at || 0).getTime();

    if (!current || nextTime > currentTime) {
      map.set(item.athlete_id, item);
    }
  }

  return map;
}

function diffDays(from?: string | null) {
  if (!from) return 999;
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return 999;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getNextCheckinText(weekday?: number | null, intervalDays?: number | null) {
  const now = new Date();
  const today = now.getDay();
  let diff = (weekday ?? 0) - today;
  if (diff < 0) diff += 7;
  if (diff === 0) diff = 7;
  const days = Math.min(diff, intervalDays || 7);
  return `in ${days} Tagen`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [me, setMe] = useState<any>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [layout, setLayout] = useState<LayoutItem[]>(
    (defaultLayouts as any).dashboard || [
      { id: "kpis", width: "full", order: 0 },
      { id: "priority", width: "full", order: 1 },
      { id: "activity", width: "full", order: 2 },
      { id: "athletes", width: "full", order: 3 },
    ]
  );

  const [editingLayout, setEditingLayout] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
      await Promise.all([loadLayout(), loadDashboardData(profile)]);
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

    const fallback =
      (defaultLayouts as any).dashboard || [
        { id: "kpis", width: "full", order: 0 },
        { id: "priority", width: "full", order: 1 },
        { id: "activity", width: "full", order: 2 },
        { id: "athletes", width: "full", order: 3 },
      ];

    setLayout(normalizeLayout("dashboard", data?.layout || fallback));
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

  const loadDashboardData = async (viewer: any) => {
    let athleteQuery = supabase.from("profiles").select("*").eq("role", "athlete");

    if (viewer.role === "coach") {
      athleteQuery = athleteQuery.eq("coach_id", viewer.id);
    }

    const [
      { data: athleteData, error: athleteError },
      { data: coachData },
    ] = await Promise.all([
      athleteQuery.order("full_name", { ascending: true }),
      viewer.role === "admin"
        ? supabase
            .from("profiles")
            .select("id, full_name, role")
            .in("role", ["admin", "coach"])
            .order("full_name", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    if (athleteError) {
      setInfo("Fehler: " + athleteError.message);
      return;
    }

    const athleteList = (athleteData || []) as Athlete[];
    setAthletes(athleteList);
    setCoaches(coachData || []);

    const athleteIds = athleteList.map((a) => a.id);

    if (!athleteIds.length) {
      setCheckins([]);
      setMessages([]);
      setPlans([]);
      return;
    }

    const [
      { data: checkinData, error: checkinError },
      { data: messageData, error: messageError },
      { data: planData, error: planError },
    ] = await Promise.all([
      supabase
        .from("checkins")
        .select("*")
        .in("athlete_id", athleteIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("messages")
        .select("*")
        .or(`athlete_id.in.(${athleteIds.join(",")}),athlete_id.is.null`)
        .order("created_at", { ascending: false }),
      supabase
        .from("plans")
        .select("*")
        .in("athlete_id", athleteIds)
        .order("created_at", { ascending: false }),
    ]);

    if (checkinError || messageError || planError) {
      setInfo(
        "Fehler: " +
          (checkinError?.message ||
            messageError?.message ||
            planError?.message ||
            "Fehler beim Laden")
      );
      return;
    }

    setCheckins((checkinData || []) as Checkin[]);
    setMessages((messageData || []) as Message[]);
    setPlans((planData || []) as Plan[]);
  };

  const latestCheckinByAthlete = useMemo(() => getLatestByAthlete(checkins), [checkins]);
  const latestPlanByAthlete = useMemo(() => getLatestByAthlete(plans as any), [plans]);

  const athleteCards = useMemo(() => {
    const today = new Date().getDay();

    return athletes
      .filter((athlete) => {
        if (!search.trim()) return true;
        return (athlete.full_name || "").toLowerCase().includes(search.toLowerCase());
      })
      .map((athlete) => {
        const lastCheckin = latestCheckinByAthlete.get(athlete.id);
        const lastPlan = latestPlanByAthlete.get(athlete.id) as Plan | undefined;
        const unreadCount = messages.filter(
          (m) => m.athlete_id === athlete.id && m.sender_role === "athlete" && !m.is_seen
        ).length;

        const lastCheckinDate =
          lastCheckin?.local_datetime || lastCheckin?.created_at || lastCheckin?.date || null;

        const interval = athlete.checkin_interval_days || 7;
        const overdueDays = diffDays(lastCheckinDate);
        const isOverdue = overdueDays > interval;
        const isDueToday = Number(athlete.checkin_weekday ?? 0) === today;

        return {
          athlete,
          lastCheckin,
          lastPlan,
          unreadCount,
          lastCheckinDate,
          isOverdue,
          isDueToday,
          overdueDays,
        };
      })
      .sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (a.isDueToday && !b.isDueToday) return -1;
        if (!a.isDueToday && b.isDueToday) return 1;
        return (a.athlete.full_name || "").localeCompare(b.athlete.full_name || "");
      });
  }, [athletes, latestCheckinByAthlete, latestPlanByAthlete, messages, search]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const activeAthletes = athletes.length;

    const newCheckinsToday = checkins.filter((c) => {
      const d = c.date || c.local_datetime || c.created_at || "";
      return String(d).slice(0, 10) === todayIso;
    }).length;

    const unreadMessages = messages.filter((m) => !m.is_seen).length;

    const overdueAthletes = athleteCards.filter((a) => a.isOverdue).length;

    const plansThisWeek = plans.filter((p) => {
      const d = new Date(p.created_at || 0);
      const now = new Date();
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }).length;

    return {
      activeAthletes,
      newCheckinsToday,
      unreadMessages,
      overdueAthletes,
      plansThisWeek,
      coachesTotal: coaches.length || (me?.role === "admin" ? 1 : 0),
    };
  }, [athletes, athleteCards, checkins, coaches.length, me?.role, messages, plans, todayIso]);

  const overdueList = athleteCards.filter((a) => a.isOverdue).slice(0, 6);
  const dueTodayList = athleteCards.filter((a) => a.isDueToday).slice(0, 6);

  const recentCheckins = checkins.slice(0, 6).map((checkin) => {
    const athlete = athletes.find((a) => a.id === checkin.athlete_id);
    return { checkin, athlete };
  });

  const recentMessages = messages
    .filter((m) => m.athlete_id)
    .slice(0, 6)
    .map((message) => {
      const athlete = athletes.find((a) => a.id === message.athlete_id);
      return { message, athlete };
    });

  const openAthlete = (athleteId: string) => {
    router.push(`/coach?athlete=${athleteId}`);
  };

  const sections = sortSectionsByLayout(
    [
      {
        id: "kpis",
        content: (
          <div
            className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "kpis")?.width || "full")}`}
            style={{ ...sectionStyle("#22c55e"), minWidth: 0 }}
          >
            <h2>Übersicht</h2>

            <div className="grid three" style={{ gap: 12 }}>
              <div className="card stat-card" style={{ borderLeft: "4px solid #60a5fa" }}>
                <div className="stat-label">Athleten gesamt</div>
                <div className="stat-value">{kpis.activeAthletes}</div>
              </div>

              <div className="card stat-card" style={{ borderLeft: "4px solid #22c55e" }}>
                <div className="stat-label">Neue Check-ins heute</div>
                <div className="stat-value">{kpis.newCheckinsToday}</div>
              </div>

              <div className="card stat-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                <div className="stat-label">Ungelesene Nachrichten</div>
                <div className="stat-value">{kpis.unreadMessages}</div>
              </div>

              <div className="card stat-card" style={{ borderLeft: "4px solid #ef4444" }}>
                <div className="stat-label">Überfällige Check-ins</div>
                <div className="stat-value">{kpis.overdueAthletes}</div>
              </div>

              <div className="card stat-card" style={{ borderLeft: "4px solid #a78bfa" }}>
                <div className="stat-label">Pläne diese Woche</div>
                <div className="stat-value">{kpis.plansThisWeek}</div>
              </div>

              {me?.role === "admin" ? (
                <div className="card stat-card" style={{ borderLeft: "4px solid #ec4899" }}>
                  <div className="stat-label">Coaches gesamt</div>
                  <div className="stat-value">{kpis.coachesTotal}</div>
                </div>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: "priority",
        content: (
          <div
            className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "priority")?.width || "full")}`}
            style={{ ...sectionStyle("#ef4444"), minWidth: 0 }}
          >
            <h2>Priorität</h2>

            <div className="grid two" style={{ gap: 12 }}>
              <div className="item">
                <strong>Überfällige Athleten</strong>
                {overdueList.length === 0 ? (
                  <p className="muted">Keine überfälligen Athleten.</p>
                ) : (
                  <div className="stack" style={{ marginTop: 10 }}>
                    {overdueList.map(({ athlete, overdueDays }) => (
                      <div key={athlete.id} className="item">
                        <strong>{athlete.full_name || "-"}</strong>
                        <div className="muted">
                          Überfällig seit ca. {Math.max(0, overdueDays - (athlete.checkin_interval_days || 7))} Tagen
                        </div>
                        <div className="button-row" style={{ marginTop: 8 }}>
                          <button className="btn btn-secondary" onClick={() => openAthlete(athlete.id)}>
                            Öffnen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="item">
                <strong>Heute fällige Check-ins</strong>
                {dueTodayList.length === 0 ? (
                  <p className="muted">Heute keine fälligen Check-ins.</p>
                ) : (
                  <div className="stack" style={{ marginTop: 10 }}>
                    {dueTodayList.map(({ athlete }) => (
                      <div key={athlete.id} className="item">
                        <strong>{athlete.full_name || "-"}</strong>
                        <div className="muted">
                          Intervall: alle {athlete.checkin_interval_days || 7} Tage
                        </div>
                        <div className="button-row" style={{ marginTop: 8 }}>
                          <button className="btn btn-secondary" onClick={() => openAthlete(athlete.id)}>
                            Öffnen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "activity",
        content: (
          <div
            className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "activity")?.width || "full")}`}
            style={{ ...sectionStyle("#60a5fa"), minWidth: 0 }}
          >
            <h2>Neue Aktivitäten</h2>

            <div className="grid two" style={{ gap: 12 }}>
              <div className="item">
                <strong>Neueste Check-ins</strong>
                {recentCheckins.length === 0 ? (
                  <p className="muted">Keine Check-ins vorhanden.</p>
                ) : (
                  <div className="stack" style={{ marginTop: 10 }}>
                    {recentCheckins.map(({ checkin, athlete }) => (
                      <div key={checkin.id} className="item">
                        <strong>{athlete?.full_name || "-"}</strong>
                        <div className="muted">
                          {formatDateTimeDE(checkin.local_datetime || checkin.created_at || checkin.date)}
                        </div>
                        <div className="muted">Gewicht: {checkin.weight_kg ?? "-"} kg</div>
                        <div className="button-row" style={{ marginTop: 8 }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => athlete && openAthlete(athlete.id)}
                          >
                            Öffnen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="item">
                <strong>Neueste Nachrichten</strong>
                {recentMessages.length === 0 ? (
                  <p className="muted">Keine Nachrichten vorhanden.</p>
                ) : (
                  <div className="stack" style={{ marginTop: 10 }}>
                    {recentMessages.map(({ message, athlete }) => (
                      <div key={message.id} className="item">
                        <strong>{athlete?.full_name || "-"}</strong>
                        <div className="muted">
                          {message.sender_role === "coach" ? "Coach" : "Athlet"}
                        </div>
                        <div className="muted">
                          {message.local_created_at || formatDateTimeDE(message.created_at)}
                        </div>
                        <div>{message.content || "-"}</div>
                        <div className="button-row" style={{ marginTop: 8 }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => athlete && openAthlete(athlete.id)}
                          >
                            Öffnen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "athletes",
        content: (
          <div
            className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "athletes")?.width || "full")}`}
            style={{ ...sectionStyle("#a78bfa"), minWidth: 0 }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <h2>Athleten</h2>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Athlet suchen..."
                style={{ maxWidth: 280 }}
              />
            </div>

            {athleteCards.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>
                Keine Athleten gefunden.
              </p>
            ) : (
              <div className="grid two" style={{ gap: 12, marginTop: 12 }}>
                {athleteCards.map(
                  ({
                    athlete,
                    lastCheckin,
                    lastPlan,
                    unreadCount,
                    isOverdue,
                    isDueToday,
                  }) => {
                    const borderColor = isOverdue
                      ? "#ef4444"
                      : isDueToday
                        ? "#f59e0b"
                        : "#22c55e";

                    return (
                      <div
                        key={athlete.id}
                        className="card"
                        style={{
                          borderLeft: `4px solid ${borderColor}`,
                          minWidth: 0,
                        }}
                      >
                        <strong>{athlete.full_name || "-"}</strong>

                        <div className="muted">Ziel: {athlete.goal || "-"}</div>
                        <div className="muted">Phase: {athlete.current_phase || "-"}</div>
                        <div className="muted">
                          Letzter Check-in:{" "}
                          {lastCheckin
                            ? formatDateDE(lastCheckin.local_datetime || lastCheckin.created_at || lastCheckin.date)
                            : "-"}
                        </div>
                        <div className="muted">
                          Nächster Check-in:{" "}
                          {getNextCheckinText(
                            athlete.checkin_weekday,
                            athlete.checkin_interval_days
                          )}
                        </div>
                        <div className="muted">
                          Ungelesene Athleten-Nachrichten: {unreadCount}
                        </div>
                        <div className="muted">
                          Letzter Plan:{" "}
                          {lastPlan
                            ? formatDateDE(lastPlan.created_at || lastPlan.local_created_at)
                            : "-"}
                        </div>

                        <div className="button-row" style={{ marginTop: 10 }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => openAthlete(athlete.id)}
                          >
                            Öffnen
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => openAthlete(athlete.id)}
                          >
                            Nachricht
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => openAthlete(athlete.id)}
                          >
                            Plan
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        ),
      },
    ],
    layout
  );

  return (
  <AppShell role={me?.role === "athlete" ? "athlete" : me?.role === "admin" ? "admin" : "coach"}>
    <main className="page">
      <Header
        title={me?.role === "admin" ? "Premium Dashboard – Coach 1" : "Premium Dashboard – Coach 2"}
        subtitle={
          me?.role === "admin"
            ? "Gesamtüberblick über Coaches, Athleten, Check-ins und Nachrichten."
            : "Übersicht über deine Athleten, offene Punkte und neue Aktivitäten."
        }
        actions={
          <button className="btn btn-secondary" onClick={() => supabase.auth.signOut().then(() => router.replace("/login"))}>
            Logout
          </button>
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

      {loading ? (
  <section className="card">
    <p className="muted">Lade Dashboard...</p>
  </section>
) : (
  <>
    {/* MOBILE */}
    <div className="mobile-stat-strip">
      <div className="mobile-stat-box" style={{ borderLeft: "4px solid #60a5fa" }}>
        <div className="mobile-stat-label">Athleten</div>
        <div className="mobile-stat-value">{athletes.length}</div>
      </div>

      <div className="mobile-stat-box" style={{ borderLeft: "4px solid #22c55e" }}>
        <div className="mobile-stat-label">Check-ins</div>
        <div className="mobile-stat-value">{checkins.length}</div>
      </div>

      <div className="mobile-stat-box" style={{ borderLeft: "4px solid #f59e0b" }}>
        <div className="mobile-stat-label">Nachrichten</div>
        <div className="mobile-stat-value">{messages.length}</div>
      </div>

      <div className="mobile-stat-box" style={{ borderLeft: "4px solid #ec4899" }}>
        <div className="mobile-stat-label">Coaches</div>
        <div className="mobile-stat-value">{coaches.length}</div>
      </div>
    </div>

    <div className="mobile-home-grid">
      <Link href="/coach" className="mobile-home-card">
        <div className="mobile-home-card-title">Athleten</div>
      </Link>

      <Link href="/coach/messages" className="mobile-home-card">
        <div className="mobile-home-card-title">Nachrichten</div>
      </Link>

      <Link href="/coach/checkins" className="mobile-home-card">
        <div className="mobile-home-card-title">Check-ins</div>
      </Link>

      <Link href="/coach/more" className="mobile-home-card">
        <div className="mobile-home-card-title">Mehr</div>
      </Link>
    </div>

    {/* DESKTOP */}
    <div className="desktop-only">
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
    </div>
  </>
)}
            </main>
  </AppShell>
  );
}
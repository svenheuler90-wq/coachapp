"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
import PushEnableButton from "@/components/PushEnableButton";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import LayoutEditor from "@/components/LayoutEditor";
import {
  defaultLayouts,
  getLayoutItemWidthClass,
  normalizeLayout,
  sortSectionsByLayout,
  type LayoutItem,
} from "@/lib/layout";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const DIGESTION_OPTIONS = ["Sehr gut", "Gut", "Normal", "Träge", "Probleme"];

const layoutLabels: Record<string, string> = {
  plans: "Deine Pläne",
  newCheckin: "Neuer Check-in",
  messages: "Nachrichten",
  weightChart: "Gewichtsverlauf",
  myCheckins: "Deine Check-ins",
};

function parseGermanNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function daysUntilNextCheckin(weekday: number, intervalDays: number) {
  const now = new Date();
  const today = now.getDay();
  let diff = weekday - today;
  if (diff < 0) diff += 7;
  if (diff === 0) diff = 7;
  return Math.min(diff, intervalDays || 7);
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

function splitRecentAndOlder<T>(items: T[]) {
  return {
    recent: items.slice(0, 2),
    older: items.slice(2),
  };
}

function renderPhotoGallery(photosForCheckin: any[]) {
  if (!photosForCheckin || photosForCheckin.length === 0) return null;

  const visiblePhotos = photosForCheckin.slice(0, 2);
  const hiddenPhotos = photosForCheckin.slice(2);

  return (
    <>
      <div className="image-grid" style={{ marginTop: 10 }}>
        {visiblePhotos.map((photo) => (
          <a key={photo.id} href={photo.image_url} target="_blank" rel="noreferrer">
            <img
              src={encodeURI(photo.image_url)}
              alt="Check-in Bild"
              className="preview-image"
              style={{
                width: 110,
                height: 110,
                objectFit: "cover",
                borderRadius: 10,
              }}
            />
          </a>
        ))}
      </div>

      {hiddenPhotos.length > 0 ? (
        <details style={{ marginTop: 10 }}>
          <summary>Weitere Bilder anzeigen ({hiddenPhotos.length})</summary>
          <div className="image-grid" style={{ marginTop: 10 }}>
            {hiddenPhotos.map((photo) => (
              <a key={photo.id} href={photo.image_url} target="_blank" rel="noreferrer">
                <img
                  src={encodeURI(photo.image_url)}
                  alt="Check-in Bild"
                  className="preview-image"
                  style={{
                    width: 110,
                    height: 110,
                    objectFit: "cover",
                    borderRadius: 10,
                  }}
                />
              </a>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

export default function AthletePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);

  const [layout, setLayout] = useState<LayoutItem[]>(defaultLayouts.athlete);
  const [editingLayout, setEditingLayout] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  const nowLocal = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }, []);

  const [checkinDateTime, setCheckinDateTime] = useState(nowLocal);
  const [weight, setWeight] = useState("");
  const [bloodPressureSys, setBloodPressureSys] = useState("");
  const [bloodPressureDia, setBloodPressureDia] = useState("");
  const [pulse, setPulse] = useState("");
  const [sugar, setSugar] = useState("");
  const [hunger, setHunger] = useState("");
  const [hungerScale, setHungerScale] = useState("");
  const [motivation, setMotivation] = useState("");
  const [wellBeing, setWellBeing] = useState("");
  const [sleepQuality, setSleepQuality] = useState("");
  const [stoolQuality, setStoolQuality] = useState("");
  const [stoolTimes, setStoolTimes] = useState("");
  const [stoolEveryDays, setStoolEveryDays] = useState("");
  const [digestion, setDigestion] = useState("");
  const [comment, setComment] = useState("");
  const [checkinFiles, setCheckinFiles] = useState<FileList | null>(null);

  const [messageText, setMessageText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState("");

  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingCheckin, setSavingCheckin] = useState(false);

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
      await Promise.all([loadAthleteData(me.id), loadLayout()]);
      setLoading(false);
    };

    init();
  }, [router]);

  const loadLayout = async () => {
    const { data } = await supabase
      .from("app_layouts")
      .select("layout")
      .eq("page_key", "athlete")
      .maybeSingle();

    setLayout(normalizeLayout("athlete", data?.layout));
  };

  const saveLayout = async () => {
    setSavingLayout(true);
    setInfo("");

    const normalized = normalizeLayout("athlete", layout);

    const { error } = await supabase
      .from("app_layouts")
      .upsert(
        {
          page_key: "athlete",
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

  const loadAthleteData = async (athleteId: string) => {
    const [
      { data: plansData, error: plansError },
      { data: messagesData, error: messagesError },
      { data: checkinsData, error: checkinsError },
      { data: photosData, error: photosError },
      { data: freshProfile },
    ] = await Promise.all([
      supabase.from("plans").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").or(`athlete_id.eq.${athleteId},athlete_id.is.null`).order("created_at", { ascending: false }),
      supabase.from("checkins").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false }),
      supabase.from("progress_photos").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", athleteId).single(),
    ]);

    if (plansError || messagesError || checkinsError || photosError) {
      setInfo(
        "Fehler: " +
          (plansError?.message ||
            messagesError?.message ||
            checkinsError?.message ||
            photosError?.message ||
            "Fehler beim Laden.")
      );
      return;
    }

    if (freshProfile) setProfile(freshProfile);

    setPlans(plansData || []);
    setMessages(messagesData || []);
    setCheckins(checkinsData || []);
    setPhotos(photosData || []);
  };

  const saveCheckin = async () => {
    if (!profile) return;

    setSavingCheckin(true);
    setInfo("");

    try {
      const parsedWeight = parseGermanNumber(weight);

      if (parsedWeight === null) {
        setInfo("Fehler: Bitte gültiges Gewicht eingeben.");
        return;
      }

      if (
        (bloodPressureSys && isNaN(Number(bloodPressureSys))) ||
        (bloodPressureDia && isNaN(Number(bloodPressureDia)))
      ) {
        setInfo("Fehler: Blutdruck muss numerisch sein.");
        return;
      }

      if (
  hunger === "true" &&
  (!hungerScale || Number(hungerScale) < 1 || Number(hungerScale) > 10)
) {
  setInfo("Fehler: Hunger-Skala muss zwischen 1 und 10 liegen.");
  return;
}

if (
  hungerScale &&
  (Number(hungerScale) < 1 || Number(hungerScale) > 10)
) {
  setInfo("Fehler: Hunger-Skala muss zwischen 1 und 10 liegen.");
  return;
}
      const checkinPayload: any = {
  athlete_id: profile.id,
  date: checkinDateTime ? checkinDateTime.slice(0, 10) : null,
  created_at: new Date().toISOString(),
  local_datetime: checkinDateTime || null,
  weight_kg: parsedWeight,
};

if (bloodPressureSys) checkinPayload.blood_pressure_sys = Number(bloodPressureSys);
if (bloodPressureDia) checkinPayload.blood_pressure_dia = Number(bloodPressureDia);

if (bloodPressureSys && bloodPressureDia) {
  checkinPayload.blood_pressure = `${bloodPressureSys}/${bloodPressureDia}`;
}

if (pulse) checkinPayload.pulse_bpm = Number(pulse);
if (sugar) checkinPayload.blood_sugar = Number(sugar);

if (hunger === "true" || hunger === "false") {
  checkinPayload.hunger = hunger === "true";
}

if (hungerScale) checkinPayload.hunger_scale = Number(hungerScale);
if (motivation) checkinPayload.motivation = motivation;
if (wellBeing) checkinPayload.well_being = wellBeing;
if (sleepQuality) checkinPayload.sleep_quality = sleepQuality;
if (stoolQuality) checkinPayload.stool_quality = stoolQuality;
if (stoolTimes) checkinPayload.stool_times = Number(stoolTimes);
if (stoolEveryDays) checkinPayload.stool_every_days = Number(stoolEveryDays);
if (digestion) checkinPayload.digestion = digestion;
if (comment) checkinPayload.additional_comment = comment;

      const { data: insertedCheckin, error: checkinError } = await supabase
        .from("checkins")
        .insert(checkinPayload)
        .select()
        .single();

      if (checkinError) {
        setInfo("Fehler: " + checkinError.message);
        return;
      }

      if (checkinFiles && checkinFiles.length > 0) {
        for (const file of Array.from(checkinFiles)) {
          const originalName = file.name || "bild";
          const ext =
            originalName.includes(".") ? originalName.split(".").pop()?.toLowerCase() : "";

          const safeExt =
            ext && ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";

          const fileName = `${profile.id}-checkin-${insertedCheckin.id}-${Date.now()}.${safeExt}`;

          const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(fileName, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || "application/octet-stream",
            });

          if (uploadError) {
            setInfo("Fehler: Bild Upload Fehler: " + uploadError.message);
            return;
          }

          const { data: publicUrlData } = supabase.storage
            .from("documents")
            .getPublicUrl(fileName);

          const { error: photoInsertError } = await supabase.from("progress_photos").insert({
            athlete_id: profile.id,
            checkin_id: insertedCheckin.id,
            image_url: publicUrlData.publicUrl,
            note: comment || null,
          });

          if (photoInsertError) {
            setInfo("Fehler: Foto Speichern Fehler: " + photoInsertError.message);
            return;
          }
        }
      }

await fetch("/api/push/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: "checkin_created",
    athleteId: profile.id,
    senderUserId: profile.id,
    title: "Neuer Check-in eingegangen",
    message: `Ein neuer Check-in wurde von ${profile.full_name || "einem Athleten"} eingereicht.`,
    url: `/coach?athlete=${profile.id}`,
  }),
});
      setInfo("Check-in gespeichert.");
      const d = new Date();
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60000);
      setCheckinDateTime(local.toISOString().slice(0, 16));
      setWeight("");
      setBloodPressureSys("");
      setBloodPressureDia("");
      setPulse("");
      setSugar("");
      setHunger("");
      setHungerScale("");
      setStoolTimes("");
      setStoolEveryDays("");
      setDigestion("");
      setComment("");
      setCheckinFiles(null);

      await loadAthleteData(profile.id);
    } finally {
      setSavingCheckin(false);
    }
  };

  const sendMessage = async () => {
    if (!profile) return;

    setInfo("");

    if (!messageText.trim()) {
      setInfo("Fehler: Bitte zuerst eine Nachricht eingeben.");
      return;
    }

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
    await loadAthleteData(profile.id);
  };

  const startEditMessage = (message: any) => {
    setEditingMessageId(message.id);
    setEditMessageText(message.content || "");
  };

  const saveMessageEdit = async () => {
    if (!editingMessageId || !profile) return;

    if (!editMessageText.trim()) {
      setInfo("Fehler: Nachricht darf nicht leer sein.");
      return;
    }

    const { error } = await supabase
      .from("messages")
      .update({
        content: editMessageText.trim(),
      })
      .eq("id", editingMessageId);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setEditingMessageId(null);
    setEditMessageText("");
    setInfo("Nachricht bearbeitet.");
    await loadAthleteData(profile.id);
  };

  const deleteMessage = async (messageId: string) => {
    if (!profile) return;

    const confirmed = window.confirm("Diese Nachricht wirklich löschen?");
    if (!confirmed) return;

    const { error } = await supabase.from("messages").delete().eq("id", messageId);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setInfo("Nachricht gelöscht.");
    await loadAthleteData(profile.id);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const weightChartData = [...checkins]
    .filter((c) => c.weight_kg != null)
    .reverse()
    .map((c) => ({
      date: c.local_datetime ? String(c.local_datetime).slice(0, 10) : c.date || "",
      weight: c.weight_kg,
    }));

  const { recent: recentCheckins, older: olderCheckins } = splitRecentAndOlder(checkins);
  const { recent: recentPlans, older: olderPlans } = splitRecentAndOlder(plans);

  const sections = sortSectionsByLayout(
    [
      {
        id: "plans",
        content: (
          <div
            className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "plans")?.width || "half")}`}
            style={{ borderLeft: "4px solid #22c55e", minWidth: 0 }}
          >
            <h2>Deine Pläne</h2>

            {plans.length === 0 ? (
              <p className="muted">Keine Pläne vorhanden.</p>
            ) : (
              <>
                <div className="stack">
		{recentPlans.map((plan) => (
  <div key={plan.id} className="item">
    <strong>{plan.file_name || plan.title || "Plan"}</strong>
    <div className="muted">Typ: {plan.type || "-"}</div>
    <div className="muted">
      Hochgeladen:{" "}
      {plan.local_created_at ||
        (plan.created_at
          ? new Date(plan.created_at).toLocaleString("de-DE")
          : "-")}
    </div>
    <div className="muted">
      Gültig ab: {plan.valid_from ? new Date(plan.valid_from).toLocaleDateString("de-DE") : "-"}
    </div>

    {plan.file_url ? (
      <a href={plan.file_url} target="_blank" rel="noreferrer">
        Datei öffnen
      </a>
    ) : (
      <div>{plan.content || "Kein Inhalt"}</div>
    )}

    {plan.note ? <div className="muted">Bemerkung: {plan.note}</div> : null}
  </div>
))}
                                  </div>

                {olderPlans.length > 0 ? (
                  <details style={{ marginTop: 12 }}>
                    <summary>Ältere Pläne anzeigen ({olderPlans.length})</summary>
                    <div className="stack" style={{ marginTop: 12 }}>
                      {olderPlans.map((plan) => (
                        <div key={plan.id} className="item">
                          <strong>{plan.file_name || plan.title || "Plan"}</strong>
                          <div className="muted">Typ: {plan.type || "-"}</div>
                          <div className="muted">
                            Hochgeladen:{" "}
		            Gültig ab: {plan.valid_from ? new Date(plan.valid_from).toLocaleDateString("de-DE") : "-"}
                            {plan.local_created_at ||
                              (plan.created_at
                                ? new Date(plan.created_at).toLocaleString("de-DE")
                                : "-")}
                          </div>

                          {plan.file_url ? (
                            <a href={plan.file_url} target="_blank" rel="noreferrer">
                              Datei öffnen
                            </a>
                          ) : (
                            <div>{plan.content || "Kein Inhalt"}</div>
                          )}

                          {plan.note ? <div className="muted">Bemerkung: {plan.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </>
            )}
          </div>
        ),
      },
      {
        id: "newCheckin",
        content: (
          <div
            className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "newCheckin")?.width || "half")}`}
            style={{ borderLeft: "4px solid #f59e0b", minWidth: 0 }}
          >
            <h2>Neuer Check-in</h2>

            <label>Datum & Uhrzeit</label>
            <input
              type="datetime-local"
              value={checkinDateTime}
              onChange={(e) => setCheckinDateTime(e.target.value)}
            />

            <label>Gewicht (kg)</label>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Gewicht" />

            <label>Blutdruck (SYS / DIA mmHg)</label>
            <div className="grid two">
              <input value={bloodPressureSys} onChange={(e) => setBloodPressureSys(e.target.value)} placeholder="SYS" />
              <input value={bloodPressureDia} onChange={(e) => setBloodPressureDia(e.target.value)} placeholder="DIA" />
            </div>

            <label>Puls (bpm)</label>
            <input value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="Puls" />

            <label>Blutzucker (mg/dL)</label>
            <input value={sugar} onChange={(e) => setSugar(e.target.value)} placeholder="Blutzucker" />

            <label>Hunger</label>
            <select value={hunger} onChange={(e) => setHunger(e.target.value)}>
	      <option value="">Bitte wählen</option>
              <option value="false">Nein</option>
              <option value="true">Ja</option>
            </select>

            <label>Hunger-Skala (1-10)</label>
            <select
              value={hungerScale}
              onChange={(e) => setHungerScale(e.target.value)}
              disabled={hunger !== "true"}
            >
	     <option value="">Bitte wählen</option>		

              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <label>Motivation</label>
            <select value={motivation} onChange={(e) => setMotivation(e.target.value)}>
              <option value="">Bitte wählen</option>
              <option value="sehr_niedrig">Sehr niedrig</option>
              <option value="niedrig">Niedrig</option>
              <option value="mittel">Mittel</option>
              <option value="hoch">Hoch</option>
              <option value="sehr_hoch">Sehr hoch</option>
            </select>

            <label>Wohlbefinden</label>
            <select value={wellBeing} onChange={(e) => setWellBeing(e.target.value)}>
              <option value="">Bitte wählen</option>
              <option value="sehr_schlecht">Sehr schlecht</option>
              <option value="schlecht">Schlecht</option>
              <option value="mittel">Mittel</option>
              <option value="gut">Gut</option>
              <option value="sehr_gut">Sehr gut</option>
            </select>

            <label>Schlaf</label>
            <select value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value)}>
              <option value="">Bitte wählen</option>
              <option value="sehr_schlecht">Sehr schlecht</option>
              <option value="schlecht">Schlecht</option>
              <option value="mittel">Mittel</option>
              <option value="gut">Gut</option>
              <option value="sehr_gut">Sehr gut</option>
            </select>

            <label>Stuhlgang</label>
            <select value={stoolQuality} onChange={(e) => setStoolQuality(e.target.value)}>
	      <option value="">Bitte wählen</option>
              <option value="verstopfung">Verstopfung</option>
              <option value="hart">Hart</option>
              <option value="normal">Normal</option>
              <option value="weich">Weich</option>
              <option value="durchfall">Durchfall</option>
            </select>

            <label>Wie oft</label>
            <input value={stoolTimes} onChange={(e) => setStoolTimes(e.target.value)} />

            <label>Alle wie viele Tage</label>
            <input value={stoolEveryDays} onChange={(e) => setStoolEveryDays(e.target.value)} />

            <label>Verdauung</label>
            <select value={digestion} onChange={(e) => setDigestion(e.target.value)}>
	      <option value="">Bitte wählen</option>
              {DIGESTION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <label>Kommentar</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Kommentar" />

            <label>Bilder direkt zum Check-in</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setCheckinFiles(e.target.files)}
            />

            <div className="button-row">
              <button className="btn btn-primary" onClick={saveCheckin} disabled={savingCheckin}>
                {savingCheckin ? "Speichere..." : "Check-in speichern"}
              </button>
            </div>
          </div>
        ),
      },
      {
        id: "messages",
        content: (
          <div
            className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "messages")?.width || "full")}`}
            style={{ borderLeft: "4px solid #60a5fa", minWidth: 0 }}
          >
            <h2>Nachrichten</h2>

            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Antwort an deinen Coach..."
            />

            <div className="button-row">
              <button className="btn btn-primary" onClick={sendMessage}>
                Senden
              </button>
            </div>

            <h3>Nachrichtenverlauf</h3>

            {messages.length === 0 ? (
              <p className="muted">Keine Nachrichten vorhanden.</p>
            ) : (
              <div className="stack">
                {messages.map((msg) => {
                  const canEditOrDelete =
                    msg.sender_role === "athlete" && msg.athlete_id === profile?.id;

                  return (
                    <div
                      key={msg.id}
                      className="item"
                      style={{
                        borderLeft:
                          msg.sender_role === "coach"
                            ? "4px solid #60a5fa"
                            : "4px solid #22c55e",
                      }}
                    >
                      {editingMessageId === msg.id ? (
                        <>
                          <textarea
                            value={editMessageText}
                            onChange={(e) => setEditMessageText(e.target.value)}
                          />
                          <div className="button-row">
                            <button className="btn btn-primary" onClick={saveMessageEdit}>
                              Speichern
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditMessageText("");
                              }}
                            >
                              Abbrechen
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {!msg.athlete_id ? (
                            <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 4 }}>
                              📢 Nachricht an alle
                            </div>
                          ) : null}
                          <strong>{msg.sender_role === "coach" ? "Coach" : "Du"}</strong>
                          <div>{msg.content}</div>
                          <div className="muted">
                            {msg.local_created_at ||
                              (msg.created_at
                                ? new Date(msg.created_at).toLocaleString("de-DE")
                                : "-")}
                          </div>

                          {canEditOrDelete ? (
                            <div className="button-row" style={{ marginTop: 10 }}>
                              <button className="btn btn-secondary" onClick={() => startEditMessage(msg)}>
                                Bearbeiten
                              </button>
                              <button className="btn btn-secondary" onClick={() => deleteMessage(msg.id)}>
                                Löschen
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "weightChart",
        content: (
          <div
            className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "weightChart")?.width || "half")}`}
            style={{ borderLeft: "4px solid #a78bfa", minWidth: 0 }}
          >
            <h2>Gewichtsverlauf</h2>
            {weightChartData.length === 0 ? (
              <p className="muted">Noch keine Gewichts-Daten vorhanden.</p>
            ) : (
              <div style={{ width: "100%", minWidth: 0, height: 280, minHeight: 280 }}>
                <ResponsiveContainer width="99%" height={280}>
                  <LineChart data={weightChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "myCheckins",
        content: (
          <div
            className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "myCheckins")?.width || "half")}`}
            style={{ borderLeft: "4px solid #ec4899", minWidth: 0 }}
          >
            <h2>Deine Check-ins</h2>

            {checkins.length === 0 ? (
              <p className="muted">Noch keine Check-ins vorhanden.</p>
            ) : (
              <>
                <div className="stack">
                  {recentCheckins.map((checkin) => {
                    const linkedPhotos = photos.filter((photo) => photo.checkin_id === checkin.id);

                    return (
                      <div key={checkin.id} className="item">
                        <strong>
                          {checkin.local_datetime ||
                            (checkin.created_at
                              ? new Date(checkin.created_at).toLocaleString("de-DE")
                              : checkin.date || "-")}
                        </strong>

                        {checkin.weight_kg != null ? (
  <div className="muted">Gewicht: {checkin.weight_kg} kg</div>
) : null}

{checkin.blood_pressure_sys || checkin.blood_pressure_dia || checkin.blood_pressure ? (
  <div className="muted">
    Blutdruck:{" "}
    {checkin.blood_pressure_sys && checkin.blood_pressure_dia
      ? `${checkin.blood_pressure_sys}/${checkin.blood_pressure_dia} mmHg`
      : checkin.blood_pressure}
  </div>
) : null}

{checkin.pulse_bpm != null ? <div className="muted">Puls: {checkin.pulse_bpm} bpm</div> : null}
{checkin.blood_sugar != null ? <div className="muted">Blutzucker: {checkin.blood_sugar} mg/dL</div> : null}
{typeof checkin.hunger === "boolean" ? (
  <div className="muted">Hunger: {checkin.hunger ? "Ja" : "Nein"}</div>
) : null}
{checkin.hunger_scale != null ? <div className="muted">Hunger-Skala: {checkin.hunger_scale}</div> : null}
{checkin.stool_quality ? <div className="muted">Stuhlgang: {checkin.stool_quality}</div> : null}
{checkin.stool_times != null ? <div className="muted">Wie oft: {checkin.stool_times}</div> : null}
{checkin.stool_every_days != null ? <div className="muted">Alle wie viele Tage: {checkin.stool_every_days}</div> : null}
{checkin.digestion ? <div className="muted">Verdauung: {checkin.digestion}</div> : null}
{checkin.additional_comment ? <div className="muted">Kommentar: {checkin.additional_comment}</div> : null}

                        {renderPhotoGallery(linkedPhotos)}
                      </div>
                    );
                  })}
                </div>

                {olderCheckins.length > 0 ? (
                  <details style={{ marginTop: 12 }}>
                    <summary>Ältere Check-ins anzeigen ({olderCheckins.length})</summary>
                    <div className="stack" style={{ marginTop: 12 }}>
                      {olderCheckins.map((checkin) => {
                        const linkedPhotos = photos.filter((photo) => photo.checkin_id === checkin.id);

                        return (
                          <div key={checkin.id} className="item">
                            <strong>
                              {checkin.local_datetime ||
                                (checkin.created_at
                                  ? new Date(checkin.created_at).toLocaleString("de-DE")
                                  : checkin.date || "-")}
                            </strong>

                            {checkin.weight_kg != null ? (
  <div className="muted">Gewicht: {checkin.weight_kg} kg</div>
) : null}
{checkin.stool_times != null ? (
  <div className="muted">Wie oft: {checkin.stool_times}</div>
) : null}
{checkin.stool_every_days != null ? (
  <div className="muted">Alle wie viele Tage: {checkin.stool_every_days}</div>
) : null}

                            {renderPhotoGallery(linkedPhotos)}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
              </>
            )}
          </div>
        ),
      },
    ],
    layout
  );

  return (
  <AppShell role="athlete">
    <main className="page">
      <Header
  title="Dashboard"
  subtitle={
    profile
      ? `${profile.full_name || "-"} | Noch ${daysUntilNextCheckin(
          Number(profile.checkin_weekday ?? 0),
          Number(profile.checkin_interval_days ?? 7)
        )} Tage bis zum nächsten Check-in | Intervall: alle ${profile.checkin_interval_days ?? 7} Tage`
      : "Dashboard"
  }
  actions={
    <button className="btn btn-secondary" onClick={logout}>
      Logout
    </button>
  }
/>

      {info ? <div style={noticeStyle(info)}>{info}</div> : null}
{profile && checkins.length > 0 ? (
  <div className="card" style={{ borderLeft: "4px solid #22c55e", marginBottom: 16 }}>
    <strong>Letzter Check-in</strong>
    <div className="muted" style={{ marginTop: 6 }}>
      {checkins[0].local_datetime
        ? new Date(checkins[0].local_datetime).toLocaleString("de-DE")
        : checkins[0].created_at
          ? new Date(checkins[0].created_at).toLocaleString("de-DE")
          : checkins[0].date || "-"}
    </div>
    {checkins[0].weight_kg != null ? (
      <div className="muted">Gewicht: {checkins[0].weight_kg} kg</div>
    ) : null}
  </div>
) : null}

<div className="mobile-stat-strip">
  <div className="mobile-stat-box" style={{ borderLeft: "4px solid #60a5fa" }}>
    <div className="mobile-stat-label">Nächster Check-in</div>
    <div className="mobile-stat-value">
      {profile
        ? `${daysUntilNextCheckin(
            Number(profile.checkin_weekday ?? 0),
            Number(profile.checkin_interval_days ?? 7)
          )} T`
        : "-"}
    </div>
  </div>

  <div className="mobile-stat-box" style={{ borderLeft: "4px solid #22c55e" }}>
    <div className="mobile-stat-label">Pläne</div>
    <div className="mobile-stat-value">{plans.length}</div>
  </div>

  <div className="mobile-stat-box" style={{ borderLeft: "4px solid #f59e0b" }}>
    <div className="mobile-stat-label">Nachrichten</div>
    <div className="mobile-stat-value">{messages.length}</div>
  </div>

  <div className="mobile-stat-box" style={{ borderLeft: "4px solid #ec4899" }}>
    <div className="mobile-stat-label">Check-ins</div>
    <div className="mobile-stat-value">{checkins.length}</div>
  </div>
</div>

<div className="mobile-home-grid">
  <Link href="/athlete/messages" className="mobile-home-card">
    <div className="mobile-home-card-title">Nachrichten</div>
    <div className="mobile-home-card-text">
      Chat mit deinem Coach und neue Antworten ansehen.
    </div>
  </Link>

  <Link href="/athlete/checkin" className="mobile-home-card">
    <div className="mobile-home-card-title">Check-in</div>
    <div className="mobile-home-card-text">
      Deinen nächsten Check-in schnell und sauber erfassen.
    </div>
  </Link>

  <Link href="/athlete/plans" className="mobile-home-card">
    <div className="mobile-home-card-title">Pläne</div>
    <div className="mobile-home-card-text">
      Trainings- und Ernährungspläne direkt öffnen.
    </div>
  </Link>

  <Link href="/athlete/profile" className="mobile-home-card">
    <div className="mobile-home-card-title">Profil</div>
    <div className="mobile-home-card-text">
      Deine Phase, Ziele und Check-in-Daten ansehen.
    </div>
  </Link>
</div>

      {loading ? (
        <section className="card">
          <p className="muted">Lade Daten...</p>
        </section>
      ) : null}

    <div className="desktop-only">
      <LayoutEditor
        isAdmin={profile?.role === "admin"}
        editing={editingLayout}
        setEditing={setEditingLayout}
        layout={layout}
        setLayout={setLayout}
        onSave={saveLayout}
        labels={layoutLabels}
        saving={savingLayout}
      />
    </div>

      {profile ? (
  <>
    <div className="desktop-only">
      <section className="grid three">
        <div className="card stat-card" style={{ borderLeft: "4px solid #60a5fa" }}>
          <div className="stat-label">Name</div>
          <div className="stat-value small">{profile.full_name || "-"}</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="stat-label">Ziel</div>
          <div className="stat-value small">{profile.goal || "-"}</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: "4px solid #ec4899" }}>
          <div className="stat-label">Phase</div>
          <div className="stat-value small">{profile.current_phase || "-"}</div>
        </div>
      </section>
    </div>

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
  </>
) : null}
    </main>
  </AppShell>
  );
}
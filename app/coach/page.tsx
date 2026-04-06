"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
export const dynamic = "force-dynamic";
import PushEnableButton from "@/components/PushEnableButton";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Header, BackToDashboard } from "@/components/Header";
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

const PHASES = ["Aufbau", "Diät", "Reverse Diät", "Detox", "Peak Week"];
const GOALS = ["Gesundheit", "Mobilität", "Fettabbau", "Muskelaufbau", "Wettkampf"];
const WEEKDAYS = [
  { value: 0, label: "Sonntag" },
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
  { value: 6, label: "Samstag" },
];
const DIGESTION_OPTIONS = ["Sehr gut", "Gut", "Normal", "Träge", "Probleme"];

const layoutLabels: Record<string, string> = {
  checkins: "Check-ins",
  plans: "Pläne",
  messages: "Nachrichten",
  weightChart: "Gewichtsverlauf",
  compareCheckins: "Check-ins vergleichen",
  athleteSettings: "Check-in-Einstellungen & Athlet bearbeiten",
};

function parseGermanNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function sectionStyle(color: string) {
  return { borderLeft: `4px solid ${color}` };
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

function formatDateTimeDE(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("de-DE");
}

function formatDateDE(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("de-DE");
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

function CoachPageContent() {
  const router = useRouter();
  const [athleteIdFromUrl, setAthleteIdFromUrl] = useState("");

useEffect(() => {
  if (!athleteIdFromUrl || athletes.length === 0) return;

  const found = athletes.find((a) => a.id === athleteIdFromUrl);

  if (found && found.id !== selected?.id) {
    applySelectedAthlete(found);
    loadAthleteData(found.id);
  }
}, [athleteIdFromUrl, athletes]);

  updateAthleteFromUrl();

  useEffect(() => {
  const updateAthleteFromUrl = () => {
    const search = new URLSearchParams(window.location.search);
    const athleteId = search.get("athlete");
    if (athleteId) {
      setAthleteIdFromUrl(athleteId);
    }
  };

  updateAthleteFromUrl();

  window.addEventListener("popstate", updateAthleteFromUrl);

  return () => {
    window.removeEventListener("popstate", updateAthleteFromUrl);
  };
}, []);

  const [athletes, setAthletes] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  const [checkins, setCheckins] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  const [athleteName, setAthleteName] = useState("");
  const [athleteGoal, setAthleteGoal] = useState("Gesundheit");
  const [athleteHeight, setAthleteHeight] = useState("");
  const [athleteStartWeight, setAthleteStartWeight] = useState("");
  const [athletePhase, setAthletePhase] = useState("Aufbau");
  const [athleteCoachId, setAthleteCoachId] = useState("");
  const [athleteCheckinWeekday, setAthleteCheckinWeekday] = useState("0");
  const [athleteCheckinIntervalDays, setAthleteCheckinIntervalDays] = useState("7");

  const [planType, setPlanType] = useState("training");
  const [planNote, setPlanNote] = useState("");
  const [planStartDate, setPlanStartDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingPlanType, setEditingPlanType] = useState("");
  const [editingPlanNote, setEditingPlanNote] = useState("");

  const [editingCheckinId, setEditingCheckinId] = useState<string | null>(null);
  const [editCheckinDateTime, setEditCheckinDateTime] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editBloodPressureSys, setEditBloodPressureSys] = useState("");
  const [editBloodPressureDia, setEditBloodPressureDia] = useState("");
  const [editPulse, setEditPulse] = useState("");
  const [editSugar, setEditSugar] = useState("");
  const [editMotivation, setEditMotivation] = useState("mittel");
  const [editWellBeing, setEditWellBeing] = useState("mittel");
  const [editSleepQuality, setEditSleepQuality] = useState("mittel");
  const [editStoolQuality, setEditStoolQuality] = useState("normal");
  const [editStoolTimes, setEditStoolTimes] = useState("1");
  const [editStoolEveryDays, setEditStoolEveryDays] = useState("1");
  const [editDigestion, setEditDigestion] = useState("Normal");
  const [editHunger, setEditHunger] = useState("false");
  const [editHungerScale, setEditHungerScale] = useState("1");
  const [editComment, setEditComment] = useState("");

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState("");

  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");

  const [messageText, setMessageText] = useState("");

  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [me, setMe] = useState<any>(null);

  const [layout, setLayout] = useState<LayoutItem[]>(defaultLayouts.coach);
  const [editingLayout, setEditingLayout] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  const [broadcastText, setBroadcastText] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);


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
      await Promise.all([
        loadAthletes(profile),
        profile.role === "admin" ? loadCoaches() : Promise.resolve(),
        loadLayout(),
      ]);
      setLoading(false);
    };

    init();
  }, [router]);

  const loadLayout = async () => {
    const { data } = await supabase
      .from("app_layouts")
      .select("layout")
      .eq("page_key", "coach")
      .maybeSingle();

    setLayout(normalizeLayout("coach", data?.layout));
  };

  const saveLayout = async () => {
    setSavingLayout(true);
    setInfo("");

    const normalized = normalizeLayout("coach", layout);

    const { error } = await supabase
      .from("app_layouts")
      .upsert(
        {
          page_key: "coach",
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

  const loadCoaches = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, invite_code")
      .in("role", ["admin", "coach"])
      .order("full_name", { ascending: true });

    setCoaches(data || []);
  };

  const loadAthletes = async (viewerArg?: any) => {
    const viewer = viewerArg || me;
    if (!viewer) return;

    let query = supabase.from("profiles").select("*").eq("role", "athlete");

    if (viewer.role === "coach") {
      query = query.eq("coach_id", viewer.id);
    }

    const { data, error } = await query.order("full_name", { ascending: true });

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    const athleteList = data || [];
    setAthletes(athleteList);

    if (athleteIdFromUrl) {
      const found = athleteList.find((a) => a.id === athleteIdFromUrl);
      if (found) {
        applySelectedAthlete(found);
        await loadAthleteData(found.id);
        return;
      }
    }

    if (athleteList.length > 0 && !selected) {
      applySelectedAthlete(athleteList[0]);
      await loadAthleteData(athleteList[0].id);
    }

setTimeout(() => {
  if (athleteIdFromUrl) {
    const found = athleteList.find((a) => a.id === athleteIdFromUrl);
    if (found) {
      applySelectedAthlete(found);
      loadAthleteData(found.id);
    }
  }
}, 0);
  };

  const applySelectedAthlete = (athlete: any) => {
    setSelected(athlete);
    setAthleteName(athlete.full_name || "");
    setAthleteGoal(athlete.goal || "Gesundheit");
    setAthleteHeight(athlete.height?.toString() || "");
    setAthleteStartWeight(athlete.start_weight?.toString() || "");
    setAthletePhase(athlete.current_phase || "Aufbau");
    setAthleteCoachId(athlete.coach_id || "");
    setAthleteCheckinWeekday(String(athlete.checkin_weekday ?? 0));
    setAthleteCheckinIntervalDays(String(athlete.checkin_interval_days ?? 7));
  };

  const loadAthleteData = async (athleteId: string) => {
    const [
      { data: checkinsData, error: checkinsError },
      { data: plansData, error: plansError },
      { data: photosData, error: photosError },
      { data: messagesData, error: messagesError },
    ] = await Promise.all([
      supabase.from("checkins").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false }),
      supabase.from("plans").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false }),
      supabase.from("progress_photos").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false }),

    ]);

    if (checkinsError || plansError || photosError || messagesError) {
      setInfo(
        "Fehler: " +
          (checkinsError?.message ||
            plansError?.message ||
            photosError?.message ||
            messagesError?.message ||
            "Fehler beim Laden der Athletendaten.")
      );
      return;
    }

    setCheckins(checkinsData || []);
    setPlans(plansData || []);
    setPhotos(photosData || []);
    setMessages(messagesData || []);

await supabase
  .from("messages")
  .update({ is_seen: true })
  .eq("athlete_id", athleteId)
  .eq("sender_role", "athlete");
  };

  const saveAthleteProfile = async () => {
    if (!selected) return;

    const intervalNum = Number(athleteCheckinIntervalDays);
    if (!intervalNum || intervalNum < 1) {
      setInfo("Fehler: Check-in Intervall muss mindestens 1 Tag sein.");
      return;
    }

    const payload: any = {
      full_name: athleteName.trim(),
      goal: athleteGoal,
      height: athleteHeight ? Number(athleteHeight) : null,
      start_weight: athleteStartWeight ? Number(athleteStartWeight) : null,
      current_phase: athletePhase,
      checkin_weekday: Number(athleteCheckinWeekday),
      checkin_interval_days: intervalNum,
    };

    if (me?.role === "admin") {
      payload.coach_id = athleteCoachId || null;
    }

    const { error } = await supabase.from("profiles").update(payload).eq("id", selected.id);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setInfo("Athlet aktualisiert.");
    await loadAthletes();
    await loadAthleteData(selected.id);
  };

  const deleteAthlete = async () => {
    if (!selected) return;

    const confirmed = window.confirm(
      `Athlet "${selected.full_name}" wirklich endgültig löschen?\nAlle Daten gehen verloren!`
    );
    if (!confirmed) return;

    const { error } = await supabase.from("profiles").delete().eq("id", selected.id);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setInfo("Athlet gelöscht.");
    setSelected(null);
    setCheckins([]);
    setPlans([]);
    setPhotos([]);
    setMessages([]);
    await loadAthletes();
  };

  const uploadAndSavePlan = async () => {
    setInfo("");

    if (!selected) {
      setInfo("Fehler: Bitte zuerst einen Athleten auswählen.");
      return;
    }

    if (!file) {
      setInfo("Fehler: Bitte zuerst eine Datei auswählen.");
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const simpleFileName = `${selected.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(simpleFileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) {
        setInfo("Fehler: Upload Fehler: " + uploadError.message);
        setUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("documents").getPublicUrl(simpleFileName);
      const localCreatedAt = new Date().toLocaleString("de-DE");

      const { error: dbError } = await supabase.from("plans").insert({
  athlete_id: selected.id,
  type: planType,
  file_url: publicUrlData.publicUrl,
  file_name: file.name,
  title: file.name,
  note: planNote || null,
  valid_from: planStartDate || null,
  local_created_at: localCreatedAt,
});

      if (dbError) {
        setInfo("Fehler: DB Fehler: " + dbError.message);
        setUploading(false);
        return;
      }

await fetch("/api/push/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: "plan_uploaded",
    athleteId: selected.id,
    senderUserId: me?.id || null,
    title: "Neuer Plan verfügbar",
    message: `Ein neuer ${planType === "training" ? "Trainingsplan" : planType === "nutrition" ? "Ernährungsplan" : "Plan"} wurde hochgeladen.`,
    url: `/athlete`,
  }),
});
      setFile(null);
      setPlanNote("");
      setPlanStartDate("");
      setInfo("Plan hochgeladen.");
      await loadAthleteData(selected.id);
    } catch {
      setInfo("Fehler: Upload Fehler: Failed to fetch");
    } finally {
      setUploading(false);
    }
  };

  const startEditPlan = (plan: any) => {
    setEditingPlanId(plan.id);
    setEditingPlanType(plan.type || "training");
    setEditingPlanNote(plan.note || "");
  };

  const savePlanEdit = async () => {
    if (!editingPlanId || !selected) return;

    const { error } = await supabase
      .from("plans")
      .update({
        type: editingPlanType,
        note: editingPlanNote || null,
      })
      .eq("id", editingPlanId);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setEditingPlanId(null);
    setEditingPlanType("");
    setEditingPlanNote("");
    setInfo("Plan aktualisiert.");
    await loadAthleteData(selected.id);
  };

  const deletePlan = async (planId: string) => {
    if (!selected) return;

    const confirmed = window.confirm("Diesen Plan wirklich endgültig löschen?");
    if (!confirmed) return;

    const { error } = await supabase.from("plans").delete().eq("id", planId);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setInfo("Plan gelöscht.");
    await loadAthleteData(selected.id);
  };

  const sendMessage = async () => {
  setInfo("");

  if (!selected) {
    setInfo("Fehler: Kein Athlet ausgewählt.");
    return;
  }

  if (!messageText.trim()) {
    setInfo("Fehler: Bitte zuerst eine Nachricht eingeben.");
    return;
  }

  const localCreatedAt = new Date().toLocaleString("de-DE");

  const { error } = await supabase.from("messages").insert({
    athlete_id: selected.id,
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
      athleteId: selected.id,
      senderUserId: me?.id || null,
      title: "Neue Nachricht vom Coach",
      message: messageText.trim(),
      url: `/athlete`,
    }),
  });

  setMessageText("");
  setInfo("Nachricht gespeichert.");
  await loadAthleteData(selected.id);
};

const sendBroadcast = async () => {
  setInfo("");

  if (!broadcastText.trim()) {
    setInfo("Fehler: Bitte zuerst eine Nachricht an alle eingeben.");
    return;
  }

  setSendingBroadcast(true);

  try {
    const localCreatedAt = new Date().toLocaleString("de-DE");

    const inserts = athletes.map((a) => ({
      athlete_id: a.id,
      sender_role: "coach",
      content: broadcastText.trim(),
      is_seen: false,
      local_created_at: localCreatedAt,
    }));

    const { error } = await supabase.from("messages").insert(inserts);

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
        title: "Neue Nachricht",
        message: broadcastText.trim(),
        url: `/athlete`,
      }),
    });

    setBroadcastText("");
    setInfo("Nachricht an alle gesendet.");
  } finally {
    setSendingBroadcast(false);
  }
};

  const startEditMessage = (message: any) => {
    setEditingMessageId(message.id);
    setEditMessageText(message.content || "");
  };

  const saveMessageEdit = async () => {
    if (!editingMessageId || !selected) return;

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
    await loadAthleteData(selected.id);
  };

  const deleteMessage = async (messageId: string) => {
    if (!selected) return;

    const confirmed = window.confirm("Diese Nachricht wirklich löschen?");
    if (!confirmed) return;

    const { error } = await supabase.from("messages").delete().eq("id", messageId);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setInfo("Nachricht gelöscht.");
    await loadAthleteData(selected.id);
  };

  const startEditCheckin = (checkin: any) => {
    setEditingCheckinId(checkin.id);
    setEditCheckinDateTime(checkin.local_datetime ? String(checkin.local_datetime).slice(0, 16) : "");
    setEditWeight(checkin.weight_kg?.toString() || "");
    setEditBloodPressureSys(checkin.blood_pressure_sys?.toString() || "");
    setEditBloodPressureDia(checkin.blood_pressure_dia?.toString() || "");
    setEditPulse(checkin.pulse_bpm?.toString() || "");
    setEditSugar(checkin.blood_sugar?.toString() || "");
    setEditMotivation(checkin.motivation || "mittel");
    setEditWellBeing(checkin.well_being || "mittel");
    setEditSleepQuality(checkin.sleep_quality || "mittel");
    setEditStoolQuality(checkin.stool_quality || "normal");
    setEditStoolTimes(String(checkin.stool_times ?? 1));
    setEditStoolEveryDays(String(checkin.stool_every_days ?? 1));
    setEditDigestion(checkin.digestion || "Normal");
    setEditHunger(String(Boolean(checkin.hunger)));
    setEditHungerScale(String(checkin.hunger_scale ?? 1));
    setEditComment(checkin.additional_comment || "");
  };

  const saveCheckinEdit = async () => {
    if (!editingCheckinId || !selected) return;

    const parsedEditWeight = editWeight ? parseGermanNumber(editWeight) : null;

    if (editWeight && parsedEditWeight === null) {
      setInfo("Fehler: Bitte gültiges Gewicht eingeben.");
      return;
    }
    if (editBloodPressureSys && isNaN(Number(editBloodPressureSys))) {
      setInfo("Fehler: SYS Blutdruck muss eine Zahl sein.");
      return;
    }
    if (editBloodPressureDia && isNaN(Number(editBloodPressureDia))) {
      setInfo("Fehler: DIA Blutdruck muss eine Zahl sein.");
      return;
    }
    if (editHunger === "true" && (!editHungerScale || Number(editHungerScale) < 1 || Number(editHungerScale) > 10)) {
      setInfo("Fehler: Hunger-Skala muss zwischen 1 und 10 liegen.");
      return;
    }

    const payload: any = {};

if (editCheckinDateTime) {
  payload.date = editCheckinDateTime.slice(0, 10);
  payload.local_datetime = editCheckinDateTime;
}

if (editWeight) payload.weight_kg = parsedEditWeight;
if (editBloodPressureSys) payload.blood_pressure_sys = Number(editBloodPressureSys);
if (editBloodPressureDia) payload.blood_pressure_dia = Number(editBloodPressureDia);
if (editPulse) payload.pulse_bpm = Number(editPulse);
if (editSugar) payload.blood_sugar = Number(editSugar);

if (editMotivation) payload.motivation = editMotivation;
if (editWellBeing) payload.well_being = editWellBeing;
if (editSleepQuality) payload.sleep_quality = editSleepQuality;

if (editStoolQuality) payload.stool_quality = editStoolQuality;
if (editStoolTimes) payload.stool_times = Number(editStoolTimes);
if (editStoolEveryDays) payload.stool_every_days = Number(editStoolEveryDays);

if (editDigestion) payload.digestion = editDigestion;

payload.hunger = editHunger === "true";
if (editHungerScale) payload.hunger_scale = Number(editHungerScale);

if (editComment) payload.additional_comment = editComment;
    };

    const { error } = await supabase.from("checkins").update(payload).eq("id", editingCheckinId);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setEditingCheckinId(null);
    setInfo("Check-in aktualisiert.");
    await loadAthleteData(selected.id);
  };

  const deleteCheckin = async (checkinId: string) => {
    if (!selected) return;

    const confirmed = window.confirm("Diesen Check-in wirklich endgültig löschen?");
    if (!confirmed) return;

    const { error } = await supabase.from("checkins").delete().eq("id", checkinId);

    if (error) {
      setInfo("Fehler: " + error.message);
      return;
    }

    setInfo("Check-in gelöscht.");
    await loadAthleteData(selected.id);
  };

  const latestWeight =
    checkins.length > 0 && checkins[0]?.weight_kg != null ? checkins[0].weight_kg : null;

  const compareCheckinA = checkins.find((c) => String(c.id) === String(compareA));
  const compareCheckinB = checkins.find((c) => String(c.id) === String(compareB));

  const comparePhotosA = photos.filter((p) => p.checkin_id === compareCheckinA?.id);
  const comparePhotosB = photos.filter((p) => p.checkin_id === compareCheckinB?.id);

  const weightChartData = [...checkins]
    .filter((c) => c.weight_kg != null)
    .reverse()
    .map((c) => ({
      date: c.local_datetime ? formatDateDE(c.local_datetime) : c.date || "",
      weight: c.weight_kg,
    }));

  const { recent: recentCheckins, older: olderCheckins } = splitRecentAndOlder(checkins);
  const { recent: recentPlans, older: olderPlans } = splitRecentAndOlder(plans);

  const sections = sortSectionsByLayout(
    [
      {
        id: "checkins",
        content: (
          <div className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "checkins")?.width || "half")}`} style={{ ...sectionStyle("#22c55e"), minWidth: 0 }}>
            <h2>Check-ins</h2>

            {checkins.length === 0 ? (
              <p className="muted">Noch keine Check-ins vorhanden.</p>
            ) : (
              <>
                <div className="stack">
                  {recentCheckins.map((checkin) => {
                    const linkedPhotos = photos.filter((photo) => photo.checkin_id === checkin.id);

                    return (
                      <div key={checkin.id} className="item">
                        {editingCheckinId === checkin.id ? (
                          <>
                            <label>Datum & Uhrzeit</label>
                            <input
                              type="datetime-local"
                              value={editCheckinDateTime}
                              onChange={(e) => setEditCheckinDateTime(e.target.value)}
                            />

                            <label>Gewicht (kg)</label>
                            <input value={editWeight} onChange={(e) => setEditWeight(e.target.value)} />

                            <label>Blutdruck (SYS / DIA mmHg)</label>
                            <div className="grid two">
                              <input value={editBloodPressureSys} onChange={(e) => setEditBloodPressureSys(e.target.value)} placeholder="SYS" />
                              <input value={editBloodPressureDia} onChange={(e) => setEditBloodPressureDia(e.target.value)} placeholder="DIA" />
                            </div>

                            <label>Puls (bpm)</label>
                            <input value={editPulse} onChange={(e) => setEditPulse(e.target.value)} />

                            <label>Blutzucker (mg/dL)</label>
                            <input value={editSugar} onChange={(e) => setEditSugar(e.target.value)} />

                            <label>Hunger</label>
                            <select value={editHunger} onChange={(e) => setEditHunger(e.target.value)}>
                              <option value="false">Nein</option>
                              <option value="true">Ja</option>
                            </select>

                            <label>Hunger-Skala (1-10)</label>
                            <select
                              value={editHungerScale}
                              onChange={(e) => setEditHungerScale(e.target.value)}
                              disabled={editHunger !== "true"}
                            >
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>

                            <label>Motivation</label>
                            <select value={editMotivation} onChange={(e) => setEditMotivation(e.target.value)}>
                              <option value="sehr_niedrig">Sehr niedrig</option>
                              <option value="niedrig">Niedrig</option>
                              <option value="mittel">Mittel</option>
                              <option value="hoch">Hoch</option>
                              <option value="sehr_hoch">Sehr hoch</option>
                            </select>

                            <label>Wohlbefinden</label>
                            <select value={editWellBeing} onChange={(e) => setEditWellBeing(e.target.value)}>
                              <option value="sehr_schlecht">Sehr schlecht</option>
                              <option value="schlecht">Schlecht</option>
                              <option value="mittel">Mittel</option>
                              <option value="gut">Gut</option>
                              <option value="sehr_gut">Sehr gut</option>
                            </select>

                            <label>Schlaf</label>
                            <select value={editSleepQuality} onChange={(e) => setEditSleepQuality(e.target.value)}>
                              <option value="sehr_schlecht">Sehr schlecht</option>
                              <option value="schlecht">Schlecht</option>
                              <option value="mittel">Mittel</option>
                              <option value="gut">Gut</option>
                              <option value="sehr_gut">Sehr gut</option>
                            </select>

                            <label>Stuhlgang</label>
                            <select value={editStoolQuality} onChange={(e) => setEditStoolQuality(e.target.value)}>
                              <option value="verstopfung">Verstopfung</option>
                              <option value="hart">Hart</option>
                              <option value="normal">Normal</option>
                              <option value="weich">Weich</option>
                              <option value="durchfall">Durchfall</option>
                            </select>

                            <label>Wie oft</label>
                            <input value={editStoolTimes} onChange={(e) => setEditStoolTimes(e.target.value)} />

                            <label>Alle wie viele Tage</label>
                            <input value={editStoolEveryDays} onChange={(e) => setEditStoolEveryDays(e.target.value)} />

                            <label>Verdauung</label>
                            <select value={editDigestion} onChange={(e) => setEditDigestion(e.target.value)}>
                              {DIGESTION_OPTIONS.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>

                            <label>Kommentar</label>
                            <textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} />

                            <div className="button-row">
                              <button className="btn btn-primary" onClick={saveCheckinEdit}>
                                Speichern
                              </button>
                              <button className="btn btn-secondary" onClick={() => setEditingCheckinId(null)}>
                                Abbrechen
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="muted">
                              {checkin.local_datetime
                                ? formatDateTimeDE(checkin.local_datetime)
                                : checkin.created_at
                                  ? formatDateTimeDE(checkin.created_at)
                                  : checkin.date || "-"}
                            </div>
                            <div className="muted">Gewicht: {checkin.weight_kg ?? "-"} kg</div>
                            <div className="muted">
                              Blutdruck:{" "}
                              {checkin.blood_pressure_sys && checkin.blood_pressure_dia
                                ? `${checkin.blood_pressure_sys}/${checkin.blood_pressure_dia} mmHg`
                                : checkin.blood_pressure || "-"}
                            </div>
                            <div className="muted">Puls: {checkin.pulse_bpm ?? "-"} bpm</div>
                            <div className="muted">Blutzucker: {checkin.blood_sugar ?? "-"} mg/dL</div>
                            <div className="muted">Hunger: {checkin.hunger ? "Ja" : "Nein"}</div>
                            <div className="muted">Hunger-Skala: {checkin.hunger_scale ?? "-"}</div>
                            <div className="muted">Stuhlgang: {checkin.stool_quality || "-"}</div>
                            <div className="muted">Wie oft: {checkin.stool_times ?? "-"}</div>
                            <div className="muted">Alle wie viele Tage: {checkin.stool_every_days ?? "-"}</div>
                            <div className="muted">Verdauung: {checkin.digestion || "-"}</div>
                            <div className="muted">Kommentar: {checkin.additional_comment || "-"}</div>

                            <div className="button-row" style={{ marginTop: 10 }}>
                              <button className="btn btn-secondary" onClick={() => startEditCheckin(checkin)}>
                                Bearbeiten
                              </button>
                              <button className="btn btn-secondary" onClick={() => deleteCheckin(checkin.id)}>
                                Löschen
                              </button>
                            </div>

                            {renderPhotoGallery(linkedPhotos)}
                          </>
                        )}
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
                            <div className="muted">
                              {checkin.local_datetime
                                ? formatDateTimeDE(checkin.local_datetime)
                                : checkin.created_at
                                  ? formatDateTimeDE(checkin.created_at)
                                  : checkin.date || "-"}
                            </div>
                            <div className="muted">Gewicht: {checkin.weight_kg ?? "-"} kg</div>
                            <div className="muted">Wie oft: {checkin.stool_times ?? "-"}</div>
                            <div className="muted">Alle wie viele Tage: {checkin.stool_every_days ?? "-"}</div>
                            <div className="button-row" style={{ marginTop: 10 }}>
                              <button className="btn btn-secondary" onClick={() => startEditCheckin(checkin)}>
                                Bearbeiten
                              </button>
                              <button className="btn btn-secondary" onClick={() => deleteCheckin(checkin.id)}>
                                Löschen
                              </button>
                            </div>

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
      {
        id: "plans",
        content: (
          <div className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "plans")?.width || "half")}`} style={{ ...sectionStyle("#f59e0b"), minWidth: 0 }}>
            <h2>Pläne</h2>

            {plans.length === 0 ? (
              <p className="muted">Keine Pläne vorhanden.</p>
            ) : (
              <>
                <div className="stack">
                  {recentPlans.map((plan) => (
                    <div key={plan.id} className="item">
                      {editingPlanId === plan.id ? (
                        <>
                          <select value={editingPlanType} onChange={(e) => setEditingPlanType(e.target.value)}>
                            <option value="training">Training</option>
                            <option value="nutrition">Ernährung</option>
                            <option value="other">Sonstiges</option>
                          </select>

                          <label>Bemerkung</label>
                          <textarea value={editingPlanNote} onChange={(e) => setEditingPlanNote(e.target.value)} />

                          <div className="button-row">
                            <button className="btn btn-primary" onClick={savePlanEdit}>
                              Speichern
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setEditingPlanId(null);
                                setEditingPlanType("");
                                setEditingPlanNote("");
                              }}
                            >
                              Abbrechen
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
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
  Gültig ab: {plan.valid_from ? formatDateDE(plan.valid_from) : "-"}
</div>

                          {plan.file_url ? (
                            <a href={plan.file_url} target="_blank" rel="noreferrer">
                              Datei öffnen
                            </a>
                          ) : (
                            <div>{plan.content || "Kein Inhalt"}</div>
                          )}

                          {plan.note ? <div className="muted">Bemerkung: {plan.note}</div> : null}

                          <div className="button-row" style={{ marginTop: 10 }}>
                            <button className="btn btn-secondary" onClick={() => startEditPlan(plan)}>
                              Bearbeiten
                            </button>
                            <button className="btn btn-secondary" onClick={() => deletePlan(plan.id)}>
                              Löschen
                            </button>
                          </div>
                        </>
                      )}
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
                            {plan.local_created_at ||
                              (plan.created_at
                                ? new Date(plan.created_at).toLocaleString("de-DE")
                                : "-")}
                          </div>
			<div className="muted">
  Gültig ab: {plan.valid_from ? formatDateDE(plan.valid_from) : "-"}
</div>

                          {plan.file_url ? (
                            <a href={plan.file_url} target="_blank" rel="noreferrer">
                              Datei öffnen
                            </a>
                          ) : (
                            <div>{plan.content || "Kein Inhalt"}</div>
                          )}

                          {plan.note ? <div className="muted">Bemerkung: {plan.note}</div> : null}

                          <div className="button-row" style={{ marginTop: 10 }}>
                            <button className="btn btn-secondary" onClick={() => startEditPlan(plan)}>
                              Bearbeiten
                            </button>
                            <button className="btn btn-secondary" onClick={() => deletePlan(plan.id)}>
                              Löschen
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </>
            )}

            <h3>Neuen Plan hochladen</h3>
            <label>Plan-Typ</label>
            <select value={planType} onChange={(e) => setPlanType(e.target.value)}>
              <option value="training">Training</option>
              <option value="nutrition">Ernährung</option>
              <option value="other">Sonstiges</option>
            </select>

            <label>Bemerkung</label>
<textarea
  value={planNote}
  onChange={(e) => setPlanNote(e.target.value)}
  placeholder="Bemerkung zur Datei..."
/>

<label>Gültig ab</label>
<input
  type="date"
  value={planStartDate}
  onChange={(e) => setPlanStartDate(e.target.value)}
/>

<label>Datei</label>
<input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />

            <div className="button-row">
              <button className="btn btn-primary" onClick={uploadAndSavePlan} disabled={uploading}>
                {uploading ? "Lade hoch..." : "Datei hochladen"}
              </button>
            </div>
          </div>
        ),
      },
      {
        id: "messages",
        content: (
          <div className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "messages")?.width || "full")}`} style={{ ...sectionStyle("#60a5fa"), minWidth: 0 }}>
            <h2>Nachrichten</h2>

<div className="item" style={{ marginBottom: 16 }}>
  <strong>Nachricht an alle Athleten</strong>
  <textarea
    placeholder="Nachricht an alle schreiben..."
    value={broadcastText}
    onChange={(e) => setBroadcastText(e.target.value)}
    style={{ marginTop: 10 }}
  />
  <div className="button-row" style={{ marginTop: 10 }}>
    <button
      className="btn btn-primary"
      onClick={sendBroadcast}
      disabled={sendingBroadcast}
    >
      {sendingBroadcast ? "Sende..." : "An alle senden"}
    </button>
  </div>
</div>

            {messages.length === 0 ? (
              <p className="muted">Keine Nachrichten vorhanden.</p>
            ) : (
              <div className="stack">
                {messages.map((msg) => (
                  <div key={msg.id} className="item">
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
                        <strong>{msg.sender_role === "coach" ? "Coach" : "Athlet"}</strong>
                        <div>{msg.content}</div>
                        <div className="muted">
                          {msg.local_created_at ||
                            (msg.created_at
                              ? new Date(msg.created_at).toLocaleString("de-DE")
                              : "-")}
                        </div>
                        <div className="button-row" style={{ marginTop: 10 }}>
                          <button className="btn btn-secondary" onClick={() => startEditMessage(msg)}>
                            Bearbeiten
                          </button>
                          <button className="btn btn-secondary" onClick={() => deleteMessage(msg.id)}>
                            Löschen
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h3>Neue Nachricht</h3>
            <textarea
              placeholder="Nachricht schreiben..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
            <div className="button-row">
              <button className="btn btn-primary" onClick={sendMessage}>
                Nachricht senden
              </button>
            </div>
          </div>
        ),
      },
      {
        id: "weightChart",
        content: (
          <div className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "weightChart")?.width || "half")}`} style={{ ...sectionStyle("#a78bfa"), minWidth: 0 }}>
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
                    <Line type="monotone" dataKey="weight" stroke="#8b5cf6" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "compareCheckins",
        content: (
          <div className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "compareCheckins")?.width || "half")}`} style={{ ...sectionStyle("#a78bfa"), minWidth: 0 }}>
            <h2>Check-ins vergleichen</h2>

            <label>Check-in A</label>
            <select value={compareA} onChange={(e) => setCompareA(e.target.value)}>
              <option value="">Bitte wählen</option>
              {checkins.map((checkin) => (
                <option key={checkin.id} value={checkin.id}>
                  {checkin.local_datetime
                    ? formatDateDE(checkin.local_datetime)
                    : checkin.created_at
                      ? formatDateDE(checkin.created_at)
                      : checkin.date
                        ? formatDateDE(checkin.date)
                        : "-"}
                </option>
              ))}
            </select>

            <label>Check-in B</label>
            <select value={compareB} onChange={(e) => setCompareB(e.target.value)}>
              <option value="">Bitte wählen</option>
              {checkins.map((checkin) => (
                <option key={checkin.id} value={checkin.id}>
                  {checkin.local_datetime
                    ? formatDateDE(checkin.local_datetime)
                    : checkin.created_at
                      ? formatDateDE(checkin.created_at)
                      : checkin.date
                        ? formatDateDE(checkin.date)
                        : "-"}
                </option>
              ))}
            </select>

            {compareCheckinA && compareCheckinB ? (
              <div className="grid two" style={{ marginTop: 12 }}>
                <div className="item">
                  <strong>A</strong>
                  <div className="muted">
                    {compareCheckinA.local_datetime
                      ? formatDateDE(compareCheckinA.local_datetime)
                      : compareCheckinA.created_at
                        ? formatDateDE(compareCheckinA.created_at)
                        : compareCheckinA.date
                          ? formatDateDE(compareCheckinA.date)
                          : "-"}
                  </div>
                  <div className="muted">Gewicht: {compareCheckinA.weight_kg ?? "-"} kg</div>
                  {renderPhotoGallery(comparePhotosA)}
                </div>

                <div className="item">
                  <strong>B</strong>
                  <div className="muted">
                    {compareCheckinB.local_datetime
                      ? formatDateDE(compareCheckinB.local_datetime)
                      : compareCheckinB.created_at
                        ? formatDateDE(compareCheckinB.created_at)
                        : compareCheckinB.date
                          ? formatDateDE(compareCheckinB.date)
                          : "-"}
                  </div>
                  <div className="muted">Gewicht: {compareCheckinB.weight_kg ?? "-"} kg</div>
                  {renderPhotoGallery(comparePhotosB)}
                </div>
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "athleteSettings",
        content: (
          <div className={`card ${getLayoutItemWidthClass(layout.find((x) => x.id === "athleteSettings")?.width || "full")}`} style={{ ...sectionStyle("#ec4899"), minWidth: 0 }}>
            <h2>Check-in-Einstellungen & Athlet bearbeiten</h2>

            <div className="grid two">
              <div>
                <label>Name</label>
                <input value={athleteName} onChange={(e) => setAthleteName(e.target.value)} />
              </div>

              <div>
                <label>Ziel</label>
                <select value={athleteGoal} onChange={(e) => setAthleteGoal(e.target.value)}>
                  {GOALS.map((goal) => (
                    <option key={goal} value={goal}>
                      {goal}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Größe (cm)</label>
                <input value={athleteHeight} onChange={(e) => setAthleteHeight(e.target.value)} />
              </div>

              <div>
                <label>Startgewicht (kg)</label>
                <input value={athleteStartWeight} onChange={(e) => setAthleteStartWeight(e.target.value)} />
              </div>

              <div>
                <label>Phase</label>
                <select value={athletePhase} onChange={(e) => setAthletePhase(e.target.value)}>
                  {PHASES.map((phase) => (
                    <option key={phase} value={phase}>
                      {phase}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Nächster Check-in Wochentag</label>
                <select
                  value={athleteCheckinWeekday}
                  onChange={(e) => setAthleteCheckinWeekday(e.target.value)}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Check-in alle X Tage</label>
                <select
                  value={athleteCheckinIntervalDays}
                  onChange={(e) => setAthleteCheckinIntervalDays(e.target.value)}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="5">5</option>
                  <option value="7">7</option>
                  <option value="10">10</option>
                  <option value="14">14</option>
                </select>
              </div>

              {me?.role === "admin" ? (
                <div>
                  <label>Zugeordneter Coach</label>
                  <select value={athleteCoachId} onChange={(e) => setAthleteCoachId(e.target.value)}>
                    <option value="">Kein Coach</option>
                    {coaches.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {coach.full_name} ({coach.role}) - Code: {coach.invite_code || "-"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="button-row">
              <button className="btn btn-primary" onClick={saveAthleteProfile}>
                Athlet speichern
              </button>
              <button className="btn btn-secondary" onClick={deleteAthlete}>
                Athlet löschen
              </button>
            </div>
          </div>
        ),
      },
    ],
    layout
  );

  return (
 <AppShell role={me?.role === "admin" ? "admin" : "coach"}>
    <main className="page">
      <Header
        title={selected?.full_name || "Athlet"}
        subtitle={
          selected
            ? `Aktuelles Gewicht: ${latestWeight != null ? `${latestWeight} kg` : "-"} | Nächster Check-in in ${daysUntilNextCheckin(
                Number(athleteCheckinWeekday),
                Number(athleteCheckinIntervalDays)
              )} Tagen | Intervall: alle ${athleteCheckinIntervalDays} Tage`
            : "Athletendaten"
        }
        actions={<BackToDashboard />}
      />

      {info ? <div style={noticeStyle(info)}>{info}</div> : null}

  <div className="mobile-stat-box" style={{ borderLeft: "4px solid #60a5fa" }}>
    <div className="mobile-stat-label">Athleten</div>
    <div className="mobile-stat-value">{athletes.length}</div>
  </div>

  <div className="mobile-stat-box" style={{ borderLeft: "4px solid #22c55e" }}>
    <div className="mobile-stat-label">Check-ins</div>
    <div className="mobile-stat-value">
  {checkins.filter(c => !c.is_seen).length}
</div>

  <div className="mobile-stat-box" style={{ borderLeft: "4px solid #f59e0b" }}>
  <div className="mobile-stat-label">Nachrichten</div>
  <div className="mobile-stat-value">
    {messages.filter(m => m.sender_role === "athlete" && !m.is_seen).length}
  </div>
</div>

  <div className="mobile-stat-box" style={{ borderLeft: "4px solid #ec4899" }}>
    <div className="mobile-stat-label">Pläne</div>
    <div className="mobile-stat-value">{plans.length}</div>
  </div>
</div>

<div className="mobile-home-grid">
  <Link href="/coach/messages" className="mobile-home-card">
    <div className="mobile-home-card-title">Nachrichten</div>
    <div className="mobile-home-card-text">
      Athleten-Nachrichten lesen und beantworten.
    </div>
  </Link>

  <Link href="/coach/checkins" className="mobile-home-card">
    <div className="mobile-home-card-title">Check-ins</div>
    <div className="mobile-home-card-text">
      Neue Check-ins prüfen und Fortschritte vergleichen.
    </div>
  </Link>

  <Link href="/coach" className="mobile-home-card">
    <div className="mobile-home-card-title">Athleten</div>
    <div className="mobile-home-card-text">
      Athleten öffnen, bearbeiten und verwalten.
    </div>
  </Link>

  <Link href="/coach/more" className="mobile-home-card">
    <div className="mobile-home-card-title">Mehr</div>
    <div className="mobile-home-card-text">
      Einstellungen und weitere Optionen.
    </div>
  </Link>
</div>

            <div className="desktop-only">
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
</div>

      <div className="desktop-only">
        {!selected ? (
          <section className="card">
            <p className="muted">
              Kein Athlet ausgewählt. Bitte erst im Dashboard einen Athleten öffnen.
            </p>
          </section>
        ) : (
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
        )}
      </div>

    </main>
  </AppShell>
  );
}
export default function CoachPage() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <section className="card">
            <p className="muted">Lade Coach-Seite...</p>
          </section>
        </main>
      }
    >
      <CoachPageContent />
    </Suspense>
  );
}
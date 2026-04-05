"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Header } from "@/components/Header";
import { supabase } from "@/lib/supabase";

const DIGESTION_OPTIONS = ["Sehr gut", "Gut", "Normal", "Träge", "Probleme"];

function parseGermanNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
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

export default function AthleteCheckinPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [info, setInfo] = useState("");
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [loading, setLoading] = useState(true);

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
  const [hunger, setHunger] = useState("false");
  const [hungerScale, setHungerScale] = useState("1");
  const [motivation, setMotivation] = useState("mittel");
  const [wellBeing, setWellBeing] = useState("mittel");
  const [sleepQuality, setSleepQuality] = useState("mittel");
  const [stoolQuality, setStoolQuality] = useState("normal");
  const [stoolTimes, setStoolTimes] = useState("1");
  const [stoolEveryDays, setStoolEveryDays] = useState("1");
  const [digestion, setDigestion] = useState("Normal");
  const [comment, setComment] = useState("");
  const [checkinFiles, setCheckinFiles] = useState<FileList | null>(null);

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
      setLoading(false);
    };

    init();
  }, [router]);

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

      const checkinPayload = {
        athlete_id: profile.id,
        date: checkinDateTime ? checkinDateTime.slice(0, 10) : null,
        created_at: new Date().toISOString(),
        local_datetime: checkinDateTime,
        weight_kg: parsedWeight,
        blood_pressure_sys: bloodPressureSys ? Number(bloodPressureSys) : null,
        blood_pressure_dia: bloodPressureDia ? Number(bloodPressureDia) : null,
        blood_pressure:
          bloodPressureSys && bloodPressureDia
            ? `${bloodPressureSys}/${bloodPressureDia}`
            : null,
        pulse_bpm: pulse ? Number(pulse) : null,
        blood_sugar: sugar ? Number(sugar) : null,
        hunger: hunger === "true",
        hunger_scale: Number(hungerScale),
        motivation,
        well_being: wellBeing,
        sleep_quality: sleepQuality,
        stool_quality: stoolQuality,
        stool_times: Number(stoolTimes),
        stool_every_days: Number(stoolEveryDays),
        digestion,
        additional_comment: comment || null,
      };

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
      setHunger("false");
      setHungerScale("1");
      setStoolTimes("1");
      setStoolEveryDays("1");
      setDigestion("Normal");
      setComment("");
      setCheckinFiles(null);
    } finally {
      setSavingCheckin(false);
    }
  };

  return (
    <AppShell role="athlete">
      <main className="page">
        <Header title="Check-in" subtitle="Deinen Check-in schnell erfassen" />

        {info ? <div style={noticeStyle(info)}>{info}</div> : null}

        {loading ? (
          <section className="card">
            <p className="muted">Lade Daten...</p>
          </section>
        ) : (
          <section className="card">
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
              <option value="false">Nein</option>
              <option value="true">Ja</option>
            </select>

            <label>Hunger-Skala (1-10)</label>
            <select
              value={hungerScale}
              onChange={(e) => setHungerScale(e.target.value)}
              disabled={hunger !== "true"}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <label>Motivation</label>
            <select value={motivation} onChange={(e) => setMotivation(e.target.value)}>
              <option value="sehr_niedrig">Sehr niedrig</option>
              <option value="niedrig">Niedrig</option>
              <option value="mittel">Mittel</option>
              <option value="hoch">Hoch</option>
              <option value="sehr_hoch">Sehr hoch</option>
            </select>

            <label>Wohlbefinden</label>
            <select value={wellBeing} onChange={(e) => setWellBeing(e.target.value)}>
              <option value="sehr_schlecht">Sehr schlecht</option>
              <option value="schlecht">Schlecht</option>
              <option value="mittel">Mittel</option>
              <option value="gut">Gut</option>
              <option value="sehr_gut">Sehr gut</option>
            </select>

            <label>Schlaf</label>
            <select value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value)}>
              <option value="sehr_schlecht">Sehr schlecht</option>
              <option value="schlecht">Schlecht</option>
              <option value="mittel">Mittel</option>
              <option value="gut">Gut</option>
              <option value="sehr_gut">Sehr gut</option>
            </select>

            <label>Stuhlgang</label>
            <select value={stoolQuality} onChange={(e) => setStoolQuality(e.target.value)}>
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

            <div className="button-row" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={saveCheckin} disabled={savingCheckin}>
                {savingCheckin ? "Speichere..." : "Check-in speichern"}
              </button>
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}
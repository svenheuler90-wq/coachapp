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

export default function CoachCheckinsPage() {
  const router = useRouter();

  const [me, setMe] = useState<any>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [athletesMap, setAthletesMap] = useState<Record<string, any>>({});
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

      const { data: athletes } = await athleteQuery.order("full_name", { ascending: true });
      const athleteList = athletes || [];
      const athleteIds = athleteList.map((a) => a.id);

      const map: Record<string, any> = {};
      for (const athlete of athleteList) {
        map[athlete.id] = athlete;
      }
      setAthletesMap(map);

      if (athleteIds.length === 0) {
        setCheckins([]);
        setLoading(false);
        return;
      }

      const [{ data: checkinData }, { data: photosData }] = await Promise.all([
  supabase
    .from("checkins")
    .select("*")
    .in("athlete_id", athleteIds)
    .order("created_at", { ascending: false }),
  supabase
    .from("progress_photos")
    .select("*")
    .in("athlete_id", athleteIds)
    .order("created_at", { ascending: false }),
]);

setCheckins(checkinData || []);
setPhotos(photosData || []);
setLoading(false);
    };

    init();
  }, [router]);

  return (
    <AppShell role={me?.role === "admin" ? "admin" : "coach"}>
      <main className="page">
        <Header title="Check-ins" subtitle="Neue und vergangene Check-ins deiner Athleten" />

        {loading ? (
          <section className="card">
            <p className="muted">Lade Check-ins...</p>
          </section>
        ) : checkins.length === 0 ? (
          <section className="card">
            <p className="muted">Keine Check-ins vorhanden.</p>
          </section>
        ) : (
          <section className="grid two">
            {checkins.map((checkin) => {
              const athlete = athletesMap[checkin.athlete_id];
              const linkedPhotos = photos.filter((photo) => photo.checkin_id === checkin.id);

              return (
                <div key={checkin.id} className="card">
                  <strong>{athlete?.full_name || "-"}</strong>
                  <div className="muted">
                    {formatDateTimeDE(checkin.local_datetime || checkin.created_at || checkin.date)}
                  </div>
                  
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

{checkin.pulse_bpm != null ? (
  <div className="muted">Puls: {checkin.pulse_bpm} bpm</div>
) : null}

{checkin.blood_sugar != null ? (
  <div className="muted">Blutzucker: {checkin.blood_sugar} mg/dL</div>
) : null}

{typeof checkin.hunger === "boolean" ? (
  <div className="muted">Hunger: {checkin.hunger ? "Ja" : "Nein"}</div>
) : null}

{checkin.hunger_scale != null ? (
  <div className="muted">Hunger-Skala: {checkin.hunger_scale}</div>
) : null}

{checkin.stool_quality ? (
  <div className="muted">Stuhlgang: {checkin.stool_quality}</div>
) : null}

{checkin.stool_times != null ? (
  <div className="muted">Wie oft: {checkin.stool_times}</div>
) : null}

{checkin.stool_every_days != null ? (
  <div className="muted">Alle wie viele Tage: {checkin.stool_every_days}</div>
) : null}

{checkin.digestion ? (
  <div className="muted">Verdauung: {checkin.digestion}</div>
) : null}

{checkin.additional_comment ? (
  <div className="muted">Kommentar: {checkin.additional_comment}</div>
) : null}
  
                  {athlete?.id ? (
                    <div className="button-row" style={{ marginTop: 12 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => router.push(`/coach?athlete=${athlete.id}`)}
                      >
                        Öffnen
                      </button>
                    </div>
                  ) : null}
                  {renderPhotoGallery(linkedPhotos)}
                </div>
              );
            })}
          </section>
        )}
      </main>
    </AppShell>
  );
}
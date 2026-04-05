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

export default function CoachCheckinsPage() {
  const router = useRouter();

  const [me, setMe] = useState<any>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
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

      const { data: checkinData } = await supabase
        .from("checkins")
        .select("*")
        .in("athlete_id", athleteIds)
        .order("created_at", { ascending: false });

      setCheckins(checkinData || []);
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

              return (
                <div key={checkin.id} className="card">
                  <strong>{athlete?.full_name || "-"}</strong>
                  <div className="muted">
                    {formatDateTimeDE(checkin.local_datetime || checkin.created_at || checkin.date)}
                  </div>
                  <div className="muted">Gewicht: {checkin.weight_kg ?? "-"} kg</div>
                  <div className="muted">
                    Blutdruck:{" "}
                    {checkin.blood_pressure_sys && checkin.blood_pressure_dia
                      ? `${checkin.blood_pressure_sys}/${checkin.blood_pressure_dia}`
                      : checkin.blood_pressure || "-"}
                  </div>
                  <div className="muted">Puls: {checkin.pulse_bpm ?? "-"} bpm</div>
                  <div className="muted">Blutzucker: {checkin.blood_sugar ?? "-"} mg/dL</div>
                  <div className="muted">Kommentar: {checkin.additional_comment || "-"}</div>

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
                </div>
              );
            })}
          </section>
        )}
      </main>
    </AppShell>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Header } from "@/components/Header";
import { supabase } from "@/lib/supabase";

function daysUntilNextCheckin(weekday: number, intervalDays: number) {
  const now = new Date();
  const today = now.getDay();
  let diff = weekday - today;
  if (diff < 0) diff += 7;
  if (diff === 0) diff = 7;
  return Math.min(diff, intervalDays || 7);
}

export default function AthleteProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <AppShell role="athlete">
      <main className="page">
        <Header title="Profil" subtitle="Deine Daten und Einstellungen" />

        {loading ? (
          <section className="card">
            <p className="muted">Lade Profil...</p>
          </section>
        ) : profile ? (
          <>
            <section className="grid two">
              <div className="card">
                <div className="muted">Name</div>
                <strong>{profile.full_name || "-"}</strong>
              </div>

              <div className="card">
                <div className="muted">E-Mail</div>
                <strong>{profile.email || "-"}</strong>
              </div>

              <div className="card">
                <div className="muted">Ziel</div>
                <strong>{profile.goal || "-"}</strong>
              </div>

              <div className="card">
                <div className="muted">Phase</div>
                <strong>{profile.current_phase || "-"}</strong>
              </div>

              <div className="card">
                <div className="muted">Check-in Intervall</div>
                <strong>alle {profile.checkin_interval_days || 7} Tage</strong>
              </div>

              <div className="card">
                <div className="muted">Nächster Check-in</div>
                <strong>
                  in{" "}
                  {daysUntilNextCheckin(
                    Number(profile.checkin_weekday ?? 0),
                    Number(profile.checkin_interval_days ?? 7)
                  )}{" "}
                  Tagen
                </strong>
              </div>
            </section>

            <section className="card" style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            </section>
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
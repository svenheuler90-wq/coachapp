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

export default function AthletePlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
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

      const { data: plansData } = await supabase
        .from("plans")
        .select("*")
        .eq("athlete_id", me.id)
        .order("created_at", { ascending: false });

      setPlans(plansData || []);
      setLoading(false);
    };

    init();
  }, [router]);

  return (
    <AppShell role="athlete">
      <main className="page">
        <Header title="Pläne" subtitle="Trainings- und Ernährungspläne" />

        {loading ? (
          <section className="card">
            <p className="muted">Lade Pläne...</p>
          </section>
        ) : plans.length === 0 ? (
          <section className="card">
            <p className="muted">Keine Pläne vorhanden.</p>
          </section>
        ) : (
          <section className="grid two">
            {plans.map((plan) => (
              <div key={plan.id} className="card">
                <strong>{plan.file_name || plan.title || "Plan"}</strong>
                <div className="muted">Typ: {plan.type || "-"}</div>
                <div className="muted">
                  Hochgeladen:{" "}
                  {plan.local_created_at || formatDateTimeDE(plan.created_at)}
                </div>

                {plan.note ? (
                  <div className="muted" style={{ marginTop: 8 }}>
                    Bemerkung: {plan.note}
                  </div>
                ) : null}

                <div className="button-row" style={{ marginTop: 12 }}>
                  {plan.file_url ? (
                    <a
                      className="btn btn-primary"
                      href={plan.file_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Datei öffnen
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </AppShell>
  );
}
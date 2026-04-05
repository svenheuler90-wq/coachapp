"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerServiceWorker, subscribeToPush } from "@/lib/push";

export default function PushEnableButton() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => {
    registerServiceWorker().catch(() => {});
  }, []);

  const enablePush = async () => {
    setLoading(true);
    setInfo("");

    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.user) {
        setInfo("Bitte zuerst einloggen.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const subscription = await subscribeToPush();
      const subJson = subscription.toJSON();

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.user.id,
          role: profile?.role || null,
          subscription: subJson,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Push konnte nicht aktiviert werden");
      }

      setEnabled(true);
      setInfo("Push-Benachrichtigungen aktiviert.");
    } catch (error: any) {
      setInfo(error?.message || "Push konnte nicht aktiviert werden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2>Push-Benachrichtigungen</h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        Aktiviere Push für neue Nachrichten, Pläne und Check-ins.
      </p>

      <div className="button-row">
        <button className="btn btn-primary" onClick={enablePush} disabled={loading || enabled}>
          {enabled ? "Aktiviert" : loading ? "Aktiviere..." : "Push aktivieren"}
        </button>
      </div>

      {info ? <p className="muted" style={{ marginTop: 10 }}>{info}</p> : null}
    </div>
  );
}
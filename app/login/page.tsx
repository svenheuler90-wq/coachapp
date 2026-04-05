"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "register";

const GOALS = [
  "Gesundheit",
  "Mobilität",
  "Fettabbau",
  "Muskelaufbau",
  "Wettkampf",
];

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");

  const [fullName, setFullName] = useState("");
  const [goal, setGoal] = useState("Gesundheit");
  const [height, setHeight] = useState("");
  const [startWeight, setStartWeight] = useState("");
  const [coachCode, setCoachCode] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const routeByRole = (role?: string | null) => {
    if (role === "admin" || role === "coach") {
      router.replace("/dashboard");
      return;
    }

    if (role === "athlete") {
      router.replace("/athlete");
      return;
    }

    router.replace("/login");
  };

  useEffect(() => {
    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      routeByRole(profile?.role);
    };

    boot();
  }, [router]);

  const register = async () => {
    setLoading(true);
    setMessage("");

    try {
      if (!fullName.trim() || !email.trim() || !password.trim() || !coachCode.trim()) {
        setMessage("Bitte Name, E-Mail, Passwort und Coach-Code ausfüllen.");
        return;
      }

      const normalizedCode = coachCode.trim().toUpperCase();

      const { data: inviteRows, error: inviteError } = await supabase
        .from("coach_invite_codes")
        .select("coach_id, code, active")
        .eq("code", normalizedCode)
        .eq("active", true)
        .limit(1);

      if (inviteError) {
        setMessage(inviteError.message);
        return;
      }

      const invite = inviteRows?.[0];

      if (!invite?.coach_id) {
        setMessage("Coach-Code ungültig.");
        return;
      }

      const cleanEmail = email.trim().toLowerCase();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (signUpError) {
        setMessage(signUpError.message);
        return;
      }

      if (!signUpData.user) {
        setMessage("Registrierung fehlgeschlagen.");
        return;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: signUpData.user.id,
        full_name: fullName.trim(),
        email: cleanEmail,
        role: "athlete",
        goal: goal || null,
        height: height ? Number(height) : null,
        start_weight: startWeight ? Number(startWeight) : null,
        coach_id: invite.coach_id,
      });

      if (profileError) {
        setMessage(profileError.message);
        return;
      }

      setMessage("Registrierung erfolgreich. Jetzt einloggen.");

      setMode("login");
      setFullName("");
      setGoal("Gesundheit");
      setHeight("");
      setStartWeight("");
      setCoachCode("");
      setEmail("");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setLoading(true);
    setMessage("");

    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        setMessage(profileError.message);
        return;
      }

      routeByRole(profile?.role);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page narrow">
      <section className="hero card">
        <div className="hero-badge">CoachFlow</div>
        <h1>Login & Registrierung</h1>
        <p className="hero-text">
          Coaches und Admin loggen sich ein. Athleten registrieren sich mit ihrem persönlichen Coach-Code.
        </p>
        <div className="button-row">
          <Link href="/" className="btn btn-secondary">
            ← Startseite
          </Link>
        </div>
      </section>

      <section className="card form-card">
        <div className="button-row">
          <button
            className={mode === "login" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>

          <button
            className={mode === "register" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setMode("register")}
            type="button"
          >
            Registrierung
          </button>
        </div>

        {mode === "register" ? (
          <>
            <label>Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Name"
            />

            <label>Ziel</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOALS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <div className="grid two">
              <div>
                <label>Größe (cm)</label>
                <input
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Größe"
                />
              </div>

              <div>
                <label>Startgewicht (kg)</label>
                <input
                  value={startWeight}
                  onChange={(e) => setStartWeight(e.target.value)}
                  placeholder="Startgewicht"
                />
              </div>
            </div>

            <label>Coach-Code</label>
            <input
              value={coachCode}
              onChange={(e) => setCoachCode(e.target.value)}
              placeholder="Coach-Code eingeben"
            />
          </>
        ) : null}

        <label>E-Mail</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
        />

        <label>Passwort</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passwort"
        />

        <div className="button-row">
          {mode === "register" ? (
            <button className="btn btn-primary" onClick={register} disabled={loading}>
              {loading ? "Bitte warten..." : "Registrieren"}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={login} disabled={loading}>
              {loading ? "Bitte warten..." : "Einloggen"}
            </button>
          )}
        </div>

        {message ? <div className="notice">{message}</div> : null}
      </section>
    </main>
  );
}
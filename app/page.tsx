import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero card">
        <div className="hero-badge">CoachFlow</div>
        <h1>Coaching System</h1>
        <p className="hero-text">
          Login, Athletenverwaltung, Check-ins, Pläne, Nachrichten und Fortschrittsbilder in einer Oberfläche.
        </p>

        <div className="button-row">
          <Link href="/login" className="btn btn-primary">
            Login / Registrierung
          </Link>
          <Link href="/dashboard" className="btn btn-secondary">
            Coach Dashboard
          </Link>
          <Link href="/athlete" className="btn btn-secondary">
            Athleten Bereich
          </Link>
        </div>
      </section>
    </main>
  );
}
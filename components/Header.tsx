import Link from "next/link";

export function Header({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="hero card">
      <div className="space-between">
        <div>
          <div className="hero-badge">CoachFlow</div>
          <h1>{title}</h1>
          {subtitle ? <p className="hero-text">{subtitle}</p> : null}
        </div>
        {actions ? <div className="button-row">{actions}</div> : null}
      </div>
    </section>
  );
}

export function BackToDashboard() {
  return (
    <Link href="/dashboard" className="btn btn-secondary">
      ← Zurück zum Dashboard
    </Link>
  );
}
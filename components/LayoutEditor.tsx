"use client";

import { LayoutItem, moveItemDown, moveItemUp, toggleItemWidth } from "@/lib/layout";

type Props = {
  isAdmin: boolean;
  editing: boolean;
  setEditing: (value: boolean) => void;
  layout: LayoutItem[];
  setLayout: (layout: LayoutItem[]) => void;
  onSave: () => Promise<void> | void;
  labels: Record<string, string>;
  saving?: boolean;
};

export default function LayoutEditor({
  isAdmin,
  editing,
  setEditing,
  layout,
  setLayout,
  onSave,
  labels,
  saving = false,
}: Props) {
  if (!isAdmin) return null;

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginBottom: 6 }}>Ansicht bearbeiten</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Kacheln hoch/runter sortieren und halbe oder ganze Breite festlegen.
          </p>
        </div>

        {!editing ? (
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>
            Ansicht bearbeiten
          </button>
        ) : (
          <div className="button-row">
            <button
              className="btn btn-primary"
              onClick={async () => {
                await onSave();
                setEditing(false);
              }}
              disabled={saving}
            >
              {saving ? "Speichert..." : "Speichern"}
            </button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>
              Abbrechen
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="stack" style={{ marginTop: 16 }}>
          {layout.map((item, index) => (
            <div
              key={item.id}
              className="item"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong>{labels[item.id] || item.id}</strong>
                <div className="muted">
                  Breite: {item.width === "full" ? "ganze Seite" : "halbe Seite"}
                </div>
              </div>

              <div className="button-row">
                <button
                  className="btn btn-secondary"
                  onClick={() => setLayout(moveItemUp(layout, item.id))}
                  disabled={index === 0}
                >
                  Hoch
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => setLayout(moveItemDown(layout, item.id))}
                  disabled={index === layout.length - 1}
                >
                  Runter
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => setLayout(toggleItemWidth(layout, item.id))}
                >
                  {item.width === "half" ? "Ganz" : "Halb"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
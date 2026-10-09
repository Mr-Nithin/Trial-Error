"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { BackLink } from "@/components/ui";
import { useToast } from "@/components/useToast";
import { projects } from "@/lib/data";

export default function ArchivedPage() {
  const [items, setItems] = useState(projects.filter((p) => p.archived));
  const toast = useToast();

  const drop = (id: string, message: string) => {
    const snapshot = items;
    setItems(items.filter((p) => p.id !== id));
    toast.show(message, () => setItems(snapshot));
  };

  return (
    <main className="screen">
      <header className="header" style={{ gap: 10 }}>
        <div className="row">
          <BackLink href="/projects" label="Back to projects" />
          <h1 className="title md">Archived</h1>
        </div>
        <div className="small muted" style={{ lineHeight: 1.5 }}>
          Archived projects keep every version and run. They don’t count toward your active list.
        </div>
      </header>

      <div className="content">
        {items.length === 0 && (
          <div className="card center muted small" style={{ padding: 28 }}>
            Nothing archived.
          </div>
        )}
        {items.map((p) => (
          <div key={p.id} className="card lg" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 10 }}>
              <div className="emoji-tile" style={{ background: p.tint, filter: "grayscale(0.6)" }}>
                {p.emoji}
              </div>
              <div className="grow">
                <div className="name muted">{p.name}</div>
                <div className="xs faint">
                  {p.category} · {p.archived}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn secondary sm grow" onClick={() => drop(p.id, `“${p.name}” restored to projects`)}>
                <Icon name="restore" size={16} /> Restore
              </button>
              <button
                type="button"
                className="btn danger sm"
                style={{ width: 40, padding: 0 }}
                aria-label={`Delete ${p.name}`}
                onClick={() => drop(p.id, `“${p.name}” deleted`)}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {toast.node}
    </main>
  );
}

"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { BackLink, ErrorState, Loading } from "@/components/ui";
import { useToast } from "@/components/useToast";
import { backend } from "@/lib/backend";
import type { ProjectSummary } from "@/lib/data";
import { refreshProject, useProjects } from "@/lib/hooks";
import { useAction } from "@/lib/useAction";

export default function ArchivedPage() {
  const { data: items, error, mutate } = useProjects(true);
  const [confirm, setConfirm] = useState<ProjectSummary | null>(null);
  const toast = useToast();
  const { run, busy } = useAction(toast.show);

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (!items) return <Loading />;

  const restore = (p: ProjectSummary) =>
    run(async () => {
      await backend.updateProject(p.id, { archived: false });
      await refreshProject(p.id);
      toast.show(`“${p.name}” restored to projects`, () =>
        void run(async () => {
          await backend.updateProject(p.id, { archived: true });
          await refreshProject(p.id);
        }),
      );
    });

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
              <button type="button" className="btn secondary sm grow" disabled={busy} onClick={() => restore(p)}>
                <Icon name="restore" size={16} /> Restore
              </button>
              <button type="button" className="btn danger sm" style={{ width: 40, padding: 0 }} aria-label={`Delete ${p.name}`} onClick={() => setConfirm(p)}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} label="Delete project">
        {confirm && (
          <div className="sheet-pad">
            <h2 className="title sm">Delete “{confirm.name}”?</h2>
            <p className="muted" style={{ margin: 0 }}>
              Removes {confirm.versionCount} versions and {confirm.runCount} runs permanently.
            </p>
            <button
              type="button"
              className="btn danger block"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await backend.deleteProject(confirm.id);
                  setConfirm(null);
                  await refreshProject(confirm.id);
                  toast.show(`“${confirm.name}” deleted`);
                })
              }
            >
              <Icon name="trash" size={18} /> Delete forever
            </button>
            <button type="button" className="btn secondary block" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        )}
      </Sheet>
      {toast.node}
    </main>
  );
}

"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Icon, MoreIcon } from "@/components/Icon";
import { Sheet, SheetItem } from "@/components/Sheet";
import { BackLink, GoalChips, OutputTiles, ScoreChip } from "@/components/ui";
import { useToast } from "@/components/useToast";
import type { Project, Version } from "@/lib/data";

type Mode = "actions" | "rename" | "delete";

export function VersionsTimeline({ project }: { project: Project }) {
  const [versions, setVersions] = useState(project.versions);
  const [active, setActive] = useState<Version | null>(null);
  const [mode, setMode] = useState<Mode>("actions");
  const [renameTo, setRenameTo] = useState("");
  const toast = useToast();

  const p = { ...project, versions };
  const best = versions.find((v) => v.status === "best");
  const runs = versions.reduce((n, v) => n + v.runs, 0);
  const base = `/projects/${project.id}`;
  const close = () => setActive(null);
  const label = (v: Version) => `V${v.number} · ${v.name}`;

  return (
    <main className="screen">
      <header className="header">
        <div className="row between">
          <BackLink href="/projects" label="Back to projects" />
          <span className="small muted">{project.category}</span>
          <Link href={`${base}/trends`} className="icon-btn" aria-label="Trends">
            <Icon name="compare" />
          </Link>
        </div>
        <h1 className="title">{project.name}</h1>
        <GoalChips goals={project.goals} />
        <div className="row small muted" style={{ gap: 16 }}>
          <span>{versions.length} versions</span>
          <span>{runs} runs total</span>
          {best && (
            <span className="green strong" style={{ marginLeft: "auto" }}>
              ★ V{best.number} is best
            </span>
          )}
        </div>
      </header>

      <div className="content" style={{ padding: 20, gap: 0 }}>
        <div className="timeline">
          {versions.map((v, i) => {
            const parent = versions.find((x) => x.id === v.parentId);
            const last = i === versions.length - 1;
            return (
              <Fragment key={v.id}>
                {parent && (
                  <div className="tl-branch">
                    <div className="tl-rail" />
                    <span className="tl-label">
                      branched from V{parent.number} · step {v.branchedAtStep}
                    </span>
                  </div>
                )}
                <div className="tl-item">
                  <div className="tl-rail">
                    <div className={`tl-dot${v.status === "best" ? " best" : v.status === "in-progress" ? " wip" : ""}`} />
                    {!last && <div className="tl-line" />}
                  </div>
                  <div className={`card${v.status === "best" ? " best" : v.status === "in-progress" ? " wip" : ""}`}>
                    <div className="row" style={{ gap: 8 }}>
                      <Link href={`${base}/versions/${v.id}`} className="grow" style={{ textDecoration: "none", color: "inherit" }}>
                        <div className="name sm">{label(v)}</div>
                        <div className="xs muted" style={{ marginTop: 3 }}>
                          {v.summary}
                        </div>
                      </Link>
                      <ScoreChip project={p} version={v} />
                      <button
                        type="button"
                        className={`icon-btn sm${v.status === "best" ? " tint-green" : ""}`}
                        aria-label={`Options for ${label(v)}`}
                        onClick={() => {
                          setActive(v);
                          setMode("actions");
                        }}
                      >
                        <MoreIcon />
                      </button>
                    </div>
                    {v.status !== "in-progress" && <OutputTiles goals={project.goals} outputs={v.outputs} />}
                    <div className="xs muted">
                      {v.status === "in-progress" ? v.changeNote : `Last run: ${v.lastRun}${v.changeNote ? ` · ${v.changeNote}` : ""}`}
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
        {versions.length === 0 && (
          <div className="card center" style={{ padding: 24 }}>
            <div className="name">No versions yet</div>
            <div className="small muted">Record your first run to create V1.</div>
          </div>
        )}
      </div>

      <div className="footer">
        <div className="row">
          {best ? (
            <Link href={`${base}/versions/${best.id}/run`} className="btn primary grow">
              <Icon name="play" size={16} /> Repeat V{best.number} today
            </Link>
          ) : (
            <span className="grow" />
          )}
          <Link href={`${base}/compare`} className="btn secondary" style={{ width: 120 }}>
            Compare
          </Link>
        </div>
      </div>

      <Sheet open={!!active} onClose={close} label="Version options">
        {active && (
          <>
            <div className="sheet-head">
              <span className={`tl-dot${active.status === "best" ? " best" : active.status === "in-progress" ? " wip" : ""}`} style={{ marginTop: 0 }} />
              <div>
                <div className="name" style={{ fontSize: 17 }}>
                  {label(active)}
                </div>
                <div className="small muted">
                  {active.status === "best" ? "★ Best · " : ""}
                  {active.runs} runs · last run {active.lastRun}
                </div>
              </div>
            </div>

            {mode === "actions" && (
              <div className="sheet-body">
                <SheetItem
                  icon="edit"
                  label="Rename"
                  onClick={() => {
                    setRenameTo(active.name);
                    setMode("rename");
                  }}
                />
                <SheetItem
                  icon="copy"
                  label="Duplicate version"
                  onClick={() => {
                    const n = Math.max(...versions.map((v) => v.number)) + 1;
                    setVersions([...versions, { ...active, id: `v${n}`, number: n, name: `${active.name} (copy)`, status: "in-progress", runs: 0, parentId: active.id, branchedAtStep: active.steps.length, summary: `Copy of V${active.number} · ${active.steps.length} steps · 0 runs`, changeNote: "Not run yet" }]);
                    close();
                    toast.show(`Duplicated as V${n}`);
                  }}
                />
                <SheetItem
                  icon="star"
                  label="Set as best version"
                  tone="accent"
                  trailing={active.status === "best" ? <span className="xs green strong">Current ★</span> : undefined}
                  onClick={() => {
                    setVersions(versions.map((v) => ({ ...v, status: v.id === active.id ? "best" : v.status === "best" ? "done" : v.status })));
                    close();
                    toast.show(`V${active.number} is now your best version`);
                  }}
                />
                <SheetItem icon="branch" label="Branch from a step…" chevron href={`${base}/versions/${active.id}/branch`} />
                <SheetItem icon="compare" label="Compare with…" chevron href={`${base}/compare?b=${active.id}`} />
                <div className="divider" />
                <SheetItem icon="trash" label="Delete version" tone="danger" onClick={() => setMode("delete")} />
                <div className="sheet-note">Removes this version and its {active.runs} run records. Cannot be undone.</div>
              </div>
            )}

            {mode === "rename" && (
              <form
                className="sheet-pad"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!renameTo.trim()) return;
                  setVersions(versions.map((v) => (v.id === active.id ? { ...v, name: renameTo.trim() } : v)));
                  close();
                  toast.show("Version renamed");
                }}
              >
                <label className="field">
                  <span>Version name</span>
                  <input className="input" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} autoFocus />
                </label>
                <button type="submit" className="btn primary block" disabled={!renameTo.trim()}>
                  Save
                </button>
                <button type="button" className="btn secondary block" onClick={() => setMode("actions")}>
                  Back
                </button>
              </form>
            )}

            {mode === "delete" && (
              <div className="sheet-pad">
                <h2 className="title sm">Delete {label(active)}?</h2>
                <p className="muted" style={{ margin: 0 }}>
                  Its {active.runs} runs are removed too. Versions branched from it keep their inherited steps.
                </p>
                <button
                  type="button"
                  className="btn danger block"
                  onClick={() => {
                    const snapshot = versions;
                    setVersions(versions.filter((v) => v.id !== active.id));
                    close();
                    toast.show(`V${active.number} deleted`, () => setVersions(snapshot));
                  }}
                >
                  <Icon name="trash" size={18} /> Delete version
                </button>
                <button type="button" className="btn secondary block" onClick={() => setMode("actions")}>
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </Sheet>
      {toast.node}
    </main>
  );
}

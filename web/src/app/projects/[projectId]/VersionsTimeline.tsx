"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { Icon, MoreIcon } from "@/components/Icon";
import { Sheet, SheetItem } from "@/components/Sheet";
import { BackLink, GoalChips, OutputTiles, ScoreChip } from "@/components/ui";
import { useToast } from "@/components/useToast";
import { backend, isMock } from "@/lib/backend";
import type { Project, Version } from "@/lib/data";
import { refreshProject } from "@/lib/hooks";
import { useAction } from "@/lib/useAction";

type Mode = "actions" | "rename" | "delete";

export function VersionsTimeline({ project }: { project: Project }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("actions");
  const [renameTo, setRenameTo] = useState("");
  const [newName, setNewName] = useState<string | null>(null);
  const toast = useToast();
  const { run, busy } = useAction(toast.show);

  const versions = project.versions;
  const active = versions.find((v) => v.id === activeId) ?? null;
  const best = versions.find((v) => v.status === "best");
  const latest = versions[versions.length - 1];
  const runs = versions.reduce((n, v) => n + v.runs, 0);
  const base = `/projects/${project.id}`;
  const close = () => setActiveId(null);
  const label = (v: Version) => `V${v.number} · ${v.name}`;
  const act = (fn: () => Promise<unknown>, message: string) =>
    run(async () => {
      await fn();
      close();
      await refreshProject(project.id);
      toast.show(message);
    });

  const createVersion = (name: string) =>
    run(async () => {
      const v = await backend.createVersion(project.id, { name });
      await refreshProject(project.id);
      setNewName(null);
      router.push(isMock ? base : `${base}/versions/${v.id}`);
    });

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
        {project.goals.length > 0 && <GoalChips goals={project.goals} />}
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
                      {v.branchedAtStep ? `branched from V${parent.number} · step ${v.branchedAtStep}` : `copied from V${parent.number}`}
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
                      <ScoreChip project={project} version={v} />
                      <button
                        type="button"
                        className={`icon-btn sm${v.status === "best" ? " tint-green" : ""}`}
                        aria-label={`Options for ${label(v)}`}
                        onClick={() => {
                          setActiveId(v.id);
                          setMode("actions");
                        }}
                      >
                        <MoreIcon />
                      </button>
                    </div>
                    {v.runs > 0 && project.goals.length > 0 && <OutputTiles goals={project.goals} outputs={v.outputs} />}
                    <div className="xs muted">
                      {v.runs === 0 ? (v.changeNote ?? "Not run yet") : `Last run: ${v.lastRun}${v.changeNote ? ` · ${v.changeNote}` : ""}`}
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>

        {versions.length === 0 && (
          <div className="card center" style={{ padding: 24, gap: 12 }}>
            <div className="name">No versions yet</div>
            <div className="small muted">Start V1 and record each step as you go.</div>
            <button type="button" className="btn primary block" disabled={busy} onClick={() => createVersion("First try")}>
              <Icon name="plus" stroke={2.5} /> Start V1
            </button>
          </div>
        )}

        {versions.length > 0 && (
          <button type="button" className="btn dashed block" style={{ marginTop: 12, height: 48 }} onClick={() => setNewName("")}>
            <Icon name="plus" stroke={2.5} /> New version from scratch
          </button>
        )}
      </div>

      {versions.length > 0 && (
        <div className="footer">
          <div className="row">
            <Link href={`${base}/versions/${(best ?? latest).id}/run`} className="btn primary grow">
              <Icon name="play" size={16} /> {best ? `Repeat V${best.number} today` : `Run V${latest.number}`}
            </Link>
            <Link href={`${base}/compare`} className="btn secondary" style={{ width: 120 }}>
              Compare
            </Link>
          </div>
        </div>
      )}

      <Sheet open={newName !== null} onClose={() => setNewName(null)} label="New version">
        <form
          className="sheet-pad"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName?.trim()) createVersion(newName.trim());
          }}
        >
          <h2 className="title sm">New version from scratch</h2>
          <p className="small muted" style={{ margin: 0 }}>
            To keep earlier steps, open a version and use “Try again from…” instead.
          </p>
          <label className="field">
            <span>Version name</span>
            <input className="input" value={newName ?? ""} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Oat pancakes" maxLength={80} autoFocus />
          </label>
          <button type="submit" className="btn primary block" disabled={!newName?.trim() || busy}>
            Create V{Math.max(0, ...versions.map((v) => v.number)) + 1}
          </button>
        </form>
      </Sheet>

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
                <SheetItem icon="copy" label="Duplicate version" onClick={() => act(() => backend.duplicateVersion(active.id), `Duplicated V${active.number}`)} />
                <SheetItem
                  icon="star"
                  label="Set as best version"
                  tone="accent"
                  trailing={active.status === "best" ? <span className="xs green strong">Current ★</span> : undefined}
                  onClick={() => act(() => backend.updateVersion(active.id, { best: true }), `V${active.number} is now your best version`)}
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
                  if (renameTo.trim()) act(() => backend.updateVersion(active.id, { name: renameTo.trim() }), "Version renamed");
                }}
              >
                <label className="field">
                  <span>Version name</span>
                  <input className="input" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} maxLength={80} autoFocus />
                </label>
                <button type="submit" className="btn primary block" disabled={!renameTo.trim() || busy}>
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
                <button type="button" className="btn danger block" disabled={busy} onClick={() => act(() => backend.deleteVersion(active.id), `V${active.number} deleted`)}>
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

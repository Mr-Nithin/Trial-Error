"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, MoreIcon } from "@/components/Icon";
import { Sheet, SheetItem } from "@/components/Sheet";
import { BackLink, OriginChip, OutputTiles } from "@/components/ui";
import { useToast } from "@/components/useToast";
import type { Project, Step, Version } from "@/lib/data";

export function StepsList({ project, version }: { project: Project; version: Version }) {
  const [steps, setSteps] = useState(version.steps);
  const [active, setActive] = useState<{ step: Step; parent?: Step } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  const base = `/projects/${project.id}/versions/${version.id}`;
  const parent = project.versions.find((v) => v.id === version.parentId);
  const showOrigin = !!version.parentId;
  const close = () => {
    setActive(null);
    setConfirmDelete(false);
  };

  const move = (dir: -1 | 1) => {
    if (!active || active.parent) return;
    const i = steps.findIndex((s) => s.id === active.step.id);
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next.map((s, n) => ({ ...s, label: String(n + 1) })));
    close();
    toast.show(`Moved “${active.step.title}” ${dir < 0 ? "up" : "down"}`);
  };

  const remove = () => {
    if (!active) return;
    const snapshot = steps;
    const { step, parent: p } = active;
    setSteps(
      p
        ? steps.map((s) => (s.id === p.id ? { ...s, subSteps: s.subSteps?.filter((x) => x.id !== step.id) } : s))
        : steps.filter((s) => s.id !== step.id).map((s, n) => ({ ...s, label: String(n + 1) })),
    );
    close();
    toast.show(`Step “${step.title}” deleted`, () => setSteps(snapshot));
  };

  const index = active && !active.parent ? steps.findIndex((s) => s.id === active.step.id) : -1;

  return (
    <main className="screen">
      <header className="header" style={{ gap: 8 }}>
        <div className="row">
          <BackLink href={`/projects/${project.id}`} label="Back to project" />
          <span className="small muted">{project.name}</span>
        </div>
        <h1 className="title" style={{ fontSize: 26 }}>
          V{version.number} · {version.name}
        </h1>
        <div className="small muted">
          {parent ? `Tried again from V${parent.number} at step ${version.branchedAtStep}` : "From scratch"} · {version.runs} runs · last {version.lastRun}
        </div>
      </header>

      <div className="content" style={{ gap: 10 }}>
        {steps.map((s) =>
          s.origin === "pending" ? (
            <Link key={s.id} href={`${base}/steps/${s.id}`} className="card pending" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
              <div className="thumb green" style={{ background: "var(--green-soft)" }}>
                <Icon name="camera" size={24} />
              </div>
              <div className="grow">
                <div className="strong">
                  {s.label} · {s.title}
                </div>
                <div className="small green">Tap to record now</div>
              </div>
            </Link>
          ) : (
            <div key={s.id} className={`card${s.origin === "changed" && showOrigin ? " changed" : ""}`} style={{ padding: 12 }}>
              <div className="row">
                <Link href={`${base}/steps/${s.id}`} className="row grow" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="thumb" style={{ background: s.photo ?? "var(--chip)" }}>
                    photo
                  </div>
                  <div className="grow">
                    <div className="strong">
                      {s.label} · {s.title}
                    </div>
                    <div className="small muted">{s.detail}</div>
                  </div>
                </Link>
                {showOrigin && <OriginChip origin={s.origin} fromVersion={s.fromVersion} />}
                <button
                  type="button"
                  className={`icon-btn sm${s.origin === "changed" && showOrigin ? " tint-amber" : ""}`}
                  aria-label={`Options for step ${s.label}`}
                  onClick={() => setActive({ step: s })}
                >
                  <MoreIcon size={16} />
                </button>
              </div>
              {s.subSteps?.map((sub) => (
                <div key={sub.id} className="sub-step">
                  <div className="grow">
                    <div className="strong" style={{ fontSize: 14 }}>
                      {sub.label} · {sub.title}
                    </div>
                    <div className="small muted">{sub.detail}</div>
                  </div>
                  {showOrigin && <OriginChip origin={sub.origin} />}
                  <button type="button" className="icon-btn xs tint-green" aria-label={`Options for step ${sub.label}`} onClick={() => setActive({ step: sub, parent: s })}>
                    <MoreIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          ),
        )}
        <Link href={`${base}/steps/new`} className="btn secondary block" style={{ height: 48, background: "transparent" }}>
          <Icon name="plus" /> Add step
        </Link>
      </div>

      <div className="footer">
        <OutputTiles goals={project.goals} outputs={version.outputs} />
        <div className="row">
          <Link href={`${base}/run`} className="btn primary grow">
            <Icon name="play" size={16} /> Start run
          </Link>
          <Link href={`${base}/branch`} className="btn dark grow">
            <Icon name="branch" size={18} /> Try again from…
          </Link>
        </div>
      </div>

      <Sheet open={!!active} onClose={close} label="Step options">
        {active && (
          <>
            <div className="sheet-head">
              <div className="thumb" style={{ width: 44, height: 44, background: active.step.photo ?? "var(--chip)" }} />
              <div>
                <div className="name">
                  {active.step.label} · {active.step.title}
                </div>
                <div className="small muted">
                  {active.step.detail}
                  {active.step.origin === "changed" ? ` · changed in V${version.number}` : ""}
                </div>
              </div>
            </div>
            {confirmDelete ? (
              <div className="sheet-pad">
                <h2 className="title sm">Delete step “{active.step.title}”?</h2>
                <p className="muted" style={{ margin: 0 }}>
                  It’s removed from V{version.number} only. Earlier versions keep their copy.
                </p>
                <button type="button" className="btn danger block" onClick={remove}>
                  <Icon name="trash" size={18} /> Delete step
                </button>
                <button type="button" className="btn secondary block" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="sheet-body">
                <SheetItem icon="edit" label="Edit notes & measurements" href={`${base}/steps/${active.step.id}`} />
                <SheetItem icon="camera" label="Re-record photo / video" href={`${base}/steps/${active.step.id}?camera=1`} />
                {!active.parent && <SheetItem icon="plus" label="Add sub-step" href={`${base}/steps/new?parent=${active.step.id}`} />}
                <SheetItem icon="branch" label="Branch from here → new version" tone="accent" href={`${base}/branch?from=${active.parent?.id ?? active.step.id}`} />
                {!active.parent && (
                  <>
                    <div className="divider" />
                    <div className="row" style={{ gap: 8, padding: "2px 0" }}>
                      <button type="button" className="btn secondary sm grow" style={{ background: "var(--bg)", border: "none" }} disabled={index <= 0} onClick={() => move(-1)}>
                        <Icon name="up" size={16} /> Move up
                      </button>
                      <button
                        type="button"
                        className="btn secondary sm grow"
                        style={{ background: "var(--bg)", border: "none" }}
                        disabled={index === steps.length - 1}
                        onClick={() => move(1)}
                      >
                        <Icon name="down" size={16} /> Move down
                      </button>
                    </div>
                  </>
                )}
                <div className="divider" />
                <SheetItem icon="trash" label="Delete step" tone="danger" onClick={() => setConfirmDelete(true)} />
                <div className="sheet-note">Removes this step from V{version.number}. Earlier versions are untouched.</div>
              </div>
            )}
          </>
        )}
      </Sheet>
      {toast.node}
    </main>
  );
}

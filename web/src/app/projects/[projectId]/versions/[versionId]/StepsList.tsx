"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, MoreIcon } from "@/components/Icon";
import { Sheet, SheetItem } from "@/components/Sheet";
import { BackLink, OriginChip, OutputTiles, Thumb } from "@/components/ui";
import { useToast } from "@/components/useToast";
import { backend } from "@/lib/backend";
import type { Project, Step, Version } from "@/lib/data";
import { refreshProject } from "@/lib/hooks";
import { useAction } from "@/lib/useAction";

export function StepsList({ project, version }: { project: Project; version: Version }) {
  const steps = version.steps;
  const [activeIds, setActiveIds] = useState<{ step: string; parent?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const { run, busy } = useAction(toast.show);

  const base = `/projects/${project.id}/versions/${version.id}`;
  const parentVersion = project.versions.find((v) => v.id === version.parentId);
  const showOrigin = !!version.parentId;
  const parentStep = activeIds?.parent ? steps.find((s) => s.id === activeIds.parent) : undefined;
  const activeStep: Step | undefined = activeIds ? (parentStep ? parentStep.subSteps?.find((s) => s.id === activeIds.step) : steps.find((s) => s.id === activeIds.step)) : undefined;
  const siblings = parentStep?.subSteps ?? steps;
  const index = activeStep ? siblings.findIndex((s) => s.id === activeStep.id) : -1;
  const close = () => {
    setActiveIds(null);
    setConfirmDelete(false);
  };

  const act = (fn: () => Promise<unknown>, message: string) =>
    run(async () => {
      await fn();
      close();
      await refreshProject(project.id);
      toast.show(message);
    });

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
          {parentVersion ? (version.branchedAtStep ? `Tried again from V${parentVersion.number} at step ${version.branchedAtStep}` : `Copied from V${parentVersion.number}`) : "From scratch"} · {version.runs === 0 ? "not run yet" : `${version.runs} run${version.runs === 1 ? "" : "s"} · last ${version.lastRun}`}
        </div>
      </header>

      <div className="content" style={{ gap: 10 }}>
        {steps.length === 0 && (
          <div className="card center muted small" style={{ padding: 20 }}>
            No steps yet. Add the first thing you do.
          </div>
        )}
        {steps.map((s) =>
          s.origin === "pending" ? (
            <div key={s.id} className="card pending" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
              <Link href={`${base}/steps/${s.id}`} className="row grow" style={{ textDecoration: "none", color: "inherit" }}>
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
              <button type="button" className="icon-btn sm" aria-label={`Options for step ${s.label}`} onClick={() => setActiveIds({ step: s.id })}>
                <MoreIcon size={16} />
              </button>
            </div>
          ) : (
            <div key={s.id} className={`card${s.origin === "changed" && showOrigin ? " changed" : ""}`} style={{ padding: 12 }}>
              <div className="row">
                <Link href={`${base}/steps/${s.id}`} className="row grow" style={{ textDecoration: "none", color: "inherit" }}>
                  <Thumb url={s.photoUrl ?? s.photo} />
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
                  onClick={() => setActiveIds({ step: s.id })}
                >
                  <MoreIcon size={16} />
                </button>
              </div>
              {s.subSteps?.map((sub) => (
                <div key={sub.id} className="sub-step">
                  <Link href={`${base}/steps/${sub.id}`} className="grow" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="strong" style={{ fontSize: 14 }}>
                      {sub.label} · {sub.title}
                    </div>
                    <div className="small muted">{sub.detail}</div>
                  </Link>
                  {showOrigin && <OriginChip origin={sub.origin} fromVersion={sub.fromVersion} />}
                  <button type="button" className="icon-btn xs tint-green" aria-label={`Options for step ${sub.label}`} onClick={() => setActiveIds({ step: sub.id, parent: s.id })}>
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
        {version.runs > 0 && project.goals.length > 0 && <OutputTiles goals={project.goals} outputs={version.outputs} />}
        <div className="row">
          <Link href={`${base}/run`} className="btn primary grow">
            <Icon name="play" size={16} /> Start run
          </Link>
          {steps.length > 0 && (
            <Link href={`${base}/branch`} className="btn dark grow">
              <Icon name="branch" size={18} /> Try again from…
            </Link>
          )}
        </div>
      </div>

      <Sheet open={!!activeStep} onClose={close} label="Step options">
        {activeStep && (
          <>
            <div className="sheet-head">
              <Thumb url={activeStep.photoUrl ?? activeStep.photo} size={44} />
              <div>
                <div className="name">
                  {activeStep.label} · {activeStep.title}
                </div>
                <div className="small muted">
                  {activeStep.origin === "pending" ? "Not recorded yet" : activeStep.detail}
                  {activeStep.origin === "changed" ? ` · changed in V${version.number}` : ""}
                </div>
              </div>
            </div>
            {confirmDelete ? (
              <div className="sheet-pad">
                <h2 className="title sm">Delete step “{activeStep.title}”?</h2>
                <p className="muted" style={{ margin: 0 }}>
                  It’s removed from V{version.number} only. Earlier versions keep their copy.
                </p>
                <button type="button" className="btn danger block" disabled={busy} onClick={() => act(() => backend.deleteStep(activeStep.id), `Step “${activeStep.title}” deleted`)}>
                  <Icon name="trash" size={18} /> Delete step
                </button>
                <button type="button" className="btn secondary block" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="sheet-body">
                <SheetItem icon="edit" label="Edit notes & measurements" href={`${base}/steps/${activeStep.id}`} />
                <SheetItem icon="camera" label="Re-record photo / video" href={`${base}/steps/${activeStep.id}?camera=1`} />
                {!parentStep && <SheetItem icon="plus" label="Add sub-step" href={`${base}/steps/new?parent=${activeStep.id}`} />}
                <SheetItem icon="branch" label="Branch from here → new version" tone="accent" href={`${base}/branch?from=${parentStep?.id ?? activeStep.id}`} />
                <div className="divider" />
                <div className="row" style={{ gap: 8, padding: "2px 0" }}>
                  <button
                    type="button"
                    className="btn secondary sm grow"
                    style={{ background: "var(--bg)", border: "none" }}
                    disabled={index <= 0 || busy}
                    onClick={() => act(() => backend.moveStep(activeStep.id, { direction: "up" }), `Moved “${activeStep.title}” up`)}
                  >
                    <Icon name="up" size={16} /> Move up
                  </button>
                  <button
                    type="button"
                    className="btn secondary sm grow"
                    style={{ background: "var(--bg)", border: "none" }}
                    disabled={index === siblings.length - 1 || busy}
                    onClick={() => act(() => backend.moveStep(activeStep.id, { direction: "down" }), `Moved “${activeStep.title}” down`)}
                  >
                    <Icon name="down" size={16} /> Move down
                  </button>
                </div>
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

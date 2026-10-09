"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { BackLink, GoalChips } from "@/components/ui";
import type { Project, Version } from "@/lib/data";

export function RunChecklist({ project, version }: { project: Project; version: Version }) {
  const [done, setDone] = useState<string[]>([]);
  const base = `/projects/${project.id}/versions/${version.id}`;
  const toggle = (id: string) => setDone(done.includes(id) ? done.filter((x) => x !== id) : [...done, id]);

  return (
    <main className="screen">
      <header className="header" style={{ gap: 10 }}>
        <div className="row">
          <BackLink href={base} />
          <div>
            <h1 className="title md">Run V{version.number}</h1>
            <div className="small muted">{project.name}</div>
          </div>
        </div>
        <span className="chip green" style={{ alignSelf: "flex-start", padding: "6px 12px", fontSize: 13 }}>
          V{version.number} · {version.name} · {version.runs} runs
        </span>
      </header>

      <div className="content">
        <div className="row between">
          <span className="eyebrow">Steps</span>
          <span className="xs muted">
            {done.length}/{version.steps.length} done
          </span>
        </div>
        {version.steps.map((s) => {
          const on = done.includes(s.id);
          const detail = [s.detail, ...(s.subSteps?.map((x) => `+ ${x.title.toLowerCase()} ${x.detail.split(" · ")[0]}`) ?? [])].join(" · ");
          return (
            <button key={s.id} type="button" onClick={() => toggle(s.id)} className="card" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, textAlign: "left" }} aria-pressed={on}>
              <span className={`check${on ? " on" : ""}`}>{on && <Icon name="check" size={14} stroke={3} />}</span>
              <span className="grow">
                <span className="strong" style={{ display: "block", textDecoration: on ? "line-through" : undefined, color: on ? "var(--muted)" : undefined }}>
                  {s.label} · {s.title}
                  {s.subSteps?.length ? ` + ${s.subSteps.map((x) => x.title.toLowerCase()).join(", ")}` : ""}
                </span>
                <span className="small muted">{s.origin === "pending" ? "To be decided — record it during the run" : detail}</span>
              </span>
            </button>
          );
        })}

        <label className="field" style={{ marginTop: 6 }}>
          <span>Notes before you start</span>
          <textarea className="textarea" placeholder="e.g. using different bread today" style={{ minHeight: 70 }} />
        </label>

        <div className="field">
          <span>Aiming for</span>
          <GoalChips goals={project.goals} />
        </div>
      </div>

      <div className="footer">
        <Link href={`${base}/run/complete`} className="btn primary block">
          <Icon name="camera" /> Start run &amp; record
        </Link>
        <Link href={`${base}/run/complete`} className="link-btn center small" style={{ color: "var(--muted)" }}>
          Just track, no camera
        </Link>
      </div>
    </main>
  );
}

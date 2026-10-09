"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { formatValue, goalMet, type Project, type Version } from "@/lib/data";

export function RunSummary({ project, version, runNumber }: { project: Project; version: Version; runNumber: number }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const tasteGoal = project.goals.find((g) => g.metric === "taste");
  const outputs = { ...version.outputs, ...(tasteGoal ? { taste: rating || undefined } : {}) } as Record<string, number | undefined>;
  const results = project.goals.map((g) => ({ g, v: outputs[g.metric], met: goalMet(g, outputs[g.metric]) }));
  const missed = results.filter((r) => r.met === false);
  const allMet = results.every((r) => r.met === true);

  return (
    <main className="screen">
      <header className="header">
        <div className="row between">
          <Link href={`/projects/${project.id}/versions/${version.id}`} className="icon-btn" aria-label="Close">
            <Icon name="close" />
          </Link>
          <span className="small muted">
            {project.name} · V{version.number} · Run {runNumber}
          </span>
          <span style={{ width: 44 }} />
        </div>
      </header>

      <div className="content" style={{ gap: 16, padding: "24px 20px" }}>
        <div className="center" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={28} stroke={3} />
          </span>
          <h1 className="title">Run complete!</h1>
          <span className="small muted">today</span>
        </div>

        <div className="tiles lg cols-2">
          {results.map(({ g, v, met }) => (
            <div key={g.metric} className={`tile${met === true ? " ok" : met === false ? " bad" : ""}`}>
              <b>{formatValue(g, v)}</b>
              {g.label} {met === true ? "✓" : met === false ? "✗" : "· rate below"}
              <div className="xs" style={{ opacity: 0.8 }}>
                goal {g.short.replace(/^[A-Za-z ]+(?=[≥≤])/, "")}
              </div>
            </div>
          ))}
        </div>

        {tasteGoal && (
          <div className="card" style={{ alignItems: "center" }}>
            <span className="strong">Rate this run</span>
            <div className="stars" role="radiogroup" aria-label="Taste rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={`star${n <= rating ? " on" : ""}`} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-checked={n === rating} role="radio" onClick={() => setRating(n)}>
                  ★
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="field">
          <span>What changed?</span>
          <textarea className="textarea" placeholder="e.g. Used thicker bread, added extra chia" />
        </label>

        {allMet && <div className="banner">🎉 All goals met this run! V{version.number} is now {results.length}/{results.length}.</div>}
        {missed.length > 0 && (
          <div className="banner amber">
            Missed {missed.map((m) => m.g.label.toLowerCase()).join(" and ")} this run. Branch a new version to fix {missed.length === 1 ? "it" : "them"}.
          </div>
        )}
      </div>

      <div className="footer">
        <button type="button" className="btn primary block" onClick={() => router.push(`/projects/${project.id}`)}>
          Save run
        </button>
        {missed.length > 0 && (
          <Link href={`/projects/${project.id}/versions/${version.id}/branch`} className="btn secondary block">
            <Icon name="branch" size={18} /> Start V{Math.max(...project.versions.map((v) => v.number)) + 1} to fix {missed[0].g.label.toLowerCase()}
          </Link>
        )}
      </div>
    </main>
  );
}

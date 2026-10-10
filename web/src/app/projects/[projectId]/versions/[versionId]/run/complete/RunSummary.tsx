"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { backend } from "@/lib/backend";
import { goalMet, type Project, type Step, type Version } from "@/lib/data";
import { refreshProject } from "@/lib/hooks";

function stepTotals(steps: Step[]): Record<string, number> {
  const totals: Record<string, number> = {};
  const add = (s: Step) => {
    for (const [k, v] of Object.entries(s.outputs ?? {})) totals[k] = (totals[k] ?? 0) + v;
    s.subSteps?.forEach(add);
  };
  steps.forEach(add);
  return totals;
}

const isRating = (unit: string) => unit === "/5";

export function RunSummary({ project, version }: { project: Project; version: Version }) {
  const router = useRouter();
  const runNumber = project.versions.reduce((n, v) => n + v.runs, 0) + 1;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const totals = stepTotals(version.steps);
    return Object.fromEntries(project.goals.filter((g) => !isRating(g.unit) && totals[g.metric] !== undefined).map((g) => [g.metric, String(totals[g.metric])]));
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const outputs = Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v !== "" && Number.isFinite(Number(v)))
      .map(([k, v]) => [k, Number(v)]),
  );
  const results = project.goals.map((g) => ({ g, v: outputs[g.metric], met: goalMet(g, outputs[g.metric]) }));
  const missed = results.filter((r) => r.met === false);
  const allMet = results.length > 0 && results.every((r) => r.met === true);
  const nextVersion = Math.max(...project.versions.map((v) => v.number)) + 1;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await backend.createRun(version.id, { outputs, changeNote: notes.trim() });
      await refreshProject(project.id);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save the run");
      setSaving(false);
    }
  };

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
          <span className="small muted">Log what you measured. Every run is scored against your goals.</span>
        </div>

        {project.goals.length === 0 && <div className="card small muted center">This project has no goals yet — add some from the projects list to score runs.</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {results
            .filter(({ g }) => !isRating(g.unit))
            .map(({ g, met }) => (
              <label key={g.metric} className={`tile${met === true ? " ok" : met === false ? " bad" : ""}`} style={{ borderRadius: 12, padding: "10px 12px", textAlign: "left", display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="xs strong">
                  {g.icon} {g.label} {met === true ? "✓" : met === false ? "✗" : ""}
                </span>
                <span className="row tight">
                  <input
                    inputMode="decimal"
                    value={values[g.metric] ?? ""}
                    onChange={(e) => setValues({ ...values, [g.metric]: e.target.value })}
                    placeholder="–"
                    aria-label={`${g.label} (${g.unit})`}
                    style={{ width: "100%", border: "none", outline: "none", fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700, background: "transparent", color: "inherit" }}
                  />
                  <span className="xs">{g.unit}</span>
                </span>
                <span className="xs" style={{ opacity: 0.8 }}>
                  goal {g.op === ">=" ? "≥" : "≤"} {g.target}
                </span>
              </label>
            ))}
        </div>

        {project.goals
          .filter((g) => isRating(g.unit))
          .map((g) => {
            const rating = Number(values[g.metric] ?? 0);
            return (
              <div key={g.metric} className="card" style={{ alignItems: "center" }}>
                <span className="strong">
                  Rate {g.label.toLowerCase()} · goal {g.op === ">=" ? "≥" : "≤"} {g.target}
                </span>
                <div className="stars" role="radiogroup" aria-label={`${g.label} rating`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`star${n <= rating ? " on" : ""}`}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      aria-checked={n === rating}
                      role="radio"
                      onClick={() => setValues({ ...values, [g.metric]: String(n) })}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

        <label className="field">
          <span>What changed?</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Used thicker bread, added extra chia" maxLength={2000} />
        </label>

        {allMet && <div className="banner">🎉 All goals met this run!</div>}
        {missed.length > 0 && (
          <div className="banner amber">
            Missed {missed.map((m) => m.g.label.toLowerCase()).join(" and ")} this run. Branch a new version to fix {missed.length === 1 ? "it" : "them"}.
          </div>
        )}
      </div>

      <div className="footer">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button type="button" className="btn primary block" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save run"}
        </button>
        {missed.length > 0 && (
          <Link href={`/projects/${project.id}/versions/${version.id}/branch`} className="btn secondary block">
            <Icon name="branch" size={18} /> Start V{nextVersion} to fix {missed[0].g.label.toLowerCase()}
          </Link>
        )}
      </div>
    </main>
  );
}

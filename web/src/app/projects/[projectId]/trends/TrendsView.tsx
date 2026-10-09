"use client";

import { useState } from "react";
import { BackLink } from "@/components/ui";
import { formatValue, goalMet, type Project, type Run } from "@/lib/data";

const W = 320;
const H = 180;
const PAD = { l: 30, r: 12, t: 14, b: 24 };

export function TrendsView({ project }: { project: Project }) {
  const [metric, setMetric] = useState(project.goals[0]?.metric);
  const [showAll, setShowAll] = useState(false);
  const goal = project.goals.find((g) => g.metric === metric);
  const runs = project.runs.filter((r) => metric && r.outputs[metric] !== undefined);
  const versionNum = (id: string) => project.versions.find((v) => v.id === id)?.number ?? 0;

  return (
    <main className="screen">
      <header className="header" style={{ paddingBottom: 0 }}>
        <div className="row">
          <BackLink href={`/projects/${project.id}`} label="Back to project" />
          <div>
            <h1 className="title md">Trends</h1>
            <div className="small muted">{project.name}</div>
          </div>
        </div>
        <div className="tabs" role="tablist">
          {project.goals.map((g) => (
            <button key={g.metric} type="button" role="tab" aria-selected={g.metric === metric} className={`tab${g.metric === metric ? " active" : ""}`} onClick={() => setMetric(g.metric)}>
              {g.label}
            </button>
          ))}
        </div>
      </header>

      <div className="content">
        {goal && runs.length >= 2 ? (
          <>
            <div className="card" style={{ padding: "14px 10px 8px" }}>
              <Chart runs={runs} metric={goal.metric} target={goal.target} versionNum={versionNum} unit={goal.unit} />
              <div className="row xs muted" style={{ gap: 14, justifyContent: "center" }}>
                {project.versions
                  .filter((v) => runs.some((r) => r.versionId === v.id))
                  .map((v) => (
                    <span key={v.id} className="row tight">
                      <span style={{ width: 10, height: 3, borderRadius: 2, background: lineColor(v.number) }} /> V{v.number}
                    </span>
                  ))}
                <span className="row tight">
                  <span style={{ width: 12, borderTop: "2px dashed var(--amber)" }} /> goal
                </span>
              </div>
            </div>
            <Insight project={project} runs={runs} metric={goal.metric} />
          </>
        ) : (
          <div className="card center muted small" style={{ padding: 28 }}>
            Not enough runs yet — record two or more runs to see a trend.
          </div>
        )}

        {project.runs.length > 0 && (
          <>
            <div className="row between" style={{ marginTop: 6 }}>
              <span className="eyebrow">All runs</span>
              <span className="xs muted">{project.runs.length} recorded</span>
            </div>
            {[...project.runs]
              .reverse()
              .slice(0, showAll ? undefined : 4)
              .map((r) => (
                <div key={r.number} className="card" style={{ padding: 12, gap: 6 }}>
                  <div className="row between">
                    <span className="strong">
                      Run {r.number} · V{versionNum(r.versionId)}
                    </span>
                    <span className="xs muted">{r.when}</span>
                  </div>
                  <div className="row tight wrap">
                    {project.goals.map((g) => {
                      const met = goalMet(g, r.outputs[g.metric]);
                      return (
                        <span key={g.metric} className={`chip${met ? " green" : met === false ? " amber" : ""}`}>
                          {formatValue(g, r.outputs[g.metric])} {g.unit === "kcal" ? "kcal " : ""}
                          {met ? "✓" : met === false ? "✗" : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            {project.runs.length > 4 && (
              <button type="button" className="link-btn center small" style={{ padding: 8 }} onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show fewer" : `Show all ${project.runs.length} runs`}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function lineColor(n: number) {
  return ["#C9CCC4", "#0B6B57", "#B4540C", "#5A5F57"][(n - 1) % 4];
}

function Chart({ runs, metric, target, versionNum, unit }: { runs: Run[]; metric: string; target: number; versionNum: (id: string) => number; unit: string }) {
  const values = runs.map((r) => r.outputs[metric]);
  const max = Math.max(target, ...values) * 1.15;
  const min = Math.min(0, ...values);
  const x = (i: number) => PAD.l + (i / (runs.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.33, 0.66, 1].map((t) => Math.round(min + t * (max - min)));
  const segments = [...new Set(runs.map((r) => r.versionId))];
  const last = runs.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${metric} across ${runs.length} runs`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#EDEEEA" />
          <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#9AA0A6">
            {t}
          </text>
        </g>
      ))}
      <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke="#B4540C" strokeDasharray="4 4" strokeWidth="1.5" />
      {segments.map((vid) => {
        const idx = runs.map((r, i) => (r.versionId === vid ? i : -1)).filter((i) => i >= 0);
        const start = idx[0] > 0 ? idx[0] - 1 : idx[0];
        const pts = [start, ...idx.filter((i) => i !== start)].map((i) => `${x(i)},${y(values[i])}`).join(" ");
        const color = lineColor(versionNum(vid));
        return (
          <g key={vid}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {idx.map((i) => (
              <circle key={i} cx={x(i)} cy={y(values[i])} r="3" fill={color} />
            ))}
          </g>
        );
      })}
      <circle cx={x(last)} cy={y(values[last])} r="6" fill="none" stroke="#0B6B57" strokeWidth="2" />
      <text x={x(last) - 8} y={y(values[last]) - 10} textAnchor="end" fontSize="11" fontWeight="700" fill="#0B6B57">
        {values[last]}
        {unit === "g" ? "g" : ""}
      </text>
      {runs.map((r, i) =>
        i % 2 === 0 || i === last ? (
          <text key={r.number} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9AA0A6">
            {r.number}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function Insight({ project, runs, metric }: { project: Project; runs: Run[]; metric: string }) {
  const goal = project.goals.find((g) => g.metric === metric)!;
  const byVersion = project.versions
    .map((v) => {
      const rs = runs.filter((r) => r.versionId === v.id);
      const avg = rs.length ? rs.reduce((n, r) => n + r.outputs[metric], 0) / rs.length : undefined;
      const hits = rs.filter((r) => goalMet(goal, r.outputs[metric])).length;
      return { v, rs, avg, hits };
    })
    .filter((x) => x.rs.length > 0);
  if (byVersion.length < 2) return null;
  const first = byVersion[0];
  const best = byVersion.find((x) => x.v.status === "best") ?? byVersion[byVersion.length - 1];
  const delta = Math.round((best.avg! - first.avg!) * 10) / 10;
  const better = goal.op === ">=" ? delta > 0 : delta < 0;

  return (
    <div className={`banner${better ? "" : " amber"}`}>
      {goal.label}: {delta > 0 ? "↑ +" : "↓ "}
      {delta}
      {goal.unit === "g" ? "g" : ` ${goal.unit}`} on average, V{first.v.number} → V{best.v.number}. V{best.v.number} hits the goal {best.hits}/{best.rs.length} runs.
    </div>
  );
}

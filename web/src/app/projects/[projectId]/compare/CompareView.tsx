"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BackLink } from "@/components/ui";
import { formatValue, goalMet, type Project, type Step, type Version } from "@/lib/data";

type Row = { kind: "same"; steps: Step[] } | { kind: "changed" | "added" | "removed"; a?: Step; b?: Step };

function diff(a: Version, b: Version): Row[] {
  const rows: Row[] = [];
  const ids = [...new Set([...a.steps.map((s) => s.id), ...b.steps.map((s) => s.id)])];
  for (const id of ids) {
    const sa = a.steps.find((s) => s.id === id);
    const sb = b.steps.find((s) => s.id === id);
    const notRecorded = sa?.origin === "pending" || sb?.origin === "pending";
    if (sa && sb && (notRecorded || (sa.title === sb.title && sa.detail === sb.detail && (sa.subSteps?.length ?? 0) === (sb.subSteps?.length ?? 0)))) {
      const prev = rows[rows.length - 1];
      if (prev?.kind === "same") prev.steps.push(sb);
      else rows.push({ kind: "same", steps: [sb] });
    } else if (sa && sb) rows.push({ kind: "changed", a: sa, b: sb });
    else if (sb) rows.push({ kind: "added", b: sb });
    else rows.push({ kind: "removed", a: sa });
  }
  return rows;
}

export function CompareView({ project }: { project: Project }) {
  const search = useSearchParams();
  const vs = project.versions;
  const initialB = vs.find((v) => v.id === search.get("b")) ?? vs.find((v) => v.status === "best") ?? vs[vs.length - 1];
  const initialA = vs.find((v) => v.id === initialB?.parentId) ?? vs.find((v) => v.id !== initialB?.id) ?? initialB;
  const [aId, setA] = useState(initialA?.id);
  const [bId, setB] = useState(initialB?.id);
  const a = vs.find((v) => v.id === aId);
  const b = vs.find((v) => v.id === bId);

  if (!a || !b || vs.length < 2) {
    return (
      <main className="screen">
        <header className="header">
          <div className="row">
            <BackLink href={`/projects/${project.id}`} />
            <h1 className="title md">Compare</h1>
          </div>
        </header>
        <div className="content">
          <div className="card center muted" style={{ padding: 28 }}>
            You need at least two versions to compare. Branch from a step to create V2.
          </div>
        </div>
      </main>
    );
  }

  const rows = diff(a, b);
  const missed = project.goals.filter((g) => goalMet(g, b.outputs[g.metric]) === false);
  const firstChange = rows.find((r) => r.kind !== "same") as { b?: Step } | undefined;
  const nextNumber = Math.max(...vs.map((v) => v.number)) + 1;

  const picker = (value: string, set: (id: string) => void, other: string) => (
    <div className="scroll-x">
      {vs.map((v) => (
        <button key={v.id} type="button" disabled={v.id === other} className={`pill${v.id === value ? " active-green" : ""}`} style={{ opacity: v.id === other ? 0.4 : 1 }} onClick={() => set(v.id)}>
          V{v.number} · {v.name}
        </button>
      ))}
    </div>
  );

  return (
    <main className="screen">
      <header className="header">
        <div className="row">
          <BackLink href={`/projects/${project.id}`} label="Back to project" />
          <h1 className="title md">Compare</h1>
        </div>
        {picker(aId!, setA, bId!)}
        <div className="xs muted center" style={{ marginTop: -4 }}>
          vs
        </div>
        {picker(bId!, setB, aId!)}
      </header>

      <div className="content">
        {rows.map((r, i) =>
          r.kind === "same" ? (
            <div key={i} className="card" style={{ flexDirection: "row", alignItems: "center", padding: 12 }}>
              <span className="grow small muted">
                Step{r.steps.length > 1 ? "s" : ""} {r.steps.map((s) => s.label).join(r.steps.length > 2 ? "–" : ", ").replace(/–.*–/, "–")} · {r.steps.map((s) => s.title).join(", ")}
              </span>
              <span className="chip">unchanged</span>
            </div>
          ) : (
            <div key={i} className={`card${r.kind === "changed" ? " changed" : ""}`}>
              <div className="row between">
                <strong>
                  {(r.b ?? r.a)!.label} · {(r.b ?? r.a)!.title}
                </strong>
                <span className={`chip ${r.kind === "removed" ? "" : r.kind === "added" ? "green" : "amber"}`}>{r.kind}</span>
              </div>
              {r.kind === "changed" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="thumb" style={{ width: "100%", height: 90, background: r.a?.photo ?? "var(--chip)" }}>
                    V{a.number} photo
                  </div>
                  <div className="thumb" style={{ width: "100%", height: 90, background: r.b?.photo ?? "var(--chip)" }}>
                    V{b.number} photo
                  </div>
                </div>
              )}
              <div className="small">
                {r.a && <span className="muted" style={{ textDecoration: r.kind === "changed" ? "line-through" : undefined }}>{r.a.detail}</span>}
                {r.a && r.b && " → "}
                {r.b && <span className="strong">{r.b.detail}</span>}
                {r.b?.subSteps?.map((s) => (
                  <div key={s.id} className="green strong" style={{ marginTop: 4 }}>
                    + {s.label} {s.title}, {s.detail.split(" · ")[0]}
                  </div>
                ))}
              </div>
            </div>
          ),
        )}

        <div className="card">
          <strong>Outputs vs goals</strong>
          <div className="compare-grid">
            <span className="head">Metric</span>
            <span className="head">V{a.number}</span>
            <span className="head">V{b.number}</span>
            {project.goals.map((g) => {
              const ma = goalMet(g, a.outputs[g.metric]);
              const mb = goalMet(g, b.outputs[g.metric]);
              return [
                <span key={`${g.metric}-l`}>{g.short}</span>,
                <span key={`${g.metric}-a`} className={ma ? "ok-text" : ma === false ? "bad-text" : "muted"}>
                  {formatValue(g, a.outputs[g.metric])} {ma ? "✓" : ma === false ? "✗" : ""}
                </span>,
                <span key={`${g.metric}-b`} className={mb ? "ok-text" : mb === false ? "bad-text" : "muted"}>
                  {formatValue(g, b.outputs[g.metric])} {mb ? "✓" : mb === false ? "✗" : ""}
                </span>,
              ];
            })}
          </div>
        </div>
      </div>

      <div className="footer">
        {missed.length > 0 ? (
          <Link href={`/projects/${project.id}/versions/${b.id}/branch${firstChange?.b ? `?from=${firstChange.b.id}` : ""}`} className="btn dark block">
            Try V{nextNumber} from step {firstChange?.b?.label ?? 1} — fix {missed[0].label.toLowerCase()}
          </Link>
        ) : (
          <Link href={`/projects/${project.id}/versions/${b.id}/run`} className="btn primary block">
            V{b.number} meets every goal — repeat it
          </Link>
        )}
      </div>
    </main>
  );
}

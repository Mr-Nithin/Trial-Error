"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BackLink, OriginChip } from "@/components/ui";
import { backend, isMock } from "@/lib/backend";
import type { Project, Version } from "@/lib/data";
import { refreshProject } from "@/lib/hooks";

export function BranchPicker({ project, version }: { project: Project; version: Version }) {
  const router = useRouter();
  const from = useSearchParams().get("from");
  const recorded = version.steps.filter((s) => s.origin !== "pending");
  const defaultStep =
    recorded.find((s) => s.id === from || s.subSteps?.some((x) => x.id === from)) ??
    [...recorded].reverse().find((s) => s.origin === "changed") ??
    recorded[recorded.length - 1];
  const [selected, setSelected] = useState(defaultStep?.id);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const nextNumber = Math.max(...project.versions.map((v) => v.number)) + 1;
  const pick = version.steps.find((s) => s.id === selected);
  const back = `/projects/${project.id}/versions/${version.id}`;

  return (
    <main className="screen">
      <header className="header" style={{ gap: 8 }}>
        <div className="row">
          <BackLink href={back} />
          <div>
            <h1 className="title md">Start new version</h1>
            <div className="small muted">
              {project.name} · V{version.number}
            </div>
          </div>
        </div>
      </header>

      <div className="content" style={{ gap: 10 }}>
        <p className="small muted" style={{ margin: "0 0 4px", lineHeight: 1.5 }}>
          Pick the step where you want to try something different. Steps before it are kept; it and everything after are re-recorded in the new version.
        </p>

        {version.steps.map((s) => {
          const disabled = s.origin === "pending";
          const on = s.id === selected;
          return (
            <button
              key={s.id}
              type="button"
              disabled={disabled}
              onClick={() => setSelected(s.id)}
              className={`card${on ? " best" : disabled ? " pending" : ""}`}
              style={{ textAlign: "left", padding: 12, background: on ? "var(--green-soft)" : undefined, opacity: disabled ? 0.55 : 1, borderColor: disabled ? "var(--rule-strong)" : undefined }}
              aria-pressed={on}
            >
              <div className="row">
                <span className={`radio${on ? " on" : ""}`} />
                <div className="grow">
                  <div className="strong">
                    Step {s.label} · {s.title}
                  </div>
                  <div className="small muted">{disabled ? "not yet recorded" : s.detail}</div>
                </div>
                {version.parentId && !disabled && <OriginChip origin={s.origin} fromVersion={s.fromVersion} />}
              </div>
              {s.subSteps?.map((sub) => (
                <div key={sub.id} className="sub-step" style={{ marginLeft: 34 }}>
                  <div className="grow">
                    <div className="strong" style={{ fontSize: 14 }}>
                      {sub.label} · {sub.title}
                    </div>
                    <div className="small muted">{sub.detail}</div>
                  </div>
                  <OriginChip origin={sub.origin} />
                </div>
              ))}
            </button>
          );
        })}

        {pick && (
          <div className="banner">
            {Number(pick.label) > 1 ? `V${nextNumber} keeps steps 1–${Number(pick.label) - 1} from V${version.number}. ` : ""}You’ll re-record from step {pick.label} onward.
          </div>
        )}
      </div>

      <div className="footer">
        <label className="field">
          <span>Name this version</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Greek yogurt topping" maxLength={80} />
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button
          type="button"
          className="btn primary block"
          disabled={!pick || busy}
          onClick={async () => {
            if (!pick) return;
            setBusy(true);
            setError("");
            try {
              const v = await backend.branchVersion(version.id, { fromStepId: pick.id, name: name.trim() || `Try from step ${pick.label}` });
              await refreshProject(project.id);
              router.push(isMock ? `/projects/${project.id}` : `/projects/${project.id}/versions/${v.id}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn’t create the version");
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating…" : `Start V${nextNumber} from step ${pick?.label ?? ""}`}
        </button>
      </div>
    </main>
  );
}

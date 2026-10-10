"use client";

import { useState } from "react";
import type { Goal } from "@/lib/data";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

export const goalTemplates: Goal[] = [
  { metric: "protein", label: "Protein", short: "Protein ≥ 25 g", icon: "🥩", op: ">=", target: 25, unit: "g" },
  { metric: "kcal", label: "Calories", short: "≤ 450 kcal", icon: "🔥", op: "<=", target: 450, unit: "kcal" },
  { metric: "taste", label: "Taste", short: "Taste ≥ 4/5", icon: "⭐", op: ">=", target: 4, unit: "/5" },
  { metric: "time", label: "Time", short: "≤ 10 min", icon: "⏱", op: "<=", target: 10, unit: "min" },
  { metric: "weight", label: "Weight", short: "Weight ≤ 75 kg", icon: "⚖", op: "<=", target: 75, unit: "kg" },
  { metric: "distance", label: "Distance", short: "Distance ≥ 5 km", icon: "📏", op: ">=", target: 5, unit: "km" },
];

const hints: Record<string, string> = {
  protein: "g ≥ target",
  kcal: "kcal ≤ target",
  taste: "/ 5 rating",
  time: "minutes",
  weight: "kg or lbs",
  distance: "km or mi",
};

export function GoalSheet({
  open,
  onClose,
  onAdd,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (goal: Goal) => void;
  existing: string[];
}) {
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("");
  const [op, setOp] = useState<">=" | "<=">(">=");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");

  const close = () => {
    setCustom(false);
    setName("");
    setTarget("");
    setUnit("");
    onClose();
  };

  const addCustom = () => {
    const t = Number(target);
    if (!name.trim() || Number.isNaN(t)) return;
    const metric = name.trim().toLowerCase().replace(/\s+/g, "-");
    onAdd({
      metric,
      label: name.trim(),
      short: `${name.trim()} ${op === ">=" ? "≥" : "≤"} ${t}${unit ? ` ${unit}` : ""}`,
      icon: "🎯",
      op,
      target: t,
      unit,
    });
    close();
  };

  return (
    <Sheet open={open} onClose={close} label="Add a goal">
      <div className="sheet-pad">
        <h2 className="title sm">Add a goal</h2>
        <div className="eyebrow">Quick add</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {goalTemplates.map((g) => {
            const taken = existing.includes(g.metric);
            return (
              <button
                key={g.metric}
                type="button"
                disabled={taken}
                className="card"
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, textAlign: "left", opacity: taken ? 0.45 : 1 }}
                onClick={() => {
                  onAdd(g);
                  close();
                }}
              >
                <span style={{ fontSize: 22 }}>{g.icon}</span>
                <span>
                  <span className="strong" style={{ display: "block", fontSize: 14 }}>
                    {g.label}
                  </span>
                  <span className="xs muted">{taken ? "added" : hints[g.metric]}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="divider" />

        {custom ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="field">
              <span>Goal name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fibre" autoFocus />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <div className="row tight">
                {([">=", "<="] as const).map((o) => (
                  <button key={o} type="button" className={`pill${op === o ? " active-green" : ""}`} onClick={() => setOp(o)}>
                    {o === ">=" ? "≥ at least" : "≤ at most"}
                  </button>
                ))}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" />
              <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" style={{ width: 110 }} />
            </div>
            <button type="button" className="btn primary block" onClick={addCustom} disabled={!name.trim() || !target}>
              Add goal
            </button>
          </div>
        ) : (
          <button type="button" className="sheet-item" onClick={() => setCustom(true)} style={{ padding: 0 }}>
            <span className="ico">
              <Icon name="target" size={18} />
            </span>
            <span className="grow">Custom goal</span>
            <Icon name="chevron" size={16} />
          </button>
        )}

        <button type="button" className="btn secondary block" onClick={close}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

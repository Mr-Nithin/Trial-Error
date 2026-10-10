"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { GoalSheet, goalTemplates } from "@/components/GoalSheet";
import { Icon } from "@/components/Icon";
import { backend, isMock } from "@/lib/backend";
import type { Category, Goal } from "@/lib/data";
import { refreshProject } from "@/lib/hooks";

const categories = [
  ["🍳", "Food"],
  ["🏋️", "Fitness"],
  ["🌱", "Plant"],
  ["🔨", "Build"],
  ["🎨", "Create"],
  ["✦", "Other"],
] as const;

const emojis = ["🍳", "🍞", "🥗", "☕", "🏃", "🏋️", "🚴", "🌱", "🌿", "🔨", "🎨", "🎸"];

const templateDefaults: Record<string, { category: string; emoji: string; goals: string[] }> = {
  Recipe: { category: "Food", emoji: "🍳", goals: ["protein", "kcal", "taste"] },
  Workout: { category: "Fitness", emoji: "🏋️", goals: ["time", "distance"] },
  "Plant care": { category: "Plant", emoji: "🌱", goals: [] },
  Build: { category: "Build", emoji: "🔨", goals: ["time"] },
};

export function NewProjectForm() {
  const router = useRouter();
  const template = templateDefaults[useSearchParams().get("template") ?? ""] ?? templateDefaults.Recipe;
  const [emoji, setEmoji] = useState(template.emoji);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(template.category);
  const [goals, setGoals] = useState<Goal[]>(goalTemplates.filter((g) => template.goals.includes(g.metric)));
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const project = await backend.createProject({
        name: name.trim(),
        emoji,
        category: category as Category,
        goals: goals.map(({ metric, label, icon, op, target, unit }) => ({ metric, label, icon, op, target, unit })),
      });
      await refreshProject();
      router.push(isMock ? "/projects" : `/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t create the project");
      setBusy(false);
    }
  };

  return (
    <main className="screen white">
      <header className="header" style={{ borderBottom: "1px solid var(--rule)" }}>
        <div className="row between">
          <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => router.back()}>
            <Icon name="close" />
          </button>
          <span className="name">New project</span>
          <button type="button" className="link-btn" disabled={!name.trim() || busy} style={{ opacity: name.trim() ? 1 : 0.4, padding: "0 6px" }} onClick={create}>
            Create
          </button>
        </div>
      </header>

      <div className="content" style={{ gap: 20, padding: "24px 20px" }}>
        <div className="center" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            aria-label="Change icon"
            onClick={() => setEmoji(emojis[(emojis.indexOf(emoji) + 1) % emojis.length])}
            style={{ width: 80, height: 80, borderRadius: "50%", border: "none", background: "var(--green-soft)", fontSize: 38 }}
          >
            {emoji}
          </button>
          <span className="xs muted">Tap to change</span>
        </div>

        <label className="field">
          <span>Project name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Breakfast" maxLength={80} autoFocus />
        </label>

        <div className="field">
          <span>Category</span>
          <div className="scroll-x">
            {categories.map(([e, c]) => (
              <button key={c} type="button" className={`pill${category === c ? " active-green" : ""}`} onClick={() => setCategory(c)}>
                {e} {c}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Goals</span>
          <p className="small muted" style={{ margin: "0 0 4px" }}>
            What does “better” mean? Every run is scored against these.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {goals.map((g) => (
              <div key={g.metric} className="list-row" style={{ background: "var(--bg)", border: "none" }}>
                <span style={{ fontSize: 18 }}>{g.icon}</span>
                <span className="grow">{g.short}</span>
                <button type="button" className="icon-btn xs" style={{ background: "var(--surface)" }} aria-label={`Remove ${g.label}`} onClick={() => setGoals(goals.filter((x) => x.metric !== g.metric))}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn dashed block" style={{ height: 48, borderRadius: 14 }} onClick={() => setSheet(true)}>
              <Icon name="plus" stroke={2.5} /> Add goal
            </button>
          </div>
        </div>
      </div>

      <div className="footer" style={{ borderTop: "none" }}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="button" className="btn primary block" disabled={!name.trim() || busy} onClick={create}>
          {busy ? "Creating…" : "Create project"}
        </button>
      </div>

      <GoalSheet open={sheet} onClose={() => setSheet(false)} existing={goals.map((g) => g.metric)} onAdd={(g) => setGoals([...goals, g])} />
    </main>
  );
}

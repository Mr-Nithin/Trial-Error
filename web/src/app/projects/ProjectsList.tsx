"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArcLogo } from "@/components/ArcLogo";
import { GoalSheet } from "@/components/GoalSheet";
import { Icon, MoreIcon } from "@/components/Icon";
import { ProjectsEmpty } from "@/components/ProjectsEmpty";
import { Sheet, SheetItem } from "@/components/Sheet";
import { OutputTiles } from "@/components/ui";
import { useToast } from "@/components/useToast";
import { bestVersion, goalsMet, totalRuns, type Project } from "@/lib/data";

type SheetMode = "actions" | "rename" | "goals" | "delete";

export function ProjectsList({ initial, archivedCount }: { initial: Project[]; archivedCount: number }) {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [sort, setSort] = useState<"Recent" | "A–Z">("Recent");
  const [active, setActive] = useState<Project | null>(null);
  const [mode, setMode] = useState<SheetMode>("actions");
  const [renameTo, setRenameTo] = useState("");
  const [goalSheet, setGoalSheet] = useState(false);
  const [archived, setArchived] = useState(archivedCount);
  const toast = useToast();

  const categories = useMemo(() => Array.from(new Set(items.map((p) => p.category))), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.versions.some((v) => v.name.toLowerCase().includes(q) || v.steps.some((s) => s.title.toLowerCase().includes(q)))),
    );
    return sort === "A–Z" ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  }, [items, query, category, sort]);

  const open = (p: Project) => {
    setActive(p);
    setMode("actions");
  };
  const close = () => setActive(null);
  const update = (id: string, fn: (p: Project) => Project) => {
    setItems((list) => list.map((p) => (p.id === id ? fn(p) : p)));
    setActive((a) => (a && a.id === id ? fn(a) : a));
  };
  const remove = (p: Project, message: string, onUndo?: () => void) => {
    const snapshot = items;
    setItems((list) => list.filter((x) => x.id !== p.id));
    close();
    toast.show(message, () => {
      setItems(snapshot);
      onUndo?.();
    });
  };

  if (items.length === 0) {
    return (
      <main className="screen">
        <TopBar />
        <ProjectsEmpty />
        {toast.node}
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="header" style={{ gap: 14 }}>
        <TopBar inline />
        <label className="search">
          <Icon name="search" size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects, versions, steps" aria-label="Search projects" />
        </label>
        <div className="row tight">
          <div className="scroll-x grow" style={{ gap: 6 }}>
            <button type="button" className={`pill${category === "All" ? " active" : ""}`} onClick={() => setCategory("All")}>
              All · {items.length}
            </button>
            {categories.map((c) => (
              <button key={c} type="button" className={`pill${category === c ? " active" : ""}`} onClick={() => setCategory(c)}>
                {categoryEmoji[c] ?? "✦"} {c}
              </button>
            ))}
          </div>
          <button type="button" className="pill" style={{ color: "var(--muted)" }} onClick={() => setSort(sort === "Recent" ? "A–Z" : "Recent")} aria-label={`Sort: ${sort}`}>
            <Icon name="sort" size={14} stroke={2.2} /> {sort}
          </button>
        </div>
      </header>

      <div className="content">
        <div className="row between">
          <h1 className="title sm">Your projects</h1>
          <span className="small muted">{items.length} active</span>
        </div>

        {visible.length === 0 && (
          <div className="card center muted small" style={{ padding: 24 }}>
            No projects match “{query}”.
          </div>
        )}

        {visible.map((p, i) => (
          <ProjectCard key={p.id} project={p} highlight={i === 0 && sort === "Recent" && !query} onMore={() => open(p)} />
        ))}

        <Link href="/projects/new" className="btn dashed block">
          <Icon name="plus" stroke={2.5} /> New project
        </Link>

        <Link href="/projects/archived" className="list-row" style={{ height: 48 }}>
          <span className="muted">
            <Icon name="archive" size={18} />
          </span>
          <span className="grow strong" style={{ fontSize: 14 }}>
            Archived
          </span>
          <span className="small muted">{archived}</span>
          <span style={{ color: "var(--rule-strong)" }}>
            <Icon name="chevron" size={16} />
          </span>
        </Link>
      </div>

      <Sheet open={!!active} onClose={close} label="Project options">
        {active && (
          <>
            <div className="sheet-head">
              <div className="emoji-tile" style={{ background: active.tint, width: 44, height: 44, fontSize: 22 }}>
                {active.emoji}
              </div>
              <div>
                <div className="name" style={{ fontSize: 17 }}>
                  {active.name}
                </div>
                <div className="small muted">
                  {active.category} · {active.versions.length} versions · {totalRuns(active)} runs
                </div>
              </div>
            </div>

            {mode === "actions" && (
              <div className="sheet-body">
                <SheetItem
                  icon="edit"
                  label="Rename"
                  onClick={() => {
                    setRenameTo(active.name);
                    setMode("rename");
                  }}
                />
                <SheetItem icon="target" label="Edit goals" trailing={<span className="small muted">{active.goals.length}</span>} onClick={() => setMode("goals")} />
                <SheetItem
                  icon="copy"
                  label="Duplicate project"
                  onClick={() => {
                    const copy = { ...active, id: `${active.id}-copy-${Date.now()}`, name: `${active.name} (copy)` };
                    setItems((list) => {
                      const at = list.findIndex((x) => x.id === active.id);
                      return [...list.slice(0, at + 1), copy, ...list.slice(at + 1)];
                    });
                    close();
                    toast.show(`Duplicated “${active.name}”`);
                  }}
                />
                <SheetItem
                  icon="share"
                  label="Share best version"
                  onClick={() => {
                    const best = bestVersion(active);
                    navigator.clipboard?.writeText(`${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/projects/${active.id}${best ? `/versions/${best.id}` : ""}`).catch(() => {});
                    close();
                    toast.show("Link to best version copied");
                  }}
                />
                <SheetItem
                  icon="pin"
                  label="Pin to top"
                  onClick={() => {
                    setItems((list) => [active, ...list.filter((x) => x.id !== active.id)]);
                    setSort("Recent");
                    close();
                    toast.show(`Pinned “${active.name}”`);
                  }}
                />
                <div className="divider" />
                <SheetItem
                  icon="archive"
                  label="Archive project"
                  onClick={() => {
                    setArchived((n) => n + 1);
                    remove(active, `“${active.name}” archived`, () => setArchived((n) => n - 1));
                  }}
                />
                <SheetItem icon="trash" label="Delete project" tone="danger" onClick={() => setMode("delete")} />
                <div className="sheet-note">
                  Deletes {active.versions.length} versions and {totalRuns(active)} runs permanently. Archive instead to keep history.
                </div>
              </div>
            )}

            {mode === "rename" && (
              <form
                className="sheet-pad"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!renameTo.trim()) return;
                  update(active.id, (p) => ({ ...p, name: renameTo.trim() }));
                  close();
                  toast.show("Project renamed");
                }}
              >
                <label className="field">
                  <span>Project name</span>
                  <input className="input" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} autoFocus />
                </label>
                <button type="submit" className="btn primary block" disabled={!renameTo.trim()}>
                  Save
                </button>
                <button type="button" className="btn secondary block" onClick={() => setMode("actions")}>
                  Back
                </button>
              </form>
            )}

            {mode === "goals" && (
              <div className="sheet-pad">
                {active.goals.map((g) => (
                  <div key={g.metric} className="list-row">
                    <span style={{ fontSize: 18 }}>{g.icon}</span>
                    <span className="grow">{g.short}</span>
                    <button
                      type="button"
                      className="icon-btn xs"
                      aria-label={`Remove ${g.label}`}
                      onClick={() => update(active.id, (p) => ({ ...p, goals: p.goals.filter((x) => x.metric !== g.metric) }))}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" className="btn dashed block" style={{ height: 48 }} onClick={() => setGoalSheet(true)}>
                  <Icon name="plus" stroke={2.5} /> Add goal
                </button>
                <button type="button" className="btn primary block" onClick={close}>
                  Done
                </button>
              </div>
            )}

            {mode === "delete" && (
              <div className="sheet-pad">
                <h2 className="title sm">Delete “{active.name}”?</h2>
                <p className="muted" style={{ margin: 0 }}>
                  This removes {active.versions.length} versions, every step and {totalRuns(active)} runs. It can’t be undone.
                </p>
                <button type="button" className="btn danger block" onClick={() => remove(active, `“${active.name}” deleted`)}>
                  <Icon name="trash" size={18} /> Delete forever
                </button>
                <button type="button" className="btn secondary block" onClick={() => setMode("actions")}>
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </Sheet>

      {active && (
        <GoalSheet
          open={goalSheet}
          onClose={() => setGoalSheet(false)}
          existing={active.goals.map((g) => g.metric)}
          onAdd={(g) => update(active.id, (p) => ({ ...p, goals: [...p.goals, g] }))}
        />
      )}
      {toast.node}
    </main>
  );
}

const categoryEmoji: Record<string, string> = { Food: "🍳", Fitness: "🏃", Plant: "🌱", Build: "🔨", Create: "🎨" };

function TopBar({ inline }: { inline?: boolean }) {
  const bar = (
    <div className="row between">
      <ArcLogo />
      <Link href="/profile" className="avatar" aria-label="Account">
        N
      </Link>
    </div>
  );
  return inline ? bar : <header className="header">{bar}</header>;
}

function ProjectCard({ project, highlight, onMore }: { project: Project; highlight: boolean; onMore: () => void }) {
  const best = bestVersion(project) ?? project.versions[project.versions.length - 1];
  const met = best ? goalsMet(project, best.outputs) : 0;
  const total = project.goals.length;
  const inProgress = !bestVersion(project);

  return (
    <div className={`card lg${highlight ? " best" : ""}`}>
      <div className="row" style={{ gap: 10 }}>
        <Link href={`/projects/${project.id}`} className="row grow" style={{ gap: 10, textDecoration: "none", color: "inherit" }}>
          <div className="emoji-tile" style={{ background: project.tint }}>
            {project.emoji}
          </div>
          <div className="grow">
            <div className="name">{project.name}</div>
            <div className="xs muted">
              {project.category} · {project.versions.length} version{project.versions.length === 1 ? "" : "s"} · {totalRuns(project)} runs
            </div>
          </div>
        </Link>
        {inProgress ? (
          <span className="chip">In progress</span>
        ) : met === total ? (
          <span className="chip solid">★ {met}/{total}</span>
        ) : (
          <span className="chip amber">
            {met}/{total}
          </span>
        )}
        <button type="button" className={`icon-btn sm${highlight ? " tint-green" : ""}`} aria-label={`Options for ${project.name}`} onClick={onMore}>
          <MoreIcon size={16} />
        </button>
      </div>
      {highlight && best && <OutputTiles goals={project.goals} outputs={best.outputs} />}
      <div className="xs muted">Last run: {project.lastRun}</div>
    </div>
  );
}

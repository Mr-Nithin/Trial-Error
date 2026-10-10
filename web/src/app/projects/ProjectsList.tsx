"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArcLogo } from "@/components/ArcLogo";
import { GoalSheet } from "@/components/GoalSheet";
import { Icon, MoreIcon } from "@/components/Icon";
import { ProjectsEmpty } from "@/components/ProjectsEmpty";
import { Sheet, SheetItem } from "@/components/Sheet";
import { ErrorState, Loading, OutputTiles } from "@/components/ui";
import { useToast } from "@/components/useToast";
import { backend } from "@/lib/backend";
import type { Goal, ProjectSummary } from "@/lib/data";
import { goalsMet } from "@/lib/data";
import { refreshProject, useMe, useProjects } from "@/lib/hooks";
import { useAction } from "@/lib/useAction";

type SheetMode = "actions" | "rename" | "goals" | "delete";

const toGoalInput = ({ metric, label, icon, op, target, unit }: Goal) => ({ metric, label, icon, op, target, unit });

export function ProjectsList() {
  const { data: items, error, mutate } = useProjects(false);
  const { data: archivedItems } = useProjects(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [sort, setSort] = useState<"Recent" | "A–Z">("Recent");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<SheetMode>("actions");
  const [renameTo, setRenameTo] = useState("");
  const [goalSheet, setGoalSheet] = useState(false);
  const toast = useToast();
  const { run, busy } = useAction(toast.show);

  const categories = useMemo(() => Array.from(new Set((items ?? []).map((p) => p.category))), [items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (items ?? []).filter((p) => (category === "All" || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
    return sort === "A–Z" ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  }, [items, query, category, sort]);

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (!items) return <Loading />;

  const active = items.find((p) => p.id === activeId) ?? null;
  const close = () => setActiveId(null);
  const act = (fn: () => Promise<unknown>, message: string, undo?: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      close();
      await refreshProject(active?.id);
      toast.show(message, undo ? () => void run(async () => (await undo(), await refreshProject(active?.id))) : undefined);
    });

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
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects" />
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
          <ProjectCard
            key={p.id}
            project={p}
            highlight={i === 0 && sort === "Recent" && !query}
            onMore={() => {
              setActiveId(p.id);
              setMode("actions");
            }}
          />
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
          <span className="small muted">{archivedItems?.length ?? "–"}</span>
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
                  {active.category} · {active.versionCount} versions · {active.runCount} runs
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
                <SheetItem icon="copy" label="Duplicate project" onClick={() => act(() => backend.duplicateProject(active.id), `Duplicated “${active.name}”`)} />
                <SheetItem
                  icon="share"
                  label="Share project link"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/projects/${active.id}`).catch(() => {});
                    close();
                    toast.show("Project link copied");
                  }}
                />
                <SheetItem icon="pin" label="Pin to top" onClick={() => act(() => backend.updateProject(active.id, { pinned: true }), `Pinned “${active.name}”`)} />
                <div className="divider" />
                <SheetItem
                  icon="archive"
                  label="Archive project"
                  onClick={() =>
                    act(
                      () => backend.updateProject(active.id, { archived: true }),
                      `“${active.name}” archived`,
                      () => backend.updateProject(active.id, { archived: false }),
                    )
                  }
                />
                <SheetItem icon="trash" label="Delete project" tone="danger" onClick={() => setMode("delete")} />
                <div className="sheet-note">
                  Deletes {active.versionCount} versions and {active.runCount} runs permanently. Archive instead to keep history.
                </div>
              </div>
            )}

            {mode === "rename" && (
              <form
                className="sheet-pad"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (renameTo.trim()) act(() => backend.updateProject(active.id, { name: renameTo.trim() }), "Project renamed");
                }}
              >
                <label className="field">
                  <span>Project name</span>
                  <input className="input" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} maxLength={80} autoFocus />
                </label>
                <button type="submit" className="btn primary block" disabled={!renameTo.trim() || busy}>
                  Save
                </button>
                <button type="button" className="btn secondary block" onClick={() => setMode("actions")}>
                  Back
                </button>
              </form>
            )}

            {mode === "goals" && (
              <div className="sheet-pad">
                {active.goals.length === 0 && <div className="small muted">No goals yet. Runs are scored against goals.</div>}
                {active.goals.map((g) => (
                  <div key={g.metric} className="list-row">
                    <span style={{ fontSize: 18 }}>{g.icon}</span>
                    <span className="grow">{g.short}</span>
                    <button
                      type="button"
                      className="icon-btn xs"
                      aria-label={`Remove ${g.label}`}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await backend.replaceGoals(active.id, { goals: active.goals.filter((x) => x.metric !== g.metric).map(toGoalInput) });
                          await refreshProject(active.id);
                        })
                      }
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
                  This removes {active.versionCount} versions, every step and {active.runCount} runs. It can’t be undone.
                </p>
                <button type="button" className="btn danger block" disabled={busy} onClick={() => act(() => backend.deleteProject(active.id), `“${active.name}” deleted`)}>
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
          onAdd={(g) =>
            run(async () => {
              await backend.replaceGoals(active.id, { goals: [...active.goals, g].map(toGoalInput) });
              await refreshProject(active.id);
            })
          }
        />
      )}
      {toast.node}
    </main>
  );
}

const categoryEmoji: Record<string, string> = { Food: "🍳", Fitness: "🏃", Plant: "🌱", Build: "🔨", Create: "🎨" };

function TopBar({ inline }: { inline?: boolean }) {
  const { data: me } = useMe();
  const bar = (
    <div className="row between">
      <ArcLogo />
      <Link href="/profile" className="avatar" aria-label="Account">
        {(me?.name ?? "?").slice(0, 1).toUpperCase()}
      </Link>
    </div>
  );
  return inline ? bar : <header className="header">{bar}</header>;
}

function ProjectCard({ project, highlight, onMore }: { project: ProjectSummary; highlight: boolean; onMore: () => void }) {
  const outputs = project.bestOutputs;
  const met = outputs ? goalsMet(project, outputs) : 0;
  const total = project.goals.length;

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
              {project.category} · {project.versionCount} version{project.versionCount === 1 ? "" : "s"} · {project.runCount} runs
            </div>
          </div>
        </Link>
        {!project.hasBest || !outputs ? (
          <span className="chip">{project.versionCount ? "In progress" : "New"}</span>
        ) : met === total ? (
          <span className="chip solid">
            ★ {met}/{total}
          </span>
        ) : (
          <span className="chip amber">
            {met}/{total}
          </span>
        )}
        <button type="button" className={`icon-btn sm${highlight ? " tint-green" : ""}`} aria-label={`Options for ${project.name}`} onClick={onMore}>
          <MoreIcon size={16} />
        </button>
      </div>
      {highlight && outputs && total > 0 && <OutputTiles goals={project.goals} outputs={outputs} />}
      <div className="xs muted">Last run: {project.lastRun}</div>
    </div>
  );
}

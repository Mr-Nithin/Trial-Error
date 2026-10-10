import Link from "next/link";
import { formatValue, goalMet, goalsMet, type Goal, type Outputs, type Project, type Version } from "@/lib/data";
import { Icon } from "./Icon";

export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="icon-btn" aria-label={label}>
      <Icon name="back" />
    </Link>
  );
}

export function GoalChips({ goals }: { goals: Goal[] }) {
  return (
    <div className="row tight wrap">
      {goals.map((g) => (
        <span key={g.metric} className="chip green" style={{ padding: "5px 10px" }}>
          {g.short}
        </span>
      ))}
    </div>
  );
}

export function OutputTiles({ goals, outputs, large }: { goals: Goal[]; outputs: Outputs; large?: boolean }) {
  return (
    <div className={`tiles${large ? " lg" : ""}${goals.length === 3 ? " cols-3" : goals.length === 2 ? " cols-2" : ""}`}>
      {goals.map((g) => {
        const met = goalMet(g, outputs[g.metric]);
        return (
          <div key={g.metric} className={`tile${met === true ? " ok" : met === false ? " bad" : ""}`}>
            <b>{formatValue(g, outputs[g.metric])}</b>
            {g.label.toLowerCase()} {met === true ? "✓" : met === false ? "✗" : ""}
          </div>
        );
      })}
    </div>
  );
}

export function ScoreChip({ project, version }: { project: Project; version: Version }) {
  if (version.status === "in-progress") return <span className="chip amber">In progress</span>;
  const met = goalsMet(project, version.outputs);
  const total = project.goals.length;
  if (version.status === "best") return <span className="chip solid">★ {met}/{total}</span>;
  return <span className={`chip ${met === total ? "green" : "amber"}`}>{met}/{total}</span>;
}

export function OriginChip({ origin, fromVersion }: { origin: string; fromVersion?: number }) {
  if (origin === "inherited") return <span className="chip">from V{fromVersion}</span>;
  if (origin === "changed") return <span className="chip amber">changed</span>;
  if (origin === "new") return <span className="chip green">new</span>;
  return null;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="screen" aria-busy="true">
      <div className="content" style={{ alignItems: "center", justifyContent: "center" }}>
        <span className="spinner" aria-hidden="true" />
        <span className="small muted">{label}</span>
      </div>
    </main>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  backHref = "/projects",
  onRetry,
}: {
  title?: string;
  message: string;
  backHref?: string;
  onRetry?: () => void;
}) {
  return (
    <main className="screen">
      <div className="content" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14 }}>
        <h1 className="title sm">{title}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {message}
        </p>
        <div className="row">
          {onRetry && (
            <button type="button" className="btn secondary sm" onClick={onRetry}>
              Try again
            </button>
          )}
          <Link href={backHref} className="btn primary sm">
            Back to projects
          </Link>
        </div>
      </div>
    </main>
  );
}

export function Thumb({ url, size = 56, label = "photo" }: { url?: string; size?: number; label?: string }) {
  const style = { width: size, height: size };
  if (url && !url.startsWith("#")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="thumb" style={{ ...style, objectFit: "cover" }} />;
  }
  return (
    <div className="thumb" style={{ ...style, background: url ?? "var(--chip)" }}>
      {size >= 48 ? label : null}
    </div>
  );
}

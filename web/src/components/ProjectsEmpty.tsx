import Link from "next/link";
import { Icon } from "./Icon";

const templates = [
  ["🍳", "Recipe", "protein · kcal · taste"],
  ["🏋️", "Workout", "reps · time · effort"],
  ["🌱", "Plant care", "water · light · growth"],
  ["🔨", "Build", "steps · cost · time"],
];

export function ProjectsEmpty() {
  return (
    <div className="content" style={{ padding: "28px 24px", gap: 20 }}>
      <div className="card" style={{ height: 180, alignItems: "center", justifyContent: "center", borderRadius: 20 }}>
        <svg width="200" height="120" viewBox="0 0 200 120" fill="none" aria-hidden="true">
          <path d="M20 100 C 80 100 120 20 180 20" stroke="#C9CCC4" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
          <circle cx="20" cy="100" r="10" fill="#0B6B57" />
          <circle cx="20" cy="100" r="18" stroke="#CDE9DF" strokeWidth="4" />
          <circle cx="100" cy="60" r="6" fill="#E3E5DF" />
          <circle cx="180" cy="20" r="8" fill="#E3E5DF" />
        </svg>
      </div>
      <div className="center">
        <h1 className="title" style={{ fontSize: 26, marginBottom: 8 }}>
          Every arc starts at V1.
        </h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Pick something you do again and again. Record it once, then make it better.
        </p>
      </div>
      <Link href="/projects/new" className="btn primary block">
        <Icon name="plus" stroke={2.5} /> Start your first project
      </Link>
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Or start from a template
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {templates.map(([e, t, d]) => (
            <Link key={t} href={`/projects/new?template=${encodeURIComponent(t)}`} className="card" style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10 }}>
              <span style={{ fontSize: 22 }}>{e}</span>
              <span>
                <span className="strong" style={{ display: "block", fontSize: 14 }}>
                  {t}
                </span>
                <span className="xs muted">{d}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

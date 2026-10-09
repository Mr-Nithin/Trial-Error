import Link from "next/link";
import { Icon } from "@/components/Icon";
import { projects, totalRuns } from "@/lib/data";

const settings = [
  ["bell", "Notifications"],
  ["sun", "Appearance"],
  ["lock", "Privacy & security"],
  ["help", "Help & feedback"],
];

export default function ProfilePage() {
  const active = projects.filter((p) => !p.archived);
  const versions = active.reduce((n, p) => n + p.versions.length, 0);
  const runs = active.reduce((n, p) => n + totalRuns(p), 0);

  return (
    <main className="screen">
      <header className="header" style={{ gap: 16 }}>
        <div className="row">
          <Link href="/projects" className="icon-btn" aria-label="Close">
            <Icon name="close" />
          </Link>
          <h1 className="title md">Account</h1>
        </div>
        <div className="row" style={{ gap: 14 }}>
          <div className="avatar lg">N</div>
          <div className="grow">
            <div className="name" style={{ fontSize: 18 }}>
              Nithin
            </div>
            <div className="small muted">nithin@example.com</div>
          </div>
          <button type="button" className="btn secondary sm" style={{ height: 36, fontSize: 13 }}>
            Edit
          </button>
        </div>
      </header>

      <div className="content" style={{ gap: 16 }}>
        <div className="stats">
          <div>
            <b>{active.length}</b>
            <span className="xs muted">Projects</span>
          </div>
          <div>
            <b>{versions}</b>
            <span className="xs muted">Versions</span>
          </div>
          <div>
            <b>{runs}</b>
            <span className="xs muted">Runs</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Settings
          </div>
          {settings.map(([icon, label]) => (
            <button key={label} type="button" className="list-row">
              <span className="muted">
                <Icon name={icon} />
              </span>
              <span className="grow">{label}</span>
              <span style={{ color: "var(--rule-strong)" }}>
                <Icon name="chevron" size={16} />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="footer">
        <Link href="/login" className="btn danger block">
          <Icon name="logout" /> Sign out
        </Link>
        <div className="center xs faint">arc · version 0.1</div>
      </div>
    </main>
  );
}

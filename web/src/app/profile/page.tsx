"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "swr";
import { AuthGate } from "@/components/AuthGate";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/useToast";
import { backend } from "@/lib/backend";
import { clearSession, keys, useMe, useProjects } from "@/lib/hooks";
import { useAction } from "@/lib/useAction";

const settings = [
  ["bell", "Notifications"],
  ["sun", "Appearance"],
  ["lock", "Privacy & security"],
  ["help", "Help & feedback"],
];

function Profile() {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: projects } = useProjects(false);
  const [editing, setEditing] = useState<string | null>(null);
  const toast = useToast();
  const { run, busy } = useAction(toast.show);
  if (!me) return null;

  const versions = projects?.reduce((n, p) => n + p.versionCount, 0);
  const runs = projects?.reduce((n, p) => n + p.runCount, 0);

  const signOut = () =>
    run(async () => {
      await backend.logout();
      await clearSession();
      router.replace("/login");
    });

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
          <div className="avatar lg">{me.name.slice(0, 1).toUpperCase()}</div>
          <div className="grow">
            <div className="name" style={{ fontSize: 18 }}>
              {me.name}
            </div>
            <div className="small muted">{me.email}</div>
          </div>
          <button type="button" className="btn secondary sm" style={{ height: 36, fontSize: 13 }} onClick={() => setEditing(me.name)}>
            Edit
          </button>
        </div>
      </header>

      <div className="content" style={{ gap: 16 }}>
        <div className="stats">
          <div>
            <b>{projects?.length ?? "–"}</b>
            <span className="xs muted">Projects</span>
          </div>
          <div>
            <b>{versions ?? "–"}</b>
            <span className="xs muted">Versions</span>
          </div>
          <div>
            <b>{runs ?? "–"}</b>
            <span className="xs muted">Runs</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Settings
          </div>
          {settings.map(([icon, label]) => (
            <button key={label} type="button" className="list-row" onClick={() => toast.show(`${label} settings are coming soon`)}>
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
        <button type="button" className="btn danger block" disabled={busy} onClick={signOut}>
          <Icon name="logout" /> Sign out
        </button>
        <div className="center xs faint">arc · version 0.2</div>
      </div>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} label="Edit name">
        <form
          className="sheet-pad"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editing?.trim()) return;
            run(async () => {
              const user = await backend.updateMe({ name: editing.trim() });
              await mutate(keys.me, user, { revalidate: false });
              setEditing(null);
              toast.show("Name updated");
            });
          }}
        >
          <label className="field">
            <span>Your name</span>
            <input className="input" value={editing ?? ""} onChange={(e) => setEditing(e.target.value)} maxLength={80} autoFocus />
          </label>
          <button type="submit" className="btn primary block" disabled={!editing?.trim() || busy}>
            Save
          </button>
        </form>
      </Sheet>
      {toast.node}
    </main>
  );
}

export default function ProfilePage() {
  return (
    <AuthGate>
      <Profile />
    </AuthGate>
  );
}

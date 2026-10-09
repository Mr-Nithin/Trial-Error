"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { goalMet, type Goal, type Step } from "@/lib/data";

function clock(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function StepRecorder({ step, goals, backHref, nextLabel }: { step?: Step; goals: Goal[]; backHref: string; nextLabel: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const parent = search.get("parent");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [photo, setPhoto] = useState<string | null>(step && step.origin !== "pending" && !search.get("camera") ? step.photo ?? null : null);
  const [title, setTitle] = useState(step && step.origin !== "pending" ? step.title : "");
  const [detail, setDetail] = useState(step && step.origin !== "pending" ? step.detail : "");
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [voice, setVoice] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const label = step ? step.label : parent ? `${parent.replace("s", "")}a` : nextLabel;

  return (
    <main className="screen white">
      <section className="camera">
        <div className="row between">
          <Link href={backHref} className="icon-btn" aria-label="Close" style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}>
            <Icon name="close" />
          </Link>
          <button
            type="button"
            onClick={() => setRunning(!running)}
            className="chip"
            style={{ background: "rgba(255,255,255,0.14)", color: "#fff", padding: "8px 12px", border: "none", fontSize: 13 }}
          >
            ⏱ step timer {clock(seconds)} {running ? "· pause" : "· resume"}
          </button>
        </div>
        <div className="camera-view" style={photo ? { background: photo, color: "rgba(21,23,28,0.55)" } : undefined}>
          {photo ? "photo captured — tap the shutter to retake" : "[ live camera preview ]"}
        </div>
        <div className="row" style={{ justifyContent: "space-around" }}>
          <button type="button" className="cam-side" aria-label="Choose from gallery" onClick={() => setPhoto("#D9C7A3")}>
            <Icon name="image" />
          </button>
          <button type="button" className="shutter" aria-label="Take photo" onClick={() => setPhoto(photo ? null : "#E9D27A")} />
          <button
            type="button"
            className="cam-side"
            aria-label={voice ? "Stop voice note" : "Record voice note"}
            onClick={() => setVoice(!voice)}
            style={voice ? { background: "#C23B3B" } : undefined}
          >
            <Icon name="mic" />
          </button>
        </div>
      </section>

      <div className="content" style={{ gap: 14, padding: "18px 20px" }}>
        <div className="eyebrow">
          Step {label}
          {parent ? " · sub-step" : ""}
        </div>
        <label className="field">
          <span>Heading</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Topping — diced banana" />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="textarea" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What did you do? Quantities, heat, timing…" />
        </label>
        <div className="field">
          <span>Outputs</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {goals.map((g) => {
              const raw = outputs[g.metric] ?? "";
              const met = raw === "" ? undefined : goalMet(g, Number(raw));
              return (
                <label key={g.metric} className="card" style={{ padding: 10, gap: 4, borderColor: met ? "var(--green)" : met === false ? "var(--amber)" : undefined }}>
                  <span className="xs muted strong">
                    {g.icon} {g.label}
                  </span>
                  <span className="row tight">
                    <input
                      inputMode="decimal"
                      value={raw}
                      onChange={(e) => setOutputs({ ...outputs, [g.metric]: e.target.value })}
                      placeholder="–"
                      aria-label={`${g.label} (${g.unit})`}
                      style={{ width: "100%", border: "none", outline: "none", fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700, background: "transparent" }}
                    />
                    <span className="xs muted">{g.unit}</span>
                  </span>
                  {met !== undefined && <span className={`xs ${met ? "ok-text" : "bad-text"}`}>{met ? "✓" : "✗"} goal {g.short}</span>}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="footer">
        <div className="row">
          <Link href={`${backHref}/steps/new?parent=${step?.id ?? ""}`} className="btn secondary" style={{ width: 130 }}>
            + Sub-step
          </Link>
          <button type="button" className="btn primary grow" disabled={!title.trim()} onClick={() => router.push(backHref)}>
            Save step
          </button>
        </div>
      </div>
    </main>
  );
}

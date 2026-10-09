"use client";

import Link from "next/link";
import { useState } from "react";
import { ArcLogo } from "@/components/ArcLogo";

const slides = [
  {
    title: "Version control\nfor real life.",
    body: "Every attempt tracked. Every change compared. Every improvement intentional.",
    art: (
      <div className="card" style={{ background: "var(--bg)", border: "none", gap: 0, padding: 18 }}>
        <MiniVersion label="V1 · Baseline" chip={<span className="chip amber">2/3</span>} />
        <MiniBranch text="branched from step 3" />
        <MiniVersion label="V2 · + more protein" chip={<span className="chip solid">★ 4/4</span>} best />
      </div>
    ),
  },
  {
    title: "Record every\nstep you take.",
    body: "Snap a photo, note what you did, log the outputs that matter — protein, time, taste, distance.",
    art: (
      <div className="card" style={{ background: "var(--bg)", border: "none", padding: 18 }}>
        {[
          ["1 · Bread", "2 slices · 12 g protein", "#E8DCC7"],
          ["2 · Toast", "3 min medium", "#D9B98A"],
          ["3 · Peanut butter", "2 tbsp · 8 g protein", "#B98551"],
        ].map(([t, d, c]) => (
          <div key={t} className="card" style={{ flexDirection: "row", alignItems: "center", padding: 10 }}>
            <div className="thumb" style={{ background: c, width: 40, height: 40 }} />
            <div>
              <div className="strong small">{t}</div>
              <div className="xs muted">{d}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Branch from\nany step.",
    body: "Keep what worked, change one thing, try again. Arc shows exactly what moved your results.",
    art: (
      <div className="card" style={{ background: "var(--bg)", border: "none", padding: 18 }}>
        <div className="compare-grid card" style={{ display: "grid" }}>
          <span className="head">Metric</span>
          <span className="head">V1</span>
          <span className="head">V2</span>
          <span>Protein</span>
          <span className="bad-text">16 g ✗</span>
          <span className="ok-text">26 g ✓</span>
          <span>Taste</span>
          <span className="ok-text">4 ✓</span>
          <span className="ok-text">5 ✓</span>
        </div>
        <div className="banner small">↑ +10 g protein from one change at step 3</div>
      </div>
    ),
  },
];

function MiniVersion({ label, chip, best }: { label: string; chip: React.ReactNode; best?: boolean }) {
  return (
    <div className={`card${best ? " best" : ""}`} style={{ flexDirection: "row", alignItems: "center", padding: 12 }}>
      <span className="name sm grow">{label}</span>
      {chip}
    </div>
  );
}

function MiniBranch({ text }: { text: string }) {
  return (
    <div style={{ padding: "8px 0 8px 18px", borderLeft: "2px solid var(--rule-strong)", marginLeft: 20 }}>
      <span className="tl-label">{text}</span>
    </div>
  );
}

export default function Onboarding() {
  const [i, setI] = useState(0);
  const slide = slides[i];
  const last = i === slides.length - 1;

  return (
    <main className="screen white" style={{ padding: "48px 24px 32px", gap: 24 }}>
      <div className="row" style={{ justifyContent: "center" }}>
        <ArcLogo size={26} />
      </div>
      <div className="center" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 className="title" style={{ fontSize: 32, whiteSpace: "pre-line" }}>
          {slide.title}
        </h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          {slide.body}
        </p>
      </div>
      <div style={{ flex: 1 }}>{slide.art}</div>
      <div className="dots" aria-label={`Slide ${i + 1} of ${slides.length}`}>
        {slides.map((_, n) => (
          <span key={n} className={n === i ? "on" : ""} />
        ))}
      </div>
      {last ? (
        <Link href="/signup" className="btn primary block">
          Get started
        </Link>
      ) : (
        <button type="button" className="btn primary block" onClick={() => setI(i + 1)}>
          Next
        </button>
      )}
      <div className="center small">
        Already have an account?{" "}
        <Link href="/login" className="link-btn">
          Log in
        </Link>
      </div>
    </main>
  );
}

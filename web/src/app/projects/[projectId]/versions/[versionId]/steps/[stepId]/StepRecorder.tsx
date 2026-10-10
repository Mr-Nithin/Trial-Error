"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { backend } from "@/lib/backend";
import { goalMet, type Goal, type Step } from "@/lib/data";
import { refreshProject } from "@/lib/hooks";

function clock(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Photo = { id?: string; url: string; video?: boolean };

export function StepRecorder({
  projectId,
  versionId,
  step,
  parentStep,
  goals,
  nextLabel,
}: {
  projectId: string;
  versionId: string;
  step?: Step;
  parentStep?: Step;
  goals: Goal[];
  nextLabel: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const backHref = `/projects/${projectId}/versions/${versionId}`;
  const recorded = step && step.origin !== "pending";
  const existingPhoto = step?.photoUrl ?? step?.photo;
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [photo, setPhoto] = useState<Photo | null>(recorded && !search.get("camera") && existingPhoto ? { url: existingPhoto } : null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(step?.title ?? "");
  const [detail, setDetail] = useState(recorded ? step.detail : "");
  const [outputs, setOutputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(step?.outputs ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const label = step ? step.label : parentStep ? `${parentStep.label}${String.fromCharCode(97 + (parentStep.subSteps?.length ?? 0))}` : nextLabel;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const media = await backend.uploadMedia(file);
      setPhoto({ id: media.id, url: media.url, video: file.type.startsWith("video/") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    const parsed = Object.fromEntries(
      Object.entries(outputs)
        .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)))
        .map(([k, v]) => [k, Number(v)]),
    );
    const photoChange = photo?.id ? { photoMediaId: photo.id } : !photo && existingPhoto ? { photoMediaId: null } : {};
    try {
      if (step) {
        await backend.updateStep(step.id, { title: title.trim(), detail: detail.trim(), outputs: parsed, ...photoChange });
      } else {
        await backend.createStep(versionId, { title: title.trim(), detail: detail.trim(), outputs: parsed, parentStepId: parentStep?.id ?? null, ...photoChange });
      }
      await refreshProject(projectId);
      router.push(backHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save the step");
      setSaving(false);
    }
  };

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
        <div className="camera-view" style={photo?.url.startsWith("#") ? { background: photo.url } : undefined}>
          {uploading ? (
            "Uploading…"
          ) : photo && !photo.url.startsWith("#") ? (
            photo.video ? (
              <video src={photo.url} controls style={{ width: "100%", height: "100%", borderRadius: 18, objectFit: "cover" }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt="Step photo" style={{ width: "100%", height: "100%", borderRadius: 18, objectFit: "cover" }} />
            )
          ) : photo ? (
            <span style={{ color: "rgba(21,23,28,0.55)" }}>photo</span>
          ) : (
            "Tap the shutter to take a photo or video"
          )}
        </div>
        <div className="row" style={{ justifyContent: "space-around" }}>
          <button type="button" className="cam-side" aria-label="Choose from gallery" onClick={() => galleryInput.current?.click()}>
            <Icon name="image" />
          </button>
          <button type="button" className="shutter" aria-label="Take photo" disabled={uploading} onClick={() => cameraInput.current?.click()} />
          <button type="button" className="cam-side" aria-label="Remove photo" disabled={!photo} onClick={() => setPhoto(null)} style={{ opacity: photo ? 1 : 0.4 }}>
            <Icon name="trash" />
          </button>
        </div>
        <input ref={cameraInput} type="file" accept="image/*,video/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={galleryInput} type="file" accept="image/*,video/*" hidden onChange={(e) => onFile(e.target.files?.[0])} data-testid="gallery-input" />
      </section>

      <div className="content" style={{ gap: 14, padding: "18px 20px" }}>
        <div className="eyebrow">
          Step {label}
          {parentStep ? ` · sub-step of ${parentStep.title}` : ""}
        </div>
        <label className="field">
          <span>Heading</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Topping — diced banana" maxLength={120} />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="textarea" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What did you do? Quantities, heat, timing…" maxLength={2000} />
        </label>
        {goals.length > 0 && (
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
        )}
      </div>

      <div className="footer">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="row">
          {step && !parentStep && recorded && (
            <Link href={`${backHref}/steps/new?parent=${step.id}`} className="btn secondary" style={{ width: 130 }}>
              + Sub-step
            </Link>
          )}
          <button type="button" className="btn primary grow" disabled={!title.trim() || saving || uploading} onClick={save}>
            {saving ? "Saving…" : "Save step"}
          </button>
        </div>
      </div>
    </main>
  );
}

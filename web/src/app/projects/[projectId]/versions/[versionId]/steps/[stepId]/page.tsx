"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GateScreen } from "@/components/ProjectGate";
import { Loading } from "@/components/ui";
import { useProjectPage } from "@/lib/hooks";
import { StepRecorder } from "./StepRecorder";

function StepScreen() {
  const { projectId, versionId, stepId } = useParams<{ projectId: string; versionId: string; stepId: string }>();
  const parentId = useSearchParams().get("parent");
  const { data, gate, mutate } = useProjectPage(projectId);
  if (gate) return <GateScreen gate={gate} onRetry={() => mutate()} />;
  const version = data!.versions.find((v) => v.id === versionId);
  if (!version) return <GateScreen gate={{ message: "This version doesn’t exist, or it was deleted." }} />;

  const isNew = stepId === "new";
  let step;
  let parentStep = parentId ? version.steps.find((s) => s.id === parentId) : undefined;
  if (!isNew) {
    for (const s of version.steps) {
      if (s.id === stepId) step = s;
      const sub = s.subSteps?.find((x) => x.id === stepId);
      if (sub) {
        step = sub;
        parentStep = s;
      }
    }
    if (!step) return <GateScreen gate={{ message: "This step doesn’t exist, or it was deleted." }} />;
  }

  return (
    <StepRecorder
      key={stepId}
      projectId={data!.id}
      versionId={version.id}
      step={step}
      parentStep={parentStep}
      goals={data!.goals}
      nextLabel={String(version.steps.length + 1)}
    />
  );
}

export default function StepPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StepScreen />
    </Suspense>
  );
}

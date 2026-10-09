import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findStep, getProject, getVersion } from "@/lib/data";
import { StepRecorder } from "./StepRecorder";

export function generateStaticParams({ params }: { params: { projectId: string; versionId: string } }) {
  const project = getProject(params.projectId);
  const version = project && getVersion(project, params.versionId);
  if (!version) return [];
  const ids = version.steps.flatMap((s) => [s.id, ...(s.subSteps?.map((x) => x.id) ?? [])]);
  return [...ids, "new"].map((stepId) => ({ stepId }));
}

export default async function StepPage({ params }: { params: Promise<{ projectId: string; versionId: string; stepId: string }> }) {
  const { projectId, versionId, stepId } = await params;
  const project = getProject(projectId);
  const version = project && getVersion(project, versionId);
  if (!project || !version) notFound();
  const step = stepId === "new" ? undefined : findStep(version, stepId);
  if (stepId !== "new" && !step) notFound();

  return (
    <Suspense>
      <StepRecorder
        step={step}
        goals={project.goals}
        backHref={`/projects/${project.id}/versions/${version.id}`}
        nextLabel={String(version.steps.length + 1)}
      />
    </Suspense>
  );
}

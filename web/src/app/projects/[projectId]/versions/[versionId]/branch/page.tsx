import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProject, getVersion } from "@/lib/data";
import { BranchPicker } from "./BranchPicker";

export default async function BranchPage({ params }: { params: Promise<{ projectId: string; versionId: string }> }) {
  const { projectId, versionId } = await params;
  const project = getProject(projectId);
  const version = project && getVersion(project, versionId);
  if (!project || !version) notFound();
  return (
    <Suspense>
      <BranchPicker project={project} version={version} />
    </Suspense>
  );
}

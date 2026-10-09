import { notFound } from "next/navigation";
import { getProject, getVersion } from "@/lib/data";
import { StepsList } from "./StepsList";

export default async function VersionPage({ params }: { params: Promise<{ projectId: string; versionId: string }> }) {
  const { projectId, versionId } = await params;
  const project = getProject(projectId);
  const version = project && getVersion(project, versionId);
  if (!project || !version) notFound();
  return <StepsList project={project} version={version} />;
}

import { notFound } from "next/navigation";
import { getProject, getVersion } from "@/lib/data";
import { RunChecklist } from "./RunChecklist";

export default async function RunPage({ params }: { params: Promise<{ projectId: string; versionId: string }> }) {
  const { projectId, versionId } = await params;
  const project = getProject(projectId);
  const version = project && getVersion(project, versionId);
  if (!project || !version) notFound();
  return <RunChecklist project={project} version={version} />;
}

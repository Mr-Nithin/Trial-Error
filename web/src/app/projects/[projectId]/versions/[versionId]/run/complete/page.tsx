import { notFound } from "next/navigation";
import { getProject, getVersion, totalRuns } from "@/lib/data";
import { RunSummary } from "./RunSummary";

export default async function RunCompletePage({ params }: { params: Promise<{ projectId: string; versionId: string }> }) {
  const { projectId, versionId } = await params;
  const project = getProject(projectId);
  const version = project && getVersion(project, versionId);
  if (!project || !version) notFound();
  return <RunSummary project={project} version={version} runNumber={totalRuns(project) + 1} />;
}

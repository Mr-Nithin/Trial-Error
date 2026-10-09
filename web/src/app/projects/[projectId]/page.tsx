import { notFound } from "next/navigation";
import { getProject } from "@/lib/data";
import { VersionsTimeline } from "./VersionsTimeline";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project || project.archived) notFound();
  return <VersionsTimeline project={project} />;
}

import { notFound } from "next/navigation";
import { getProject } from "@/lib/data";
import { TrendsView } from "./TrendsView";

export default async function TrendsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();
  return <TrendsView project={project} />;
}

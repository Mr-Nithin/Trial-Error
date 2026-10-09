import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProject } from "@/lib/data";
import { CompareView } from "./CompareView";

export default async function ComparePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();
  return (
    <Suspense>
      <CompareView project={project} />
    </Suspense>
  );
}

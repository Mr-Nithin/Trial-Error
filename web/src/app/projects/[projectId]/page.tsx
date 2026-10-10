"use client";

import { useParams } from "next/navigation";
import { GateScreen } from "@/components/ProjectGate";
import { useProjectPage } from "@/lib/hooks";
import { VersionsTimeline } from "./VersionsTimeline";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, gate, mutate } = useProjectPage(projectId);
  if (gate) return <GateScreen gate={gate} onRetry={() => mutate()} />;
  return <VersionsTimeline project={data!} />;
}
